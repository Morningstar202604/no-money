/**
 * 数据新鲜度摘要：只读当前城市规则里的 sources，不推断、不补全。
 * `retrievedAt` 是录入/核对日期，不是政策生效日期；超过 365 天只提示复核，不自动判错。
 */
import type { SourceRef } from '../types'

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

export interface SourceFreshness {
  total: number
  official: number
  derived: number
  unverified: number
  /** 最早的有效登记/核对日期；没有合法日期时为 undefined */
  oldestRetrievedAt?: string
  /** retrievedAt 早于 365 天的来源数量 */
  staleCount: number
  /** 没有权威来源的字段 key，按数据顺序返回 */
  unverifiedKeys: string[]
}

export function summarizeSourceFreshness(
  sources: Record<string, SourceRef> | null | undefined,
  now: Date = new Date(),
): SourceFreshness {
  const summary: SourceFreshness = {
    total: 0,
    official: 0,
    derived: 0,
    unverified: 0,
    staleCount: 0,
    unverifiedKeys: [],
  }
  if (!sources) return summary

  const cutoff = now.getTime() - ONE_YEAR_MS
  let oldestMs = Number.POSITIVE_INFINITY
  for (const [key, source] of Object.entries(sources)) {
    summary.total++
    summary[source.confidence]++
    if (source.confidence === 'unverified') summary.unverifiedKeys.push(key)
    const dateMs = Date.parse(source.retrievedAt)
    if (!Number.isFinite(dateMs)) continue
    if (dateMs < oldestMs) {
      oldestMs = dateMs
      summary.oldestRetrievedAt = source.retrievedAt
    }
    if (dateMs < cutoff) summary.staleCount++
  }
  return summary
}

export interface CityFreshnessRow extends SourceFreshness {
  city: string
  label: string
  province: string
}

export interface FreshnessOverview {
  /** 只包含成功读取规则的城市，读取失败的城市不补 0 */
  rows: CityFreshnessRow[]
  totals: SourceFreshness
  /** 读取成功的城市数 */
  loaded: number
  /** 读取失败的城市显示名，按注册表顺序 */
  missing: string[]
}

/**
 * 34 城总览：输入城市注册表和「城市 id → 规则」映射。
 * 只汇总成功读取的规则；失败的城市单独列出，不用零值冒充“已核对”。
 */
export function summarizeCityFreshness(
  cities: ReadonlyArray<{ value: string; label: string; province: string }>,
  rules: Record<string, { sources?: Record<string, SourceRef> } | null | undefined>,
  now: Date = new Date(),
): FreshnessOverview {
  const rows: CityFreshnessRow[] = []
  const missing: string[] = []
  const totals: SourceFreshness = {
    total: 0,
    official: 0,
    derived: 0,
    unverified: 0,
    staleCount: 0,
    unverifiedKeys: [],
  }

  for (const city of cities) {
    const rule = rules[city.value]
    if (!rule) {
      missing.push(city.label)
      continue
    }
    const summary = summarizeSourceFreshness(rule.sources, now)
    rows.push({ ...summary, city: city.value, label: city.label, province: city.province })
    totals.total += summary.total
    totals.official += summary.official
    totals.derived += summary.derived
    totals.unverified += summary.unverified
    totals.staleCount += summary.staleCount
    if (summary.oldestRetrievedAt && (!totals.oldestRetrievedAt || summary.oldestRetrievedAt < totals.oldestRetrievedAt)) {
      totals.oldestRetrievedAt = summary.oldestRetrievedAt
    }
  }

  return { rows, totals, loaded: rows.length, missing }
}
