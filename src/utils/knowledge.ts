/**
 * 知识库（Agent-ready Knowledge Base）
 *
 * 把产品里的四层内容聚合成一种统一、稳定、可检索的条目结构，一份数据三处用：
 *   1. 页面内「知识库」页签：本地全文检索（离线可用，不依赖任何后端）；
 *   2. AI 助手：发送前先做本地检索，把命中的条目作为上下文注入提示词（RAG 雏形）；
 *   3. 导出 public/knowledge/kb.json（scripts/export-kb.ts 生成），供外部 Agent / RAG 管道直接摄取。
 *
 * 稳定性契约（对外部摄取方生效）：
 *   - id 一经发布不得复用/改义；条目删除即删除，不做静默置换；
 *   - type / category 是稳定枚举；新增分类只允许追加；
 *   - links[].url 均为收录时核验过的官方原文；不得写入未核验链接；
 *   - schemaVersion 变化时才允许字段增删（当前 v1）。
 *
 * 全部为纯函数与静态数据，无网络依赖；单测见 tests/knowledge.spec.ts。
 */

import type { CityRule } from '../types'
import { POLICIES, RELIEF_GUIDE } from '../data/policies'
import { REALITY_FACTS, REALITY_CATEGORY_LABELS, EVIDENCE_LABELS } from './reality'
import { GUIDE_ITEMS, GUIDE_GROUP_LABELS } from './livingGuide'

export type KbEntryType = 'policy' | 'guide' | 'reality' | 'source'

export interface KbLink {
  title: string
  url: string
}

export interface KbEntry {
  id: string
  type: KbEntryType
  /** 中文分类（政策层级 / 手册分组 / 现实分类 / 溯源） */
  category: string
  title: string
  summary: string
  keyPoints: string[]
  numbers: { label: string; value: string }[]
  steps: string[]
  /** 附加说明（依据 / 自验路径 / 注意事项等） */
  notes: string[]
  docNo?: string
  status?: string
  confidence?: string
  city?: string
  tags: string[]
  links: KbLink[]
}

export const KB_TYPE_LABELS: Record<KbEntryType, string> = {
  policy: '政策',
  guide: '手册',
  reality: '现实',
  source: '溯源',
}

/** 静态条目：政策、手册、现实核查（编译期数据） */
export function buildStaticKbEntries(): KbEntry[] {
  const entries: KbEntry[] = []

  const policyToEntry = (p: (typeof POLICIES)['national'][number], scope: 'national' | 'guangdong'): KbEntry => ({
    id: `policy-${scope === 'national' ? 'national' : 'gd'}-${p.id}`,
    type: 'policy',
    category: scope === 'national' ? '国家级政策' : '广东省政策',
    title: p.title,
    summary: p.summary,
    keyPoints: [],
    numbers: [],
    steps: [],
    notes: p.caveat ? [p.caveat] : [],
    docNo: p.docNo,
    status: p.status,
    tags: ['政策', scope === 'national' ? '国家级' : '广东省'],
    links: p.url ? [{ title: '原文', url: p.url }] : [],
  })

  POLICIES.national.forEach(p => entries.push(policyToEntry(p, 'national')))
  POLICIES.guangdong.forEach(p => entries.push(policyToEntry(p, 'guangdong')))

  RELIEF_GUIDE.forEach((g, i) => {
    entries.push({
      id: `relief-${i + 1}`,
      type: 'guide',
      category: '权益救济',
      title: g.title,
      summary: g.steps[0] ?? '',
      keyPoints: [],
      numbers: [],
      steps: g.steps,
      notes: [],
      tags: ['维权', '救济'],
      links: [],
    })
  })

  GUIDE_ITEMS.forEach(item => {
    entries.push({
      id: `guide-${item.id}`,
      type: 'guide',
      category: GUIDE_GROUP_LABELS[item.group],
      title: item.question,
      summary: item.oneLiner,
      keyPoints: item.keyPoints ?? [],
      numbers: item.numbers ?? [],
      steps: item.steps ?? [],
      notes: [...(item.caution ? [item.caution] : []), ...(item.toolHint ? [item.toolHint] : [])],
      tags: ['手册', item.group],
      links: item.links,
    })
  })

  REALITY_FACTS.forEach(f => {
    entries.push({
      id: `reality-${f.id}`,
      type: 'reality',
      category: REALITY_CATEGORY_LABELS[f.category],
      title: f.title,
      summary: f.detail,
      keyPoints: [],
      numbers: [],
      steps: [],
      notes: [...(f.source ? [`依据：${f.source}`] : []), ...(f.verify ? [`自验：${f.verify}`] : [])],
      confidence: EVIDENCE_LABELS[f.evidence],
      tags: ['现实核查', f.evidence],
      links: f.links ?? [],
    })
  })

  return entries
}

