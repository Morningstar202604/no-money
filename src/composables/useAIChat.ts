import { ref, onScopeDispose } from 'vue'
import type { ScenarioResult } from '../types'
import { scoreTier, scoreLevel } from '../utils/score'
import { validateEndpoint } from '../utils/endpoint'
import { searchKnowledge, kbContextForPrompt, KB_TYPE_LABELS, citySourceEntries, buildStaticKbEntries } from '../utils/knowledge'
import type { CityRule } from '../types'
import { provinceOf } from '../data/provinces'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isStreaming?: boolean
  /** ai = 大模型回答；kb = 本地知识库检索应答（离线） */
  source?: 'ai' | 'kb'
  /** 连接失败等错误气泡：不进模型上下文，也不该被模型当事实复述 */
  isError?: boolean
}

export interface ApiConfig {
  endpoint: string
  apiKey: string
  model: string
  enabled: boolean
  /**
   * 是否把 API Key 持久化到 localStorage。
   * 默认 false —— Key 只留在内存，关闭标签页即失效。
   * 勾选后明文落盘，同源脚本与浏览器扩展均可读取，属于用户显式承担的风险。
   */
  rememberKey: boolean
  /**
   * 是否把对话历史持久化到 localStorage。
   * 默认 false —— 对话只留在当前标签页内存中，避免聊天内容被无提示长期留存。
   */
  rememberHistory: boolean
}

const STORAGE_KEY = 'nomoney_ai_cfg'
/** 用户显式选择"记住 Key"后才写这里；否则 Key 只在内存中，关标签页即失效 */
const KEY_STORE_KEY = 'nomoney_ai_key'
const LEGACY_KEY_STORE_KEY = 'flexcalc_ai_key'
const HISTORY_KEY = 'nomoney_chat_hist'
const LEGACY_HISTORY_KEY = 'flexcalc_chat_hist'
/** 标记「上次删除历史未成功」，重启后据此继续告警，无需扫描历史内容 */
const PENDING_DELETE_KEY = 'nomoney_chat_hist_pending_delete'

/** 单条消息与历史总长上限，防止异常响应撑爆 localStorage 配额 */
const MAX_MSG_CHARS = 4000
const MAX_HISTORY = 50

const DEFAULT_CONFIG: ApiConfig = {
  endpoint: 'https://api.deepseek.com/v1/chat/completions',
  apiKey: '',
  model: 'deepseek-chat',
  enabled: false,
  rememberKey: false,
  rememberHistory: false,
}

interface LoadedConfig {
  config: ApiConfig
  warning: string | null
}

function removeAndVerify(key: string): boolean {
  try {
    localStorage.removeItem(key)
    return localStorage.getItem(key) === null
  } catch {
    return false
  }
}

function loadConfig(): LoadedConfig {
  let warning: string | null = null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) as Partial<ApiConfig> : {}
    const cfg: ApiConfig = { ...DEFAULT_CONFIG, ...parsed }
    // 配置形状校验：localStorage 可被同源脚本或用户手改，endpoint/key 类型错会直接崩在 fetch
    if (typeof cfg.endpoint !== 'string' || typeof cfg.model !== 'string') return { config: { ...DEFAULT_CONFIG }, warning: null }
    if (typeof cfg.enabled !== 'boolean') cfg.enabled = false
    if (typeof cfg.rememberKey !== 'boolean') cfg.rememberKey = false
    if (typeof cfg.rememberHistory !== 'boolean') cfg.rememberHistory = false
    cfg.apiKey = ''
    if (cfg.rememberKey) {
      const current = localStorage.getItem(KEY_STORE_KEY)
      const legacy = current ? null : localStorage.getItem(LEGACY_KEY_STORE_KEY)
      cfg.apiKey = current ?? legacy ?? ''
      if (!current && legacy) {
        try {
          localStorage.setItem(KEY_STORE_KEY, legacy)
          if (localStorage.getItem(KEY_STORE_KEY) !== legacy || !removeAndVerify(LEGACY_KEY_STORE_KEY)) {
            warning = '旧版 API Key 未能完全迁移，请检查本地存储'
          }
        } catch {
          warning = '旧版 API Key 未能迁移，当前会话仍可使用'
        }
      }
    } else {
      const currentRemoved = removeAndVerify(KEY_STORE_KEY)
      const legacyRemoved = removeAndVerify(LEGACY_KEY_STORE_KEY)
      if (!currentRemoved || !legacyRemoved) {
        warning = '本机保存的 API Key 未能完全清除，请检查浏览器存储权限'
      }
    }
    return { config: cfg, warning }
  } catch {
    return { config: { ...DEFAULT_CONFIG }, warning: '本地 AI 配置无法读取，当前使用默认设置' }
  }
}

