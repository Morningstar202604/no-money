/**
 * 本地日期字符串（YYYY-MM-DD）。
 *
 * 为什么不用 `toISOString().slice(0, 10)`：那按 UTC 切日，中国用户
 * 凌晨 00:00–08:00 导出/分享时会写成前一天，打印出来的清单日期是错的。
 */
export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