/** 本城规则溯源条目：随加载的城市规则动态附加 */
export function citySourceEntries(rule: Pick<CityRule, 'city' | 'cityName' | 'sources'> | null): KbEntry[] {
  if (!rule?.sources) return []
  return Object.entries(rule.sources).map(([key, s]) => ({
    id: `src-${rule.city}-${key}`,
    type: 'source' as const,
    category: '本城规则溯源',
    title: s.title,
    summary: s.note ?? '',
    keyPoints: [],
    numbers: [],
    steps: [],
    notes: [
      ...(s.issuedBy ? [s.issuedBy] : []),
      ...(s.effectiveFrom ? [`生效：${s.effectiveFrom}`] : []),
      // 「核对于」只对真正打开过原文的条目成立；unverified 只是录入占位
      `${s.confidence === 'unverified' ? '登记于' : '核对于'} ${s.retrievedAt}`,
    ],
    docNo: s.docNo,
    confidence: s.confidence,
    city: rule.city,
    tags: ['溯源', rule.cityName],
    links: s.url ? [{ title: '原文', url: s.url }] : [],
  }))
}

/** 供 export-kb 脚本打包给外部 Agent 摄取的全量负载 */
export interface KbPayload {
  schemaVersion: 1
  app: string
  generatedAt: string
  counts: Record<KbEntryType, number>
  entries: KbEntry[]
}

export function buildKbPayload(allCityRules: CityRule[], generatedAt: string): KbPayload {
  const entries = [
    ...buildStaticKbEntries(),
    ...allCityRules.flatMap(r => citySourceEntries(r)),
  ]
  const counts: Record<KbEntryType, number> = { policy: 0, guide: 0, reality: 0, source: 0 }
  for (const e of entries) counts[e.type]++
  return { schemaVersion: 1, app: '没钱 No Money', generatedAt, counts, entries }
}

/* ============================== 本地检索 ============================== */

export interface KbHit {
  entry: KbEntry
  score: number
  snippet: string
}

const HAY_CACHE = new WeakMap<KbEntry, { title: string; hay: string }>()

function haystackOf(e: KbEntry): { title: string; hay: string } {
  const cached = HAY_CACHE.get(e)
  if (cached) return cached
  const title = e.title.toLowerCase()
  const parts = [
    e.title, e.summary, e.category, e.docNo ?? '', e.confidence ?? '', e.status ?? '',
    ...e.keyPoints, ...e.numbers.map(n => `${n.label} ${n.value}`), ...e.steps, ...e.notes, ...e.tags,
  ]
  const hay = parts.join('\n').toLowerCase()
  const v = { title, hay }
  HAY_CACHE.set(e, v)
  return v
}

