/**
 * 出站脱敏：把发往第三方 AI endpoint 的精确财务金额替换为区间档位。
 *
 * 背景：AI 启用时 buildContext 会把月收入/净收入/时薪等精确到分的数字
 * 放进 system prompt 外发。部分用户只想要方向性建议，不希望精确财务数据
 * 以可复原的粒度离开本机——脱敏开关（config.redactSensitive）服务这个场景。
 *
 * 设计取舍：
 * - 按 1000 元分档（月度量级）与 5 元分档（时薪等小量级），保住"量级与相对关系"，
 *   模型仍能给方向性建议；精确到分的颗粒度不再外发。
 * - 纯字符串替换、无状态、可单测；不改动本地展示（只有出站这条路径用）。
 */

/** 匹配 ¥ 金额：¥6,843.70 / ¥ 26.3 / ¥12 等写法 */
const AMOUNT_RE = /¥\s?([\d,]+(?:\.\d+)?)/g

/** 千元档上限数字宽度（999），用于拼接区间 */
export function bucketAmount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '（金额未知）'
  if (n >= 1000) {
    const low = Math.floor(n / 1000) * 1000
    return `¥${low}-${low + 999}`
  }
  const low = Math.floor(n / 5) * 5
  return `¥${low}-${low + 5}`
}

/** 把文本中所有 ¥ 金额替换为区间档位；非金额文本原样保留 */
export function redactContext(text: string): string {
  return text.replace(AMOUNT_RE, (_match, raw: string) => {
    const n = Number(raw.replace(/,/g, ''))
    return bucketAmount(n)
  })
}
