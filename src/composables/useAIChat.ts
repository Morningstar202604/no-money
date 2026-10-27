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
}

const STORAGE_KEY = 'nomoney_ai_cfg'
/** 用户显式选择"记住 Key"后才写这里；否则 Key 只在内存中，关标签页即失效 */
const KEY_STORE_KEY = 'nomoney_ai_key'
const HISTORY_KEY = 'nomoney_chat_hist'

/** 单条消息与历史总长上限，防止异常响应撑爆 localStorage 配额 */
const MAX_MSG_CHARS = 4000
const MAX_HISTORY = 50

const DEFAULT_CONFIG: ApiConfig = {
  endpoint: 'https://api.deepseek.com/v1/chat/completions',
  apiKey: '',
  model: 'deepseek-chat',
  enabled: false,
  rememberKey: false,
}

function loadConfig(): ApiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) as Partial<ApiConfig> : {}
    const cfg: ApiConfig = { ...DEFAULT_CONFIG, ...parsed }
    // 配置形状校验：localStorage 可被同源脚本或用户手改，endpoint/key 类型错会直接崩在 fetch
    if (typeof cfg.endpoint !== 'string' || typeof cfg.model !== 'string') return { ...DEFAULT_CONFIG }
    if (typeof cfg.enabled !== 'boolean') cfg.enabled = false
    if (typeof cfg.rememberKey !== 'boolean') cfg.rememberKey = false
    cfg.apiKey = ''
    if (cfg.rememberKey) {
      try { cfg.apiKey = localStorage.getItem(KEY_STORE_KEY) ?? '' } catch { /* 存储不可用则保持不记住 */ }
    }
    return cfg
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

/** @returns 是否全部写盘成功；隐私模式/配额耗尽返回 false，UI 必须如实告知 */
function saveConfig(cfg: ApiConfig): boolean {
  // endpoint/model/enabled 可安全持久化；Key 单独处理，不随配置对象一起落盘
  const { apiKey: _omit, ...safe } = cfg
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe))
    if (cfg.rememberKey) localStorage.setItem(KEY_STORE_KEY, cfg.apiKey)
    else localStorage.removeItem(KEY_STORE_KEY)
    return true
  } catch { return false }
}

function isValidMessage(m: unknown): m is ChatMessage {
  if (!m || typeof m !== 'object') return false
  const o = m as Record<string, unknown>
  return typeof o.id === 'string'
    && (o.role === 'user' || o.role === 'assistant')
    && typeof o.content === 'string'
}

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // 形状校验：防止注入伪造的 assistant 轮次被长期展示为权威建议
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(isValidMessage).slice(-MAX_HISTORY)
        if (valid.length) return valid
      }
    }
  } catch { /* ignore */ }
  return [{ id: 'welcome', role: 'assistant', content: '你好！我是没钱 AI 助手。我已读取你当前的数据，可以帮你分析收入结构、税务优化、社保规划、风险评估等。直接输入问题即可，也可以点击下方快捷问题。', timestamp: Date.now() }]
}

