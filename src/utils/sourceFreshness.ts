/**
 * 数据新鲜度摘要：只读当前城市规则里的 sources，不推断、不补全。
 * `retrievedAt` 是录入/核对日期，不是政策生效日期；超过 365 天只提示复核，不自动判错。
 */
import type { SourceRef } from '../types'

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

export interface SourceConfidenceCounts {
  total: number
  official: number
  derived: number
  unverified: number
}

/**
 * 按置信度统计来源条目。
 *
 * 为什么单独提出来：/policy 的数据新鲜度总览与 /admin、/audit 的覆盖率
 * 此前各自用 filter 数一遍 official/derived/unverified；新增一种置信度或
 * 遇到脏值时，两套统计会给出不同的分母。这里统一口径：
 * 未知/缺失一律算 unverified（宁可少报官方，不可把脏值算成官方）。
 */
export function countSourceConfidence(
  sources: Record<string, { confidence?: string }> | null | undefined,
): SourceConfidenceCounts {
  const counts: SourceConfidenceCounts = { total: 0, official: 0, derived: 0, unverified: 0 }
  if (!sources) return counts
  for (const source of Object.values(sources)) {
    counts.total++
    if (source?.confidence === 'official') counts.official++
    else if (source?.confidence === 'derived') counts.derived++
    else counts.unverified++
  }
  return counts
}

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
  const counts = countSourceConfidence(sources)
  const summary: SourceFreshness = {
    ...counts,
    staleCount: 0,
    unverifiedKeys: [],
  }
  if (!sources) return summary

  const cutoff = now.getTime() - ONE_YEAR_MS
  let oldestMs = Number.POSITIVE_INFINITY
  for (const [key, source] of Object.entries(sources)) {
    if (source.confidence !== 'official' && source.confidence !== 'derived') {
      summary.unverifiedKeys.push(key)
    }
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