/** 查询分词：ASCII 词 + CJK 二元组（不做完整分词，覆盖中文检索的主要场景）；标点会切断 CJK 词段，天然容错 */
export function tokenizeQuery(q: string): { phrases: string[]; bigrams: string[] } {
  const norm = q.trim().toLowerCase()
  if (!norm) return { phrases: [], bigrams: [] }
  const phrases = [...new Set(norm.match(/[a-z0-9]{2,}/g) ?? [])]
  const cjkRuns = norm.match(/[\u4e00-\u9fff]+/g) ?? []
  const bigrams = new Set<string>()
  for (const run of cjkRuns) {
    if (run.length === 1) { bigrams.add(run); continue }
    for (let i = 0; i < run.length - 1; i++) bigrams.add(run.slice(i, i + 2))
  }
  return { phrases, bigrams: [...bigrams] }
}

/* ---------- 口语词同义词表 ----------
 * 键：口语/黑话触发词，查询里原样出现即命中；
 * 值：知识库文本里实际存在的标准词——由 tests/knowledge.spec.ts 的
 *     「同义词目标必须真实存在于当前条目」断言守护，条目删改后留下永远无法命中的
 *     死同义词会在测试里被拦下，而不是静默腐化。
 * 用途：searchKnowledge 在原始分词之外附加这批目标词（SYNONYM_WEIGHT 降权，只补召回不抢排位），
 *       让「收钱」「被坑」「套路」级别的口语查询不必靠把口语词逐条写进条目文本来兜底。
 */
export const SYNONYMS: Record<string, string[]> = {
  // 收费 / 骗局（「哪些是潜规则」的主力词条）
  收钱: ['收费', '押金', '保证金', '学费'],
  被骗: ['骗', '骗局', '信用', '单方'],
  被坑: ['骗', '骗局', '收费', '押金', '单方'],
  坑人: ['骗', '骗局', '收费', '单方'],
  坑: ['骗', '骗局', '押金', '单方'],
  套路: ['骗', '骗局', '收费', '单方', '违约金'],
  猫腻: ['单方', '投诉', '骗'],
  诈骗: ['骗', '骗局', '收费'],
  骗子公司: ['骗局', '骗', '信用'],
  // 押金 / 保证金
  定金: ['押金', '保证金'],
  订金: ['押金', '保证金'],
  退费: ['学费', '押金', '违约金'],
  手续费: ['费率', '收费', '抽成'],
  // 扣款 / 罚款
  扣钱: ['扣款', '罚款'],
  克扣: ['扣款', '罚款', '欠薪'],
  // 抽成 / 佣金
  抽佣: ['抽成', '费率', '单价'],
  抽点: ['抽成', '费率'],
  提成: ['抽成', '单价', '费率'],
  // 拖欠 / 跑路
  拖工资: ['拖欠', '欠薪'],
  拖欠工资: ['拖欠', '欠薪', '投诉', '仲裁'],
  不发工资: ['拖欠', '欠薪', '投诉'],
  跑路: ['信用', '欠薪', '拖欠'],
  // 工资 / 行情
  月薪: ['工资', '基准', '最低工资'],
  月入: ['工资', '基准', '最低工资'],
  行情: ['平均工资', '中位', '基准'],
  工资正常: ['基准', '中位', '最低工资'],
  // 税务
  交税: ['个税', '核定', '税率', '免税'],
  偷税: ['核定', '税'],
  逃税: ['核定', '免税', '汇算', '抵扣'],
  避税: ['核定', '免税', '抵扣', '专项'],
  // 合同 / 口头
  口头约定: ['口头', '书面', '合同', '协议'],
  没签: ['合同', '协议', '承揽', '书面'],
}

/** 同义词相对直接分词的降权系数：扩展只补召回，不抢直接词汇命中的排位 */
const SYNONYM_WEIGHT = 0.75

/** 查询展开：原始分词 + 命中的同义词表目标词（与查询自带分词去重，避免双重计分） */
export function expandQuery(norm: string): { phrases: string[]; bigrams: string[]; synTargets: string[] } {
  const q = norm.trim().toLowerCase()
  const base = tokenizeQuery(q)
  const baseSet = new Set([...base.phrases, ...base.bigrams])
  const targets = new Set<string>()
  for (const [k, list] of Object.entries(SYNONYMS)) {
    if (!q.includes(k)) continue
    for (const t of list) if (!baseSet.has(t)) targets.add(t)
  }
  return { ...base, synTargets: [...targets] }
}

