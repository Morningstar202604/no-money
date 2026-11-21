/**
 * 清单日历导出：只验证“用户设的日期 → 手机日历能读的事件”，
 * 不测浏览器下载本身（E2E 负责那一段）。
 */
import { describe, expect, it } from 'vitest'
import type { RightsItem } from '../src/data/rights/catalog'
import {
  buildChecklistIcs,
  calendarEntries,
  escapeIcsText,
  foldIcsLine,
  normalizeReminderDate,
} from '../src/utils/checklistCalendar'

function item(overrides: Partial<RightsItem> = {}): RightsItem {
  return {
    id: 'right-test',
    category: 'social',
    intent: 'do',
    audience: ['all'],
    title: '测试条目',
    oneLiner: '一句话',
    whatToDo: ['先打开官方入口'],
    whatToGet: [],
    whereToGo: '当地社保局',
    officialUrl: 'https://example.gov.cn/path?a=1,b=2',
    deadline: '离职后 1 年内',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-20',
    priority: 1,
    ...overrides,
  }
}

const fixedNow = new Date('2026-11-21T00:00:00Z')

describe('提醒日期校验', () => {
  it('接受合法日期，拒绝空值、格式错误和不存在的日期', () => {
    expect(normalizeReminderDate('2026-12-01')).toBe('2026-12-01')
    expect(normalizeReminderDate('2026-02-29')).toBeNull()
    expect(normalizeReminderDate('2026-13-01')).toBeNull()
    expect(normalizeReminderDate('2026-1-1')).toBeNull()
    expect(normalizeReminderDate('')).toBeNull()
    expect(normalizeReminderDate(undefined)).toBeNull()
  })
})

describe('日历事件', () => {
  it('只收集未办、已设合法日期的条目', () => {
    const items = [
      item({ id: 'a' }),
      item({ id: 'b' }),
      item({ id: 'c' }),
    ]
    const entries = calendarEntries(items, {
      remindAt: (id) => ({ a: '2026-12-01', b: '2026-02-30', c: '2026-12-03' })[id],
      done: (id) => id === 'c',
    })
    expect(entries.map((entry) => entry.item.id)).toEqual(['a'])
    expect(entries[0].date).toBe('2026-12-01')
  })

  it('生成 VCALENDAR，中国时间 09:00 写成 01:00Z，并带 3 天前与当天两次提醒', () => {
    const ics = buildChecklistIcs([item()], {
      remindAt: () => '2026-12-01',
      generatedAt: fixedNow,
    })
    expect(ics).toContain('BEGIN:VCALENDAR\r\n')
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('DTSTAMP:20261121T000000Z')
    expect(ics).toContain('DTSTART:20261201T010000Z')
    expect(ics).toContain('DTEND:20261201T013000Z')
    expect(ics).toContain('TRIGGER:-P3D')
    expect(ics).toContain('TRIGGER:-PT0M')
    expect(ics).toContain('UID:nomoney-checklist-right-test@local')
    expect(ics.endsWith('\r\n')).toBe(true)
  })

  it('没有可提醒条目时返回空串，不生成空日历', () => {
    expect(buildChecklistIcs([item()], { remindAt: () => undefined })).toBe('')
    expect(buildChecklistIcs([item()], { remindAt: () => '2026-12-01', done: () => true })).toBe('')
  })

  it('转义逗号、分号、反斜杠和换行，避免破坏 ICS 结构', () => {
    const escaped = escapeIcsText('a,b;c\\d\n第二行')
    expect(escaped).toBe('a\\,b\\;c\\\\d\\n第二行')
    const ics = buildChecklistIcs([item({ title: '标题,带;符号', deadline: '第一行\n第二行' })], {
      remindAt: () => '2026-12-01',
    })
    expect(ics).toContain('SUMMARY:办事提醒：标题\\,带\\;符号')
    expect(ics.replace(/\r\n /g, '')).toContain('时限：第一行\\n第二行')
  })

  it('按 UTF-8 字节折行，续行以空格开头且不超过 75 字节', () => {
    const long = `SUMMARY:${'很长的中文标题'.repeat(30)}`
    const folded = foldIcsLine(long)
    for (const line of folded.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
    expect(folded).toContain('\r\n ')
  })
})
