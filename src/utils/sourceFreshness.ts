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