/** 死同义词检测：返回 SYNONYMS 目标词里已不存在于给定条目正文的映射（条目删改后防静默腐化） */
export function missingSynonymTargets(entries: KbEntry[] = buildStaticKbEntries()): string[] {
  const hay = entries.map(e => haystackOf(e).hay).join('\n')
  const missing: string[] = []
  for (const [k, list] of Object.entries(SYNONYMS)) {
    for (const t of list) if (!hay.includes(t)) missing.push(`${k} → ${t}`)
  }
  return missing
}

function countOccurrences(text: string, needle: string, cap = 3): number {
  let count = 0
  let idx = text.indexOf(needle)
  while (idx !== -1 && count < cap) {
    count++
    idx = text.indexOf(needle, idx + needle.length)
  }
  return count
}

function snippetFor(e: KbEntry, tokens: string[]): string {
  const fields = [e.summary, ...e.keyPoints, ...e.steps]
  for (const probe of tokens) {
    for (const f of fields) {
      const idx = f.toLowerCase().indexOf(probe)
      if (idx >= 0) {
        const start = Math.max(0, idx - 18)
        const text = f.slice(start, start + 90)
        return (start > 0 ? '…' : '') + text + (start + 90 < f.length ? '…' : '')
      }
    }
  }
  return e.summary.slice(0, 90) + (e.summary.length > 90 ? '…' : '')
}

export function searchKnowledge(
  query: string,
  opts: { limit?: number; entries?: KbEntry[]; type?: KbEntryType } = {},
): KbHit[] {
  const limit = opts.limit ?? 8
  const entries = opts.entries ?? buildStaticKbEntries()
  const norm = query.trim().toLowerCase()
  if (!norm) return []
  const { phrases, bigrams, synTargets } = expandQuery(norm)
  if (!phrases.length && !bigrams.length && !synTargets.length) return []

  const hits: KbHit[] = []
  for (const e of entries) {
    if (opts.type && e.type !== opts.type) continue
    const { title, hay } = haystackOf(e)
    let score = 0
    if (norm.length >= 2) {
      if (title.includes(norm)) score += 8
      else if (hay.includes(norm)) score += 3
    }
    for (const p of phrases) score += countOccurrences(title, p) * 2 + countOccurrences(hay, p)
    for (const b of bigrams) score += countOccurrences(title, b) * 1.5 + countOccurrences(hay, b)
    // 同义词扩展：降权计分，保证直接词汇命中的条目仍排在扩展命中之前
    for (const t of synTargets) {
      score += SYNONYM_WEIGHT * (countOccurrences(title, t) * 2 + countOccurrences(hay, t))
    }
    if (score > 0) hits.push({ entry: e, score: Math.round(score * 10) / 10, snippet: snippetFor(e, [...phrases, ...bigrams]) })
  }

  hits.sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
  return hits.slice(0, limit)
}

/** 给 AI 提示词的紧凑上下文：只保留最相关字段，控制注入体积 */
export function kbContextForPrompt(question: string, limit = 3, entries?: KbEntry[]): string {
  const hits = searchKnowledge(question, { limit, entries })
  if (!hits.length) return ''
  const blocks = hits.map(h => {
    const e = h.entry
    const lines = [
      `[${KB_TYPE_LABELS[e.type]}] ${e.title}`,
      e.summary,
      ...e.keyPoints.slice(0, 3),
      ...(e.numbers.length ? [e.numbers.slice(0, 4).map(n => `${n.label}=${n.value}`).join('；')] : []),
      ...(e.links[0] ? [`原文：${e.links[0].url}`] : []),
    ].filter(Boolean)
    return lines.join('\n')
  })
  return `【本地知识库检索结果，可能与问题相关；若无关请忽略，不得据此编造】\n${blocks.join('\n---\n')}`
}