export function useAIChat() {
  const config = ref<ApiConfig>(loadConfig())
  const messages = ref<ChatMessage[]>(loadHistory())
  const isStreaming = ref(false)
  const isOnline = ref(navigator.onLine)
  const showSettings = ref(false)
  const controller = ref<AbortController | null>(null)

  const setOnline = () => { isOnline.value = true }
  const setOffline = () => { isOnline.value = false }
  window.addEventListener('online', setOnline)
  window.addEventListener('offline', setOffline)
  onScopeDispose(() => {
    controller.value?.abort()
    window.removeEventListener('online', setOnline)
    window.removeEventListener('offline', setOffline)
  })

  function saveHistory() {
    const trimmed = messages.value.slice(-MAX_HISTORY).map(m => ({ ...m, content: m.content.slice(0, MAX_MSG_CHARS) }))
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed))
    } catch { /* 隐私模式或配额耗尽时静默降级为不持久化 */ }
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

  async function sendOnline(question: string, context: string, rule?: CityRule | null) {
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
          messages: [{ role: 'system', content: sysPrompt }, ...recentMsgs, { role: 'user', content: question }],
          stream: true, temperature: 0.7, max_tokens: 500
        }),
        signal,
      })

      if (!resp.ok) {
        // 服务端错误体可能回显请求内容，不把原文渲染进气泡，只做本地化分类
        const detail = await resp.text().catch(() => '')
        throw new Error(classifyApiError(resp.status, detail))
      }

      reader = resp.body?.getReader()
      if (!reader) throw new Error('无法读取流')

      const decoder = new TextDecoder()
      let aiContent = ''
      aiId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      messages.value.push({ id: aiId, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true, source: 'ai' })

      /** 流里出现的服务端错误（部分服务商用 200 + data:{"error":…} 回错误） */
      let streamError = ''
      /** 无法解析的行数与可诊断样本，供"有响应但读不出内容"时报出原因 */
      let malformed = 0
      let malformedSample = ''

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
          if (!malformedSample) malformedSample = d.slice(0, 120)
          return
        }
        const obj = parsed as { error?: { message?: string }; choices?: Array<{ delta?: { content?: string } }> }
        if (obj?.error) {
          // 服务商错误必须浮出水面：此前被当成普通行忽略，表现为"AI 不说话"
          streamError = obj.error.message || '模型服务返回了错误'
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
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        lines.forEach(consume)
      }
      if (buf) consume(buf)

      if (streamError) throw new Error(`模型服务返回错误：${streamError}`)
      if (!aiContent) {
        // 有响应但没有任何可用内容：报出可诊断信息，而不是静默留空
        throw new Error(malformed > 0
          ? `响应格式无法解析（${malformed} 行非标准 SSE，样本：${malformedSample}）`
          : '模型未返回任何内容，请重试或更换模型')
      }
      saveHistory()
    } finally {
      reader?.cancel().catch(() => undefined)
      // 按 id 定位本次流式消息：此前用 isStreaming 找第一条，
      // 在并发/异常交错时会清错消息，留下永久转圈的空气泡
      const idx = aiId ? messages.value.findIndex(m => m.id === aiId) : -1
      if (idx >= 0) {
        messages.value[idx].isStreaming = false
        if (!messages.value[idx].content) messages.value.splice(idx, 1)
      }
      isStreaming.value = false
      controller.value = null
    }
  }

  function newId(prefix: string) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  }

  /** 把 HTTP 状态映射为可读文案；原始错误体仅留在 console，不进 UI 与本地存储 */
  function classifyApiError(status: number, detail: string) {
    if (status === 401 || status === 403) return 'API Key 无效或已过期（HTTP ' + status + '）'
    if (status === 404) return '接口地址不存在（HTTP 404），请检查 Endpoint 填写'
    if (status === 429) return '请求过于频繁或额度已用尽（HTTP 429）'
    if (status >= 500) return '模型服务商异常（HTTP ' + status + '），请稍后重试'
    if (status >= 400) return '请求被拒绝（HTTP ' + status + '），请检查 Endpoint 与模型名'
    return '连接失败（HTTP ' + status + '）'
  }

  function stopStreaming() {
    controller.value?.abort()
    controller.value = null
    isStreaming.value = false
    messages.value.forEach(m => { if (m.isStreaming) m.isStreaming = false })
  }

  async function sendMessage(question: string, scenarios: ScenarioResult[], minWageMonthly?: number, rule?: CityRule | null) {
    if (isStreaming.value) return
    messages.value.push({ id: newId('u'), role: 'user', content: question, timestamp: Date.now() })
    const ctx = buildContext(scenarios, rule)
    const useAI = config.value.enabled && !!config.value.apiKey && isOnline.value

    if (useAI) {
      try {
        await sendOnline(question, ctx, rule)
        return
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const msg = String(err instanceof Error ? err.message : (err ?? '未知错误')).slice(0, 200)
        messages.value.push({ id: newId('err'), role: 'assistant', content: `⚠️ AI连接失败：${msg}。已切换规则引擎：\n\n` + ruleReply(question, scenarios, minWageMonthly), timestamp: Date.now(), isError: true })
        saveHistory()
        return
      }
    }

    isStreaming.value = true
    await new Promise(r => setTimeout(r, 300 + Math.random() * 300))
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
    saveHistory()
  }

  function clearHistory() {
    stopStreaming()
    messages.value = [{ id: 'welcome2', role: 'assistant', content: '历史已清空。可以继续提问。', timestamp: Date.now() }]
    saveHistory()
  }

  function updateConfig(c: Partial<ApiConfig>): boolean { Object.assign(config.value, c); return saveConfig(config.value) }

  return { config, messages, isStreaming, isOnline, showSettings, sendMessage, stopStreaming, clearHistory, updateConfig }
}
