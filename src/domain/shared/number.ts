/**
 * 金额统一保留两位小数。
 * 早期四处引擎各自实现 Math.round(n*100)/100，对负数半值向 +∞ 取整
 * （round(-1.005) = -1），且存在 -0 与浮点误差，这里统一处理。
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
