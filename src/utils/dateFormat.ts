/**
 * 日期格式化（中文法律文书口径）。
 *
 * 抽出的原因：DocumentGenerator 里有两处完全相同的 `YYYY年M月D日` 拼接，
 * 且项目此前已删除过一个 182 行的 date.ts（内含未被使用的 YearMonth/DateRange），
 * 说明「为未来预留的日期工具」没有价值，只保留真实用到的这一个格式化函数。
 */

/** 格式化为「2026年10月27日」；非法时间戳回落为空串 */
export function formatChineseDate(input: number | Date): string {
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/** 文件名安全的日期（2026_10_27），用于导出文件名 */
export function formatDateForFilename(input: number | Date): string {
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return 'unknown-date'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}_${pad(d.getMonth() + 1)}_${pad(d.getDate())}`
}
