/**
 * 劳务报酬「预扣预缴」模型（与年度汇算清缴并列的第二口径）。
 *
 * 为什么必须有这一条：本产品主口径是年度汇算清缴（税率表一 3%–45%、
 * 5000 元/月基本减除），但真实打款路径通常是平台按次预扣。两者差额极大——
 * 以月入 8856 元为例，汇算口径全年税约 750 元，而按次预扣每月先扣约 1417 元，
 * 全年预扣约 1.7 万元，次年汇算才退回一万多元。只展示汇算口径会让用户
 * 严重低估当月现金流压力。
 *
 * 法定依据：国家税务总局公告 2018 年第 61 号 附件 2《个人所得税预扣率表二》
 *   - 每次收入不超过 4000 元：应纳税所得额 = 收入 - 800
 *   - 每次收入超过 4000 元：应纳税所得额 = 收入 × (1 - 20%)
 *   - 预扣税额 = 应纳税所得额 × 预扣率 - 速算扣除数
 *     · 不超过 20000 元：20%，速算扣除 0
 *     · 20000–50000 元：30%，速算扣除 2000
 *     · 超过 50000 元：40%，速算扣除 7000
 *
 * 该表由国家层面统一规定、不分城市，因此不放进 15 份城市规则文件
 * （放进去只会产生 15 份可能被改错的副本）。
 */

import { Cent, Rate, addCent, nonNegCent, safeRate, subCent } from '../shared/value-objects'

/** 预扣率表二（61 号公告附件 2）—— 单位：元 / 百分数 */
export const WITHHOLDING_TABLE = [
  { max: 20000, rate: 0.2, deduction: 0 },
  { max: 50000, rate: 0.3, deduction: 2000 },
  { max: Number.POSITIVE_INFINITY, rate: 0.4, deduction: 7000 },
] as const

/** 每次收入 4000 元（= 400000 分）是「定额 800」与「20% 定率」的分界点 */
export const WITHHOLDING_FIXED_THRESHOLD_YUAN = 4000
export const WITHHOLDING_FIXED_DEDUCTION_YUAN = 800
export const WITHHOLDING_FIXED_THRESHOLD_CENT = WITHHOLDING_FIXED_THRESHOLD_YUAN * 100
export const WITHHOLDING_FIXED_DEDUCTION_CENT = WITHHOLDING_FIXED_DEDUCTION_YUAN * 100
export const WITHHOLDING_RATE = 0.2

/** 预扣率表二的档位边界（分）——与上表一一对应 */
const WITHHOLDING_MAX_CENT = [20000 * 100, 50000 * 100, Number.POSITIVE_INFINITY] as const
const WITHHOLDING_DEDUCTION_CENT = [0, 2000 * 100, 7000 * 100] as const

export interface WithholdingResult {
  /** 每次预扣税额（分） */
  perPaymentTax: Cent
  /** 每月预扣税额合计（分）= 每次 × 每月发放次数 */
  monthlyWithheld: Cent
  /** 全年预扣合计（分） */
  annualWithheld: Cent
  /** 每次收入的应纳税所得额（分），用于界面展示计算过程 */
  taxablePerPayment: Cent
}

/** 单次应纳税所得额（分）。注意：所有金额参数都是「分」，阈值统一按分比较。 */
export function withholdingTaxablePerPayment(grossPerPayment: Cent): Cent {
  const income = Number(grossPerPayment)
  if (!Number.isFinite(income) || income <= 0) return Cent.create(0)
  const taxable = income <= WITHHOLDING_FIXED_THRESHOLD_CENT
    ? Math.max(0, income - WITHHOLDING_FIXED_DEDUCTION_CENT)
    : income * (1 - WITHHOLDING_RATE)
  return nonNegCent(Cent.create(Math.round(taxable)))
}

/** 单次劳务报酬的预扣税额（分）。纯函数。 */
export function calcWithholdingPerPayment(grossPerPayment: Cent): Cent {
  const taxable = Number(withholdingTaxablePerPayment(grossPerPayment))
  if (taxable <= 0) return Cent.create(0)
  let idx = WITHHOLDING_MAX_CENT.findIndex(max => taxable <= max)
  if (idx < 0) idx = WITHHOLDING_MAX_CENT.length - 1
  const tax = taxable * WITHHOLDING_TABLE[idx].rate - WITHHOLDING_DEDUCTION_CENT[idx]
  return nonNegCent(Cent.create(Math.round(tax)))
}

/**
 * 月度预扣测算。
 * @param monthlyGross 月毛收入（分）
 * @param paymentsPerMonth 每月发放次数（平台可能按月合并结算，也可能按次/按周结算）
 */
export function calcMonthlyWithholding(monthlyGross: Cent, paymentsPerMonth = 1): WithholdingResult {
  const times = Math.max(1, Math.round(Number.isFinite(paymentsPerMonth) ? paymentsPerMonth : 1))
  const perPayment = Cent.create(Math.round(Number(monthlyGross) / times))
  const perPaymentTax = calcWithholdingPerPayment(perPayment)
  const monthlyWithheld = Cent.create(Number(perPaymentTax) * times)
  return {
    perPaymentTax,
    monthlyWithheld,
    annualWithheld: Cent.create(Number(monthlyWithheld) * 12),
    taxablePerPayment: withholdingTaxablePerPayment(perPayment),
  }
}

/** 双口径差异：正数表示预扣多于应缴（汇算时退），负数表示需要补税 */
export function settlementDelta(annualWithheld: Cent, annualSettlementTax: Cent): Cent {
  return Cent.create(Number(subCent(annualWithheld, annualSettlementTax)))
}

/** 预扣占毛收入的比例（百分数），用于界面提示现金流压力 */
export function withholdingRateOf(annualWithheld: Cent, annualGross: Cent): Rate {
  const gross = Number(annualGross)
  return gross > 0 ? safeRate(Number(annualWithheld) / gross) : safeRate(0)
}

/** 便于界面直接用的求和工具（与 tax calculator 的 addCent 语义一致） */
export function sumWithheld(values: readonly Cent[]): Cent {
  return values.reduce((acc, v) => addCent(acc, v), Cent.create(0))
}

