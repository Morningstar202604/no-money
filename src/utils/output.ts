/** Node 入口共用的文本格式化；不依赖 DOM，可被 CLI/MCP 直接引用。 */
export function formatMoney(value: number): string {
  return `¥${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
