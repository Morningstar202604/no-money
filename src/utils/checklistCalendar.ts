/**
 * 「我的清单」→ 手机日历（RFC 5545 .ics）。
 *
 * 只把用户自己选的提醒日期写进日历，不猜政策里的“60 日内”是哪天，
 * 也不上传清单、城市、身份或工资。事件默认按中国时间 09:00 开始，
 * 日历在 3 天前和当天各提醒一次；用户不加日历就什么都不会发生。
 */
import type { RightsItem } from '../data/rights/catalog'

export interface ChecklistCalendarOptions {
  /** 某条清单的提醒日期，YYYY-MM-DD；没有返回 undefined */
  remindAt: (id: string) => string | undefined
  /** 哪些条目已办；已办的不再生成提醒 */
  done?: (id: string) => boolean
  /** 生成时间，测试可固定；默认当前时间 */
  generatedAt?: Date
  /** 日历名称 */
  calendarName?: string
}

const CHINA_OFFSET = '+08:00'
const EVENT_HOUR = 9

/** 校验并归一化 YYYY-MM-DD；空值、非法日期返回 null */
export function normalizeReminderDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 2000 || year > 2100) return null
  const check = new Date(Date.UTC(year, month - 1, day))
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) return null
  return value
}

function utcStamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '')
}

/** 把中国时间某天 09:00 转成 RFC 5545 的 UTC 时间 */
function eventStartUtc(date: string): string {
  const start = new Date(`${date}T${String(EVENT_HOUR).padStart(2, '0')}:00:00${CHINA_OFFSET}`)
  return utcStamp(start)
}

function eventEndUtc(date: string): string {
  const end = new Date(`${date}T${String(EVENT_HOUR).padStart(2, '0')}:30:00${CHINA_OFFSET}`)
  return utcStamp(end)
}

/** TEXT 值转义：反斜杠、分号、逗号、换行 */
export function escapeIcsText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll('\r\n', '\\n')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\n')
}

/**
 * RFC 5545 要求每行不超过 75 个八位字节，续行以单个空格开头。
 * 中文按 UTF-8 字节计算，不能按字符数截断。
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder()
  const pieces: string[] = []
  let piece = ''
  let bytes = 0
  for (const char of line) {
    const charBytes = encoder.encode(char).length
    // 续行前面的空格也算一个字节，统一按 74 字节留余量
    if (bytes + charBytes > 74 && piece) {
      pieces.push(piece)
      piece = ''
      bytes = 0
    }
    piece += char
    bytes += charBytes
  }
  if (piece) pieces.push(piece)
  return pieces.join('\r\n ')
}

function eventUid(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '-')
  return `nomoney-checklist-${safe}@local`
}

function eventDescription(item: RightsItem): string {
  const lines = [`第一步：${item.whatToDo[0] ?? '打开官方入口，按步骤办理。'}`]
  if (item.deadline) lines.push(`时限：${item.deadline}`)
  lines.push(`去哪办：${item.whereToGo}`)
  if (item.officialUrl) lines.push(`官方入口：${item.officialUrl}`)
  lines.push(`核验：${item.lastVerified}`, '来自「没钱 No Money」')
  return lines.join('\n')
}

interface CalendarEntry {
  item: RightsItem
  date: string
}

/** 收集真正会写进日历的条目；已办、没设日期、日期非法都不算 */
export function calendarEntries(
  items: readonly RightsItem[],
  options: ChecklistCalendarOptions,
): CalendarEntry[] {
  const done = options.done ?? (() => false)
  const entries: CalendarEntry[] = []
  for (const item of items) {
    if (done(item.id)) continue
    const date = normalizeReminderDate(options.remindAt(item.id))
    if (!date) continue
    entries.push({ item, date })
  }
  return entries
}

/**
 * 生成可直接导入手机日历的 .ics。
 * 没有可提醒条目时返回空字符串，调用方应先禁用导出按钮。
 */
export function buildChecklistIcs(
  items: readonly RightsItem[],
  options: ChecklistCalendarOptions,
): string {
  const entries = calendarEntries(items, options)
  if (!entries.length) return ''
  const generatedAt = options.generatedAt ?? new Date()
  const stamp = utcStamp(generatedAt)
  const calendarName = options.calendarName ?? '没钱 No Money · 办事提醒'
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//No Money//Checklist Reminder//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ]

  for (const { item, date } of entries) {
    const summary = `办事提醒：${item.title}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${eventUid(item.id)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${eventStartUtc(date)}`,
      `DTEND:${eventEndUtc(date)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(eventDescription(item))}`,
      `LOCATION:${escapeIcsText(item.whereToGo)}`,
    )
    if (item.officialUrl) lines.push(`URL:${item.officialUrl}`)
    lines.push(
      'CATEGORIES:办事提醒',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(summary)}`,
      'TRIGGER:-P3D',
      'END:VALARM',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(summary)}`,
      'TRIGGER:-PT0M',
      'END:VALARM',
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`
}
