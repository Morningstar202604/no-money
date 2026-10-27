/**
 * 养老金精算模型：把「每月能领多少」升级为「这笔投入划不划算」。
 *
 * 教科书式说明（每个假设都必须显式、可调、可追溯）：
 *
 * 1) 终身现值（Present Value）
 *    退休后每年领取 P，假设每年按 g 调整（养老金调整率，近年全国约 2%-4%），
 *    按贴现率 d 折现到退休时点，领取 n 年（按人均预期余命估算）：
 *
 *        PV = Σ_{t=1..n} P × (1+g)^t / (1+d)^t
 *
 *    当 g = d 时退化为 P × n；g < d 时现值小于名义总额——这就是「通胀吃掉养老金」的量化。
 *
 * 2) 回本年龄（Break-even age）
 *    累计领取（按 g 增长）追平「累计缴费 + 缴费期的机会成本」的年龄。
 *    机会成本按贴现率 d 计（钱若自己投资的机会），因此这是保守口径的回本点。
 *
 * 3) 投入产出倍数
 *    PV / 缴费现值。>1 表示按当前假设划算，<1 表示不如自己存。
 *
 * 所有默认值均为「可调假设」，不是官方承诺：
 *   - 养老金调整率 g：近年全国企业退休人员基本养老金调整幅度约 2%-4%，
 *     规则文件未承载该数据，故以 3% 作为默认假设并在界面标注。
 *   - 贴现率 d：取长期国债/稳健理财的机会成本口径，默认 3%。
 *   - 领取年限 n：按退休年龄查《中国人寿保险业经验生命表（2010-2013）》
 *     的预期余命近似（60 岁约 23 年、65 岁约 18 年），此处用简单近似函数。
 */

import { round2, clampNumber } from '../shared/number'

/** 养老金调整率默认假设（非官方承诺） */
export const DEFAULT_PENSION_ADJUST_RATE = 0.03
/** 贴现率默认假设（机会成本口径） */
export const DEFAULT_DISCOUNT_RATE = 0.03

/**
 * 预期领取年限近似：按退休年龄估算余命。
 * 依据量级：《中国人寿保险业经验生命表（2010-2013）》男性 60 岁预期余命约 21.5 年、
 * 女性约 24.8 年，此处取中位数近似并对高龄递减。
 * 这是估算，不是精算定价，界面必须标注为假设。
 */
export function expectedPensionYears(retireAge: number): number {
  if (!Number.isFinite(retireAge)) return 20
  const age = Math.max(40, Math.min(80, Math.round(retireAge)))
  // 60 岁 → 23 年，每多 1 岁减少约 0.7 年（与生命表斜率近似）
  const years = 23 - (age - 60) * 0.7
  return Math.max(8, Math.round(years * 10) / 10)
}

export interface PensionActuarialInput {
  /** 退休时每月养老金（元） */
  monthlyPension: number
  /** 退休年龄 */
  retireAge: number
  /** 缴费期内每月自缴金额（元） */
  monthlyContribution: number
  /** 累计缴费年数 */
  contributionYears: number
  /** 养老金年度调整率（假设，默认 3%） */
  adjustRate?: number
  /** 贴现率（假设，默认 3%） */
  discountRate?: number
  /** 领取年限（默认按退休年龄估算） */
  payoutYears?: number
}

export interface PensionActuarialResult {
  /** 领取年限（年） */
  payoutYears: number
  /** 名义累计领取总额（元，未折现） */
  nominalTotal: number
  /** 终身现值（元，折现到退休时点） */
  presentValue: number
  /** 缴费现值（元，折现到退休时点） */
  contributionPresentValue: number
  /** 投入产出倍数 = 现值 / 缴费现值 */
  multiple: number
  /** 回本年龄；null 表示在领取年限内未回本 */
  breakEvenAge: number | null
  /** 用于界面展示的假设说明 */
  assumptions: { adjustRate: number; discountRate: number; payoutYears: number }
}

/**
 * 计算养老金精算指标。
 *
 * 现值口径说明：缴费发生在退休前，领取发生在退休后，两者都折现到「退休时点」。
 * 缴费现值用年金终值（每月缴费按 d/12 复利到退休）：
 *   FV_contrib = C × ((1+i)^m - 1) / i  （i = d/12, m = 缴费月数）
 * 领取现值用等比年金：
 *   PV = P × 12 × Σ_{t=1..n} ((1+g)/(1+d))^t
 */
export function calcPensionActuarial(input: PensionActuarialInput): PensionActuarialResult {
  const adjustRate = clampRate(input.adjustRate, DEFAULT_PENSION_ADJUST_RATE)
  const discountRate = clampRate(input.discountRate, DEFAULT_DISCOUNT_RATE)
  const payoutYears = Number.isFinite(input.payoutYears)
    ? Math.max(0, input.payoutYears as number)
    : expectedPensionYears(input.retireAge)

  const monthlyPension = Math.max(0, finiteOr(input.monthlyPension, 0))
  const monthlyContribution = Math.max(0, finiteOr(input.monthlyContribution, 0))
  const years = Math.max(0, finiteOr(input.contributionYears, 0))
  const months = Math.round(years * 12)

  // 名义累计领取：退休后第 t 年领取 P×(1+g)^(t-1)（退休当年为基准年）
  // 现值：同期金额折现到退休时点，除以 (1+d)^t。
  // 两处共用同一个 t 指数：g=d 时每期现值恒为 P/(1+g)，PV 退化为
  // n×P/(1+g)——这是「增长被贴现完全对冲」的解析解，可用于验证实现。
  let nominalTotal = 0
  let presentValue = 0
  const yearsInt = Math.floor(payoutYears)
  const frac = payoutYears - yearsInt
  for (let t = 1; t <= yearsInt; t++) {
    const amount = monthlyPension * 12 * Math.pow(1 + adjustRate, t - 1)
    nominalTotal += amount
    presentValue += amount / Math.pow(1 + discountRate, t)
  }
  if (frac > 0) {
    const t = yearsInt + 1
    const amount = monthlyPension * 12 * frac * Math.pow(1 + adjustRate, t - 1)
    nominalTotal += amount
    presentValue += amount / Math.pow(1 + discountRate, t)
  }

  // 缴费现值（折算到退休时点）：月缴年金终值
  const i = discountRate / 12
  const contributionFV = i > 0 && months > 0
    ? monthlyContribution * ((Math.pow(1 + i, months) - 1) / i)
    : monthlyContribution * months

  const multiple = contributionFV > 0 ? presentValue / contributionFV : 0

  // 回本年龄：累计领取现值追平缴费终值所需年数
  let breakEvenAge: number | null = null
  let cumulative = 0
  for (let t = 1; t <= Math.ceil(payoutYears); t++) {
    cumulative += monthlyPension * 12 * Math.pow(1 + adjustRate, t - 1) / Math.pow(1 + discountRate, t)
    if (cumulative >= contributionFV) {
      breakEvenAge = Math.round((input.retireAge + t) * 10) / 10
      break
    }
  }

  return {
    payoutYears,
    nominalTotal: round2(nominalTotal),
    presentValue: round2(presentValue),
    contributionPresentValue: round2(contributionFV),
    multiple: Math.round(multiple * 100) / 100,
    breakEvenAge,
    assumptions: { adjustRate, discountRate, payoutYears },
  }
}

function finiteOr(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function clampRate(v: unknown, fallback: number): number {
  return clampNumber(v, 0, 0.2, fallback)
}
