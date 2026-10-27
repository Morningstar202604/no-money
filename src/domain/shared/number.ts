/**
 * 金额统一保留两位小数。
 *
 * 语义：绝对值四舍五入后还原符号，即「远离零方向」——正负对称
 * （1.005 → 1.01，-1.005 → -1.01）。早期各引擎手写 Math.round(n*100)/100
 * 对负数半值实际向 +∞ 舍入（-1.005 → -1），正负不对称；本实现用
 * Number.EPSILON 补偿二进制表示误差，消除 1.005 这类边界抖动。
 */
export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0
  // 先做 EPS 补偿消除 1.005 这类二进制表示误差，再用 sign 还原负数的向 -∞ 取整
  const scaled = n * 100
  const fixed = Math.abs(scaled) < 1e-9 ? 0 : Math.round(Math.abs(scaled) + Number.EPSILON * Math.abs(scaled))
  return (n < 0 ? -fixed : fixed) / 100
}

/** 保留四位小数（用于每公里成本这类需要更高精度的比率） */
export function round4(n: number): number {
  if (!Number.isFinite(n)) return 0
  const scaled = n * 10000
  const fixed = Math.abs(scaled) < 1e-9 ? 0 : Math.round(Math.abs(scaled) + Number.EPSILON * Math.abs(scaled))
  return (n < 0 ? -fixed : fixed) / 10000
}

/**
 * 把任意输入夹到 [min, max]；非有限值回落 fallback。
 * 用于外部输入（滑块、localStorage、导入文件）的统一入口，
 * 防止 NaN 静默流入计算并被比较运算吞掉。
 */
export function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

/** 安全除法：分母为 0 或非有限时返回 0，避免 Infinity 渲染到界面 */
export function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(denominator) || denominator === 0) return 0
  return numerator / denominator
}

/** 安全除法 + 固定小数位格式化（供 UI 直接渲染，避免 Infinity/NaN 上屏） */
export function formatDivide(numerator: number, denominator: number, digits: number): string {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return '0'
  return (numerator / denominator).toFixed(digits)
}