/** 是否全部写盘成功；隐私模式/配额耗尽返回 false；UI 必须如实告知 */
function saveConfig(cfg: ApiConfig): boolean {
  // endpoint/model/enabled 可安全持久化；Key 单独处理，不随配置对象一起落盘
  const { apiKey: _omit, ...safe } = cfg
  let ok = true
  if (cfg.rememberKey) {
    try {
      localStorage.setItem(KEY_STORE_KEY, cfg.apiKey)
      if (localStorage.getItem(KEY_STORE_KEY) !== cfg.apiKey) ok = false
      else if (!removeAndVerify(LEGACY_KEY_STORE_KEY)) ok = false
    } catch { ok = false }
  } else {
    const currentRemoved = removeAndVerify(KEY_STORE_KEY)
    const legacyRemoved = removeAndVerify(LEGACY_KEY_STORE_KEY)
    if (!currentRemoved || !legacyRemoved) ok = false
  }
  if (ok) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(safe)) } catch { ok = false }
  }
  return ok
}

function isValidMessage(m: unknown): m is ChatMessage {
  if (!m || typeof m !== 'object') return false
  const o = m as Record<string, unknown>
  return typeof o.id === 'string'
    && (o.role === 'user' || o.role === 'assistant')
    && typeof o.content === 'string'
    && typeof o.timestamp === 'number'
    && Number.isFinite(o.timestamp)
}

function normalizeMessage(m: ChatMessage): ChatMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content.slice(0, MAX_MSG_CHARS),
    timestamp: m.timestamp,
    ...(m.source ? { source: m.source } : {}),
  }
}

function welcomeMessage(): ChatMessage {
  return { id: 'welcome', role: 'assistant', content: '你好！我是没钱 AI 助手。我已读取你当前的数据，可以帮你分析收入结构、税务优化、社保规划、风险评估等。直接输入问题即可，也可以点击下方快捷问题。', timestamp: Date.now() }
}

function readStoredHistory(key: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidMessage).slice(-MAX_HISTORY).map(normalizeMessage)
  } catch {
    return []
  }
}

function clearStoredHistory(): boolean {
  const current = removeAndVerify(HISTORY_KEY)
  const legacy = removeAndVerify(LEGACY_HISTORY_KEY)
  return current && legacy
}

function loadStoredHistory(): ChatMessage[] {
  const combined = [...readStoredHistory(LEGACY_HISTORY_KEY), ...readStoredHistory(HISTORY_KEY)]
  const byId = new Map(combined.map(message => [message.id, message]))
  return [...byId.values()].slice(-MAX_HISTORY)
}

function loadHistory(rememberHistory: boolean): ChatMessage[] {
  if (!rememberHistory) return [welcomeMessage()]
  const stored = loadStoredHistory()
  return stored.length > 0 ? stored : [welcomeMessage()]
}

function hasPendingDeletion(): boolean | null {
  try {
    return localStorage.getItem(PENDING_DELETE_KEY) === '1'
  } catch {
    return null
  }
}

