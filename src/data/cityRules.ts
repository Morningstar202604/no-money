/**
 * 34 城规则的唯一加载与统计入口。
 *
 * /admin 和 /audit 以前各自 fetch city-index.json，各自维护一份 fallback 城市列表，
 * 结果一份是 38 个 id（含 4 个错误的旧别名），另一份只有 8 个。索引文件缺失时，
 * 两个页面的城市数量与覆盖率分母就会漂移。这里把加载、兜底和统计收到一处：
 *
 * - 索引完整（正好覆盖 CITY_REGISTRY 的 34 城）才用索引，否则回退到注册表；
 * - 所有页面共用同一套“全库条目 / 7 项核心字段”统计；
 * - 每个覆盖率都带分子、分母、百分比，页面上不再出现没有分母说明的“官方覆盖率”。
 */
import { CITY_REGISTRY } from './cities'

export interface CityRuleSource {
  confidence?: string
  title?: string
  [key: string]: unknown
}

export interface CityRule {
  city: string
  cityName: string
  year?: number
  lastCheckedAt?: string
  verified?: boolean
  sources?: Record<string, CityRuleSource>
}

/** 只依赖 Response 的 ok/json，方便单元测试传入假 fetch。 */
export type CityRuleFetcher = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>

/** 索引不可用时的兜底顺序；注册表是唯一来源，不再各自写死城市数组。 */
export const CITY_FALLBACK_IDS = CITY_REGISTRY.map((city) => city.value)

/** /audit 的 7 项核心字段，也是“核心官方率”的分母口径。 */
export const CORE_COVERAGE_FIELDS = [
  { key: 'pension', label: '养老缴费基数' },
  { key: 'retirement', label: '养老金计发基数' },
  { key: 'minimumWage', label: '最低工资' },
  { key: 'medical', label: '医保缴费基数' },
  { key: 'medicalRate', label: '医保费率' },
  { key: 'tax', label: '个税税率表' },
  { key: 'income', label: '平台计价' },
] as const

export type CoreCoverageKey = (typeof CORE_COVERAGE_FIELDS)[number]['key']

export interface Coverage {
  numerator: number
  denominator: number
  percent: number
}

export interface CityRuleRow {
  id: string
  name: string
  year?: number
  totalSources: number
  official: number
  derived: number
  unverified: number
  officialRatio: number
  coreOfficial: number
  coreDerived: number
  coreGaps: number
  core: Record<CoreCoverageKey, string | undefined>
  missingCoreFields: string[]
}

export interface CityRuleSummary {
  rows: CityRuleRow[]
  totals: {
    cities: number
    sources: number
    official: number
    derived: number
    unverified: number
    coreFields: number
    coreOfficial: number
    coreDerived: number
    coreGaps: number
  }
  /** 全库溯源条目（每城 10–12 条），用于 /admin 的置信度分布 */
  sourceCoverage: Coverage
  /** 34 城 × 7 项核心字段，用于 /audit 的矩阵 */
  coreCoverage: Coverage
}

export interface CityRuleLoadResult {
  ids: string[]
  rules: CityRule[]
  missing: string[]
  usedRegistryFallback: boolean
}

function coverageOf(numerator: number, denominator: number): Coverage {
  return {
    numerator,
    denominator,
    percent: denominator ? Math.round((numerator / denominator) * 100) : 0,
  }
}

function normalizeIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(
    raw
      .filter((id): id is string => typeof id === 'string')
      .map((id) => id.trim())
      .filter(Boolean),
  )]
}

function isCompleteIndex(ids: string[]): boolean {
  if (ids.length !== CITY_FALLBACK_IDS.length) return false
  const set = new Set(ids)
  return CITY_FALLBACK_IDS.every((id) => set.has(id))
}

function withBase(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

async function loadCityRuleIds(
  baseUrl: string,
  fetcher: CityRuleFetcher,
): Promise<{ ids: string[]; usedRegistryFallback: boolean }> {
  const base = withBase(baseUrl)
  try {
    const res = await fetcher(`${base}city-index.json`)
    if (res.ok) {
      const ids = normalizeIds(await res.json())
      if (isCompleteIndex(ids)) return { ids, usedRegistryFallback: false }
    }
  } catch {
    /* 索引读取失败不是致命错误：注册表里本来就有完整的 34 城 */
  }
  return { ids: [...CITY_FALLBACK_IDS], usedRegistryFallback: true }
}

export async function loadCityRules(
  baseUrl = '/',
  fetcher: CityRuleFetcher = (url) => fetch(url),
): Promise<CityRuleLoadResult> {
  const { ids, usedRegistryFallback } = await loadCityRuleIds(baseUrl, fetcher)
  const base = withBase(baseUrl)

  const loaded = await Promise.all(ids.map(async (id) => {
    try {
      const res = await fetcher(`${base}rules/${id}.json`)
      if (!res.ok) return null
      const raw = await res.json()
      if (!raw || typeof raw !== 'object') return null
      const rule = raw as CityRule
      if (typeof rule.city !== 'string' || !rule.city) return null
      return rule
    } catch {
      return null
    }
  }))

  const rules: CityRule[] = []
  const missing: string[] = []
  loaded.forEach((rule, index) => {
    if (rule) rules.push(rule)
    else missing.push(ids[index])
  })

  return { ids, rules, missing, usedRegistryFallback }
}

export function summarizeCityRules(rules: CityRule[]): CityRuleSummary {
  const rows: CityRuleRow[] = rules.map((rule) => {
    const sourceEntries = Object.values(rule.sources ?? {})
    const official = sourceEntries.filter((source) => source.confidence === 'official').length
    const derived = sourceEntries.filter((source) => source.confidence === 'derived').length
    const unverified = sourceEntries.filter(
      (source) => source.confidence !== 'official' && source.confidence !== 'derived',
    ).length

    const core = {} as Record<CoreCoverageKey, string | undefined>
    const missingCoreFields: string[] = []
    let coreOfficial = 0
    let coreDerived = 0
    let coreGaps = 0

    for (const field of CORE_COVERAGE_FIELDS) {
      const confidence = rule.sources?.[field.key]?.confidence
      core[field.key] = confidence
      if (confidence === 'official') {
        coreOfficial++
      } else if (confidence === 'derived') {
        coreDerived++
      } else {
        coreGaps++
        missingCoreFields.push(field.label)
      }
    }

    return {
      id: rule.city,
      name: rule.cityName || rule.city,
      year: rule.year,
      totalSources: sourceEntries.length,
      official,
      derived,
      unverified,
      officialRatio: sourceEntries.length ? Math.round((official / sourceEntries.length) * 100) : 0,
      coreOfficial,
      coreDerived,
      coreGaps,
      core,
      missingCoreFields,
    }
  })

  const totals = rows.reduce(
    (acc, row) => {
      acc.sources += row.totalSources
      acc.official += row.official
      acc.derived += row.derived
      acc.unverified += row.unverified
      acc.coreFields += CORE_COVERAGE_FIELDS.length
      acc.coreOfficial += row.coreOfficial
      acc.coreDerived += row.coreDerived
      acc.coreGaps += row.coreGaps
      return acc
    },
    {
      cities: rows.length,
      sources: 0,
      official: 0,
      derived: 0,
      unverified: 0,
      coreFields: 0,
      coreOfficial: 0,
      coreDerived: 0,
      coreGaps: 0,
    },
  )

  return {
    rows,
    totals,
    sourceCoverage: coverageOf(totals.official, totals.sources),
    coreCoverage: coverageOf(totals.coreOfficial, totals.coreFields),
  }
}
