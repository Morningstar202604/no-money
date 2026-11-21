import { describe, expect, it } from 'vitest'
import { localDateString } from '../src/utils/localDate'

describe('本地日期', () => {
  it('凌晨 00:30 仍算当天，不回退到 UTC 的前一天', () => {
    expect(localDateString(new Date(2026, 10, 21, 0, 30))).toBe('2026-11-21')
  })

  it('跨年边界按本地时间切日', () => {
    expect(localDateString(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01')
    expect(localDateString(new Date(2025, 11, 31, 23, 59))).toBe('2025-12-31')
  })

  it('月/日补零，不出现 2026-1-5', () => {
    expect(localDateString(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05')
  })
})