function markPendingDeletion(pending: boolean): boolean {
  try {
    if (pending) localStorage.setItem(PENDING_DELETE_KEY, '1')
    else localStorage.removeItem(PENDING_DELETE_KEY)
    return hasPendingDeletion() === pending
  } catch {
    return false
  }
}

export function useAIChat() {
  const loaded = loadConfig()
  const pendingDeletion = hasPendingDeletion()
  const config = ref<ApiConfig>({ ...loaded.config, rememberHistory: loaded.config.rememberHistory && pendingDeletion === false })
  const persistedRememberHistory = ref(loaded.config.rememberHistory)
  const persistedRememberKey = ref(loaded.config.rememberKey)
  const messages = ref<ChatMessage[]>(loadHistory(config.value.rememberHistory))
  const isStreaming = ref(false)
  const isOnline = ref(navigator.onLine)
  const showSettings = ref(false)
  // 上次删除历史未成功时必须继续告警，不能静默；只读一个标记键，不触碰历史内容
  const storageWarning = ref<string | null>(
    pendingDeletion === null
      ? '无法读取历史删除状态，已停止读取和保存历史，请检查浏览器存储权限'
      : pendingDeletion
        ? '本机历史对话可能尚未清除，请检查浏览器存储权限后再次点击「清除对话」'
        : loaded.warning,
  )
  const controller = ref<AbortController | null>(null)
  let requestVersion = 0

  const setOnline = () => { isOnline.value = true }
  const setOffline = () => { isOnline.value = false }
  window.addEventListener('online', setOnline)
  window.addEventListener('offline', setOffline)
  onScopeDispose(() => {
    requestVersion++
    controller.value?.abort()
    window.removeEventListener('online', setOnline)
    window.removeEventListener('offline', setOffline)
  })

  function saveHistory(): boolean {
    if (!config.value.rememberHistory) return true
    if (hasPendingDeletion() !== false) {
      config.value.rememberHistory = false
      storageWarning.value = '无法确认历史删除状态，已停止保存历史，请检查浏览器存储权限'
      return false
    }
    const trimmed = messages.value
      .filter(m => !m.isStreaming && !m.isError)
      .slice(-MAX_HISTORY)
      .map(normalizeMessage)
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed))
      return true
    } catch {
      return false
    }
  }

  function persistHistory(): boolean {
    const ok = saveHistory()
    if (!ok && config.value.rememberHistory) storageWarning.value = '对话历史未能保存到本机，仍保留在当前会话中'
    return ok
  }

  function mergeStoredHistory() {
    const stored = loadStoredHistory()
    if (stored.length === 0) return
    const current = messages.value.filter(message => message.id !== 'welcome' && message.id !== 'welcome2')
    const merged = [...stored, ...current]
    const seen = new Set<string>()
    messages.value = merged.filter(message => {
      if (seen.has(message.id)) return false
      seen.add(message.id)
      return true
    }).slice(-MAX_HISTORY)
  }

  /**
   * 注入提示词的上下文取自「当前方案」（scenarios[0]，按 scenarioInputs 的构造顺序恒为当前参数）。
   * 变量名不叫 best：这里并不是 comparison.best —— 首页「最优方案」可能来自「多跑2小时」
   * 等其他场景，若把当前方案当最优汇报，AI 的结论会与首页数字互相矛盾。
   */
  function buildContext(scenarios: ScenarioResult[], rule?: CityRule | null): string {
    const cur = scenarios[0]
    if (!cur) return '用户暂未测算'
    // 只给 city slug（guangzhou）模型并不知道对应哪个省，回答地方政策时容易张冠李戴；
    // 同时带上本城关键参数的置信度，模型才知道哪些数字不能当官方口径引用
    const province = provinceOf(cur.work.city) ?? '未知省份'
    const cityLabel = rule?.cityName ? `${rule.cityName}（${province}）` : `${cur.work.city}（${province}）`
    const conf = rule
      ? `本城数据置信度：养老基数=${rule.sources.pension?.confidence ?? '—'},医保=${rule.sources.medical?.confidence ?? '—'},最低工资=${rule.sources.minimumWage?.confidence ?? '—'},计价=${rule.sources.income?.confidence ?? '—'}`
      : ''
    return `城市=${cityLabel},工时=${cur.work.dailyHours}h,日单=${cur.work.dailyOrders},月工作日=${cur.work.workDaysMonth}天。月收入=¥${cur.income.grossIncome},成本=¥${cur.costBreakdown.total},月个税≈¥${Math.round(cur.tax.annualTax/12)},净收入=¥${cur.netMonthly},时薪=¥${cur.netHourly},权益评分=${cur.rightsScore}/100。${conf}。${cur.keyInsights?.join('│') || ''}`
  }

  function ruleReply(q: string, scenarios: ScenarioResult[], minWage?: number): string {
    const cur = scenarios[0]
    if (!cur) return '请先在左侧调整参数完成测算，我再帮你分析。'
    const query = q.toLowerCase()

    if (/税|省|优化/.test(query)) {
      if (cur.tax.effectiveRate > 5) return `实际税率 ${cur.tax.effectiveRate}%，税负偏高。若你具备真实经营实质（自有生产经营范围、独立建账、以自身名义承接业务）并已由税务机关核准相应征收方式，可咨询税务师核实是否适用经营所得申报；否则以劳务报酬累计预扣为准。以上为税负差异估算，不构成涉税意见。`
      return `税率仅 ${cur.tax.effectiveRate}%，已较低。保持合规申报即可。`
    }
    if (/社保|养老|退休/.test(query)) {
      return `以灵活就业身份参保，养老月缴约¥${Math.round(cur.benefit.pensionMonthly)}、医保约¥${Math.round(cur.benefit.medicalMonthly)}，合计约¥${Math.round(benefitTotal(cur))}（均由个人全额承担）。达到法定退休年龄且累计缴满最低年限后按月领取；「税务与养老 → 养老规划」页可按你自选的缴费基数与记账利率假设测算养老金，具体以社保经办核算为准。`
    }
    if (/风险|安全|危险|权益|保障/.test(query)) {
      if (scoreTier(cur.rightsScore) === 'bad') return `权益评分${cur.rightsScore}/100，保障缺口明显。建议：①工时控制在10h内②优先参加养老+医保③以商业意外险补充职业伤害缺口。`
      return `权益评分${cur.rightsScore}/100，${scoreLevel(cur.rightsScore)}。${cur.keyInsights?.[0] || ''}`
    }
    if (/建议|怎么办|好吗/.test(query)) {
      const monthly = cur.netMonthly
      // 收入档位锚定本城最低工资（与洞察文案同口径），不写死一线城市数字
      const level = !minWage
        ? '——'
        : monthly > minWage * 3 ? '高' : monthly > minWage * 2 ? '中等' : monthly > minWage ? '偏低' : '低于最低工资'
      return `当前方案月净收入¥${monthly}属${level}水平（本城最低工资 ¥${minWage ?? '—'}/月）。${cur.keyInsights?.slice(0,2).join('') || '建议保持当前节奏。'}`
    }
    // fallback: summary
    return `当前方案「${cur.name}」月净¥${cur.netMonthly}/年净¥${cur.netAnnual}。可以深入问：税务优化/社保规划/风险评估。`
  }

  function benefitTotal(s: ScenarioResult) {
    return s.benefit.items.filter(i => i.name === '养老保险' || i.name === '医疗保险').reduce((sum, i) => sum + i.monthly, 0)
  }

  /**
   * 离线知识库应答：先检索本地知识库（政策/手册/现实核查，均带官方链接），
   * 命中即按条目原文作答；未命中返回 null，由规则引擎兜底。
   */
  function kbReply(question: string, rule?: CityRule | null): string | null {
    // 检索范围必须带上本城溯源：只检索静态条目时，任何城市问「最低工资」都会
    // 命中广东的政策条目，回答里出现与用户所在省无关的数字
    const entries = [...buildStaticKbEntries(), ...citySourceEntries(rule ?? null)]
    const hits = searchKnowledge(question, { entries, limit: 3 })
    // 相关性门槛：最高分过低（只命中 1 个二元组）时宁可走规则引擎，
    // 也不要把「怎么省税」答成「怎么参保」这类不相关条目
    if (!hits.length || hits[0].score < 6) return null
    const blocks = hits.map(h => {
      const e = h.entry
      const nums = e.numbers.slice(0, 3).map(n => `${n.label} ${n.value}`).join('；')
      const doc = e.docNo ? `（${e.docNo}）` : ''
      const link = e.links[0] ? `\n原文：${e.links[0].url}` : ''
      return `【${KB_TYPE_LABELS[e.type]}】${e.title}${doc}\n${e.summary}${nums ? `\n${nums}` : ''}${link}`
    })
    return `本地知识库检索到 ${hits.length} 条相关内容（离线，附官方链接）：\n\n${blocks.join('\n\n')}\n\n提示：以上为知识库条目原文摘录；要结合你自己的数据做决策分析，请在「API 设置」启用 AI 大模型。`
  }

  async function sendOnline(question: string, context: string, version: number, rule?: CityRule | null) {
    // Authorization 头会发往用户自填的地址，校验失败必须直接拒，不发请求
    const check = validateEndpoint(config.value.endpoint)
    if (!check.ok) throw new Error(check.error ?? 'Endpoint 不合法')

    // RAG 雏形：发送前先做本地知识库检索，把命中条目作为上下文注入，
    // 降低模型编造文号/政策的概率；检索在本地完成，不额外联网。
    // 必须把本城溯源条目一起送进检索（传入 rule），否则任何城市都会检索到广东政策
    const kbCtx = kbContextForPrompt(question, 3, rule ? [...buildStaticKbEntries(), ...citySourceEntries(rule)] : undefined)

    const sysPrompt = `你是"没钱 No Money"的决策助手，面向灵活就业者（外卖骑手、网约车司机等）。根据用户当前测算数据给出具体可操作建议。硬性要求：不超过205字；只依据下列数据与用户问题作答；不得编造法律法规名称、文号、税率或政策文件；涉及法律或税务结论时必须提示以官方机构或专业人士意见为准。以下是用户数据：\n${context}${kbCtx ? `\n\n${kbCtx}` : ''}`

    // 错误气泡（isError）不进上下文：上一轮的"AI连接失败…"被模型当事实复述会污染回答
    const recentMsgs = messages.value.filter(m => !m.isStreaming && !m.isError).slice(-6).map(m => ({ role: m.role, content: m.content }))

    const abort = new AbortController()
    controller.value = abort
    isStreaming.value = true

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    // 在 try 外声明：finally 需要按 id 精确定位本次流式消息（清错消息会留下永久转圈的气泡）
    let aiId: string | undefined
    try {
      // 60 秒整体超时：端点不响应时 isStreaming 会永远为 true，
      // 输入框与发送键一直 disabled，用户只能刷新页面
      const timeout = AbortSignal.timeout(60000)
      const signal = typeof AbortSignal.any === 'function' ? AbortSignal.any([abort.signal, timeout]) : abort.signal
      const resp = await fetch(config.value.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.value.apiKey}` },
        body: JSON.stringify({
          model: config.value.model,
          messages: [{ role: 'system', content: sysPrompt }, ...recentMsgs],
          stream: true, temperature: 0.7, max_tokens: 500
        }),
        signal,
      })

      if (version !== requestVersion) {
        await resp.body?.cancel().catch(() => undefined)
        return
      }
      if (!resp.ok) {
        console.error(`[ai] HTTP ${resp.status}`)
        throw new Error(classifyApiError(resp.status))
      }

      reader = resp.body?.getReader()
      if (!reader) throw new Error('无法读取流')

      const decoder = new TextDecoder()
      let aiContent = ''
      aiId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      messages.value.push({ id: aiId, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true, source: 'ai' })

      /** 流里出现的服务端错误（部分服务商用 200 + data:{"error":…} 回错误） */
      let streamError = ''
      /** 无法解析的行数，供"有响应但读不出内容"时分类提示 */
      let malformed = 0

      const consume = (raw: string) => {
        const t = raw.trim()
        if (!t.startsWith('data:')) return
        const d = t.slice(5).trim()
        if (d === '[DONE]' || !d) return
        let parsed: unknown
        try {
          parsed = JSON.parse(d)
        } catch {
          // 非 JSON 行可能是心跳或代理包装，逐行吞掉是合理的；但要留下计数，
          // 否则"流读完却一个字都没有"时用户只看到气泡消失，无从判断原因
          malformed++
          return
        }
        const obj = parsed as { error?: { message?: string }; choices?: Array<{ delta?: { content?: string } }> }
        if (obj?.error) {
          console.error('[ai] SSE provider error')
          streamError = '模型服务返回错误'
          return
        }
        const delta = obj?.choices?.[0]?.delta?.content
        if (delta) {
          aiContent += delta
          const idx = messages.value.findIndex(m => m.id === aiId)
          if (idx >= 0) messages.value[idx].content = aiContent
        }
      }

      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (version !== requestVersion) return
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        lines.forEach(consume)
      }
      if (buf) consume(buf)

      if (streamError) throw new Error('模型服务返回错误，请稍后重试')
      if (!aiContent) {
        throw new Error(malformed > 0
          ? '模型响应格式无法解析，请重试或更换模型'
          : '模型未返回任何内容，请重试或更换模型')
      }
    } finally {
      reader?.cancel().catch(() => undefined)
      // 按 id 定位本次流式消息：此前用 isStreaming 找第一条，
      // 在并发/异常交错时会清错消息，留下永久转圈的空气泡
      const idx = aiId ? messages.value.findIndex(m => m.id === aiId) : -1
      if (idx >= 0) {
        messages.value[idx].isStreaming = false
        if (!messages.value[idx].content) messages.value.splice(idx, 1)
      }
      if (controller.value === abort) {
        isStreaming.value = false
        controller.value = null
      }
    }
  }

  function newId(prefix: string) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  }

  /** 把 HTTP 状态映射为可读文案；原始错误体由调用方打印到 console，不进 UI 与本地存储 */
  function classifyApiError(status: number) {
    if (status === 401 || status === 403) return 'API Key 无效或已过期（HTTP ' + status + '）'
    if (status === 404) return '接口地址不存在（HTTP 404），请检查 Endpoint 填写'
    if (status === 429) return '请求过于频繁或额度已用尽（HTTP 429）'
    if (status >= 500) return '模型服务商异常（HTTP ' + status + '），请稍后重试'
    if (status >= 400) return '请求被拒绝（HTTP ' + status + '），请检查 Endpoint 与模型名'
    return '连接失败（HTTP ' + status + '）'
  }

  function stopStreaming() {
    requestVersion++
    controller.value?.abort()
    controller.value = null
    isStreaming.value = false
    messages.value.forEach(m => { if (m.isStreaming) m.isStreaming = false })
  }

  async function sendMessage(question: string, scenarios: ScenarioResult[], minWageMonthly?: number, rule?: CityRule | null) {
    if (isStreaming.value) return
    const safeQuestion = question.slice(0, MAX_MSG_CHARS)
    messages.value.push({ id: newId('u'), role: 'user', content: safeQuestion, timestamp: Date.now() })
    const ctx = buildContext(scenarios, rule)
    const useAI = config.value.enabled && !!config.value.apiKey && isOnline.value

    if (useAI) {
      const version = ++requestVersion
      try {
        await sendOnline(safeQuestion, ctx, version, rule)
        if (version !== requestVersion) return
        persistHistory()
        return
      } catch (err: unknown) {
        if (version !== requestVersion || (err instanceof DOMException && err.name === 'AbortError')) return
        const msg = String(err instanceof Error ? err.message : (err ?? '未知错误')).slice(0, 200)
        messages.value.push({ id: newId('err'), role: 'assistant', content: `⚠️ AI连接失败：${msg}。已切换规则引擎：\n\n` + ruleReply(question, scenarios, minWageMonthly), timestamp: Date.now(), isError: true })
        persistHistory()
        return
      }
    }

    const version = ++requestVersion
    isStreaming.value = true
    await new Promise(r => setTimeout(r, 300 + Math.random() * 300))
    if (version !== requestVersion) return
    isStreaming.value = false
    // 意图明确的四类问题（税务/社保/风险/建议）先走规则引擎：这些回答直接基于用户
    // 当前测算数据，比知识库条目更贴合；知识库用于规则引擎覆盖不到的政策/办事问题
    const intent = /税|省|优化|社保|养老|退休|风险|安全|危险|权益|保障|建议|怎么办|好吗/.test(question)
    const kb = intent ? null : kbReply(question, rule)
    messages.value.push({
      id: newId('r'),
      role: 'assistant',
      content: kb ?? ruleReply(question, scenarios, minWageMonthly),
      timestamp: Date.now(),
      source: kb ? 'kb' : 'ai',
    })
    persistHistory()
  }

  function clearHistory(): boolean {
    stopStreaming()
    messages.value = [{ id: 'welcome2', role: 'assistant', content: '历史已清空，可以继续提问。', timestamp: Date.now() }]
    const cleared = clearStoredHistory()
    const mustKeepMarker = !cleared || (!config.value.rememberHistory && persistedRememberHistory.value)
    const marked = markPendingDeletion(mustKeepMarker)
    if (!marked) {
      config.value.rememberHistory = false
      storageWarning.value = '无法确认历史删除状态，重启后无法保证历史不会重新加载，请清除站点数据'
    } else if (!cleared) storageWarning.value = '当前对话已从内存清除，但本机历史未能完全删除，请检查浏览器存储权限'
    else if (mustKeepMarker) storageWarning.value = '本地历史已清除，但历史偏好尚未保存，请检查浏览器存储权限'
    else storageWarning.value = null
    return cleared && marked
  }

  function updateConfig(c: Partial<ApiConfig>): boolean {
    const clearingKey = c.apiKey === '' && c.rememberKey === false
    let keyWarning: string | null = null
    if (clearingKey) {
      config.value.apiKey = ''
      config.value.rememberKey = false
      const currentRemoved = removeAndVerify(KEY_STORE_KEY)
      const legacyRemoved = removeAndVerify(LEGACY_KEY_STORE_KEY)
      if (!currentRemoved || !legacyRemoved) keyWarning = '已有 API Key 未能完全删除，请清除站点数据'
    }
    const finish = (ok: boolean): boolean => {
      if (keyWarning) storageWarning.value = [storageWarning.value, keyWarning].filter(Boolean).join('；')
      return ok && !keyWarning
    }
    const previousConfig = { ...config.value }
    const previousMessages = messages.value.map(message => ({ ...message }))
    const previousRememberHistory = persistedRememberHistory.value
    const nextConfig = { ...config.value, ...c }
    const nextRememberHistory = nextConfig.rememberHistory
    const pending = hasPendingDeletion()
    const enablingHistory = nextRememberHistory && (!previousRememberHistory || pending !== false)
    const disablingHistory = !nextRememberHistory && previousRememberHistory

    if (nextRememberHistory && pending === null) {
      config.value.rememberHistory = false
      storageWarning.value = '无法读取历史删除状态，已停止读取和保存历史，请检查浏览器存储权限'
      return finish(false)
    }
    if (enablingHistory && pending && !clearStoredHistory()) {
      storageWarning.value = '本机历史未能完全删除，请检查浏览器存储权限'
      return finish(false)
    }

    if (!saveConfig(enablingHistory ? { ...nextConfig, rememberHistory: false } : nextConfig)) {
      const keyRemoved = !nextConfig.rememberKey || persistedRememberKey.value || removeAndVerify(KEY_STORE_KEY)
      if (!keyRemoved) keyWarning = '新保存的 API Key 补偿删除失败，请清除站点数据'
      config.value = { ...previousConfig, rememberKey: persistedRememberKey.value, ...(disablingHistory ? { rememberHistory: false } : {}), ...(c.apiKey === '' && c.rememberKey === false ? { apiKey: '', rememberKey: false } : {}) }
      messages.value = previousMessages
      if (disablingHistory) {
        const marked = markPendingDeletion(true)
        const cleared = clearStoredHistory()
        storageWarning.value = !marked
          ? '本地设置和删除标志未能保存，重启后无法保证历史不会重新加载，请清除站点数据'
          : cleared
            ? '本地设置未能保存，历史已删除并停止保存；重启后请检查设置'
            : '本地设置未能保存，本机历史未能完全删除，请检查浏览器存储权限'
      } else {
        storageWarning.value = !keyRemoved || (c.apiKey === '' && c.rememberKey === false)
          ? '本机 API Key 未能确认删除，请检查浏览器存储权限'
          : '本地设置未能完整保存，请检查浏览器存储权限'
      }
      return finish(false)
    }

    persistedRememberKey.value = nextConfig.rememberKey
    Object.assign(config.value, nextConfig)
    if (enablingHistory) {
      if (pending && !markPendingDeletion(false)) {
        config.value.rememberHistory = false
        storageWarning.value = '无法确认历史删除状态，已停止读取和保存历史，请检查浏览器存储权限'
        return finish(false)
      }
      mergeStoredHistory()
      if (!saveHistory()) {
        config.value = previousConfig
        messages.value = previousMessages
        storageWarning.value = '对话历史未能保存到本机，仍保留在当前会话中'
        return finish(false)
      }
      if (!saveConfig(nextConfig)) {
        config.value = previousConfig
        messages.value = previousMessages
        storageWarning.value = '对话历史已保存，但启用设置未能保存，请检查浏览器本地存储'
        return finish(false)
      }
      markPendingDeletion(false)
      if (!removeAndVerify(LEGACY_HISTORY_KEY)) {
        persistedRememberHistory.value = true
        storageWarning.value = '对话历史已保存，但旧版历史未能清理，请检查浏览器本地存储'
        return finish(false)
      }
    }
    if (disablingHistory) {
      const cleared = clearStoredHistory()
      const marked = markPendingDeletion(!cleared)
      if (!cleared || !marked) {
        storageWarning.value = !cleared && !marked
          ? '本机历史未能完全删除，删除标志也未能保存，重启后可能无法提示残留，请清除站点数据'
          : !cleared
            ? '本机历史未能完全删除，当前已停止继续读取，请检查浏览器存储权限'
            : '无法确认历史删除状态，请检查浏览器存储权限'
        return finish(false)
      }
    }
    persistedRememberHistory.value = nextRememberHistory
    const remainingPending = hasPendingDeletion()
    storageWarning.value = remainingPending === null
      ? '无法读取历史删除状态，已停止读取和保存历史，请检查浏览器存储权限'
      : remainingPending
        ? '本机历史对话可能尚未清除，请检查浏览器存储权限后再次点击「清除对话」'
        : null
    if (remainingPending !== false) config.value.rememberHistory = false
    return finish(true)
  }

  return { config, messages, isStreaming, isOnline, showSettings, storageWarning, clearHistory, updateConfig, stopStreaming, sendMessage }
}
