import { describe, expect, it } from 'vitest'
import { summarizeSourceFreshness } from '../src/utils/sourceFreshness'
import type { SourceRef } from '../src/types'

const source = (confidence: SourceRef['confidence'], retrievedAt: string): SourceRef => ({
  title: '测试来源',
  confidence,
  retrievedAt,
})

describe('数据新鲜度摘要', () => {
  it('按置信度计数，列出待核验字段，并按 365 天标记过期', () => {
    const summary = summarizeSourceFreshness({
      pension: source('official', '2026-10-12'),
      medical: source('derived', '2025-11-01'),
      income: source('unverified', 'not-a-date'),
    }, new Date('2026-11-20T00:00:00Z'))

    expect(summary.total).toBe(3)
    expect(summary.official).toBe(1)
    expect(summary.derived).toBe(1)
    expect(summary.unverified).toBe(1)
    expect(summary.unverifiedKeys).toEqual(['income'])
    expect(summary.staleCount).toBe(1)
    expect(summary.oldestRetrievedAt).toBe('2025-11-01')
  })

  it('空规则与非法日期不制造假数据', () => {
    const empty = summarizeSourceFreshness(null)
    expect(empty.total).toBe(0)
    expect(empty.unverifiedKeys).toEqual([])

    const invalid = summarizeSourceFreshness({ tax: source('official', '') }, new Date('2026-11-20T00:00:00Z'))
    expect(invalid.total).toBe(1)
    expect(invalid.staleCount).toBe(0)
    expect(invalid.oldestRetrievedAt).toBeUndefined()
  })
})
