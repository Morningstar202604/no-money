import { Brand, createBrandUtils } from './brand'

/** 分（Cent）：金额最小单位，避免浮点误差 */
export type Cent = Brand<number, 'Cent'>
/** 税率（Rate）：基点表示，如 0.03 -> 300 basis points */
export type Rate = Brand<number, 'Rate'>

export const Cent = createBrandUtils<number, 'Cent'>('Cent', (v): v is number => typeof v === 'number' && Number.isFinite(v))
export const Rate = createBrandUtils<number, 'Rate'>('Rate', (v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1)

/** 从元转分 */
export function yuanToCent(yuan: number): Cent {
  if (!Number.isFinite(yuan)) return Cent.create(0)
  return Cent.create(Math.round(yuan * 100))
}

/** 从分转元（仅用于显示） */
export function centToYuan(cent: Cent): number {
  return Number(cent) / 100
}

/** Cent 加法 */
export function addCent(a: Cent, b: Cent): Cent {
  return Cent.create(Number(a) + Number(b))
}

/** Cent 减法 */
export function subCent(a: Cent, b: Cent): Cent {
  return Cent.create(Number(a) - Number(b))
}

/** Cent 乘以 Rate（结果为 Cent） */
export function mulCentRate(cent: Cent, rate: Rate): Cent {
  return Cent.create(Math.round(Number(cent) * Number(rate)))
}

/** Cent 除以数字 */
export function divCent(cent: Cent, divisor: number): Cent {
  if (!Number.isFinite(divisor) || divisor === 0) return Cent.create(0)
  return Cent.create(Math.round(Number(cent) / divisor))
}

/** Cent 取最大值 */
export function maxCent(a: Cent, b: Cent): Cent {
  return Cent.create(Math.max(Number(a), Number(b)))
}

/** Cent 取最小值 */
export function minCent(a: Cent, b: Cent): Cent {
  return Cent.create(Math.min(Number(a), Number(b)))
}

/** Cent 非负保护 */
export function nonNegCent(cent: Cent): Cent {
  return maxCent(cent, Cent.create(0))
}

/** 安全转换为 Cent（非有限值归零） */
export function safeCent(n: number): Cent {
  return Cent.create(Number.isFinite(n) ? n : 0)
}

/** 安全转换为 Rate（非有限值归零，超出区间截断） */
export function safeRate(n: number): Rate {
  if (!Number.isFinite(n)) return Rate.create(0)
  return Rate.create(Math.max(0, Math.min(1, n)))
}