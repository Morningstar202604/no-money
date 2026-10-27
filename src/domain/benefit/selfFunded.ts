/**
 * 自助养老 vs 社保养老：同一笔钱的两条出路。
 *
 * 灵活就业者最现实的抉择是：每月这一千多块，是缴社保，还是自己存/投？
 * 前者给的是「基础养老金 + 个人账户 + 长寿兜底 + 医保联动」，
 * 后者给的是「完全自主支配 + 无长寿兜底」。
 *
 * 本模型只做同一口径下的现金流对比，不做价值判断：
 *
 *   社保侧：把每月缴费最终变成的养老金现金流（复用 actuarial.calcPensionActuarial）
 *   自助侧：把同样的月缴额按自己设定的收益率复利到退休，再按同样年限领取
 *
 * 两者都用同一个贴现率折现到退休时点，因此可比。
 *
 * 关键差异必须显式呈现（不能只比数字）：
 *   - 社保有长寿风险兜底（活多久领多久）、有遗属待遇、与医保绑定
 *   - 自助积累可继承、可提前支取、但可能被通胀侵蚀，也无任何兜底
 * 这些不是现金流能完全表达的，界面必须单列。
 */

import { calcPensionActuarial, expectedPensionYears } from './actuarial'
import { round2, clampNumber } from '../shared/number'

export interface SelfFundedInput {
  /** 每月可投入金额（元）——与社保月缴额同一口径 */
  monthlyAmount: number
  /** 缴费/积累年数 */
  years: number
  /** 自助投资年化收益率（假设） */
  annualReturn: number
  /** 退休时开始领取的年限 */
  payoutYears?: number
  /** 领取期内的年化收益率（保守可取 0 或同贴现率） */
  payoutReturn?: number
  /** 用于比较的贴现率（应与社保口径一致） */
  discountRate?: number
}

export interface SelfFundedResult {
  /** 退休时账户余额（元） */
  balanceAtRetirement: number
  /** 累计投入本金（元） */
  totalContributed: number
  /** 投资收益（元） */
  investmentGain: number
  /** 每年可领取金额（元，按年金摊还） */
  annualWithdrawal: number
  /** 每月可领取金额（元） */
  monthlyWithdrawal: number
  /** 领取期现值（元） */
  presentValue: number
  /** 领取年限 */
  payoutYears: number
}

/**
 * 自助积累测算。
 *
 * 退休时余额用年金终值：
 *   FV = C × ((1+i)^n − 1) / i     （i = 年化收益，n = 年数）
 * 领取期用年金现值反推等额年领取额（资金在领取期继续按 payoutReturn 增值）：
 *   A = FV × i' / (1 − (1+i')^(−m))   （i' = payoutReturn，m = 领取年数；i'=0 时 A = FV/m）
 */
export function calcSelfFunded(input: SelfFundedInput): SelfFundedResult {
  const monthly = Math.max(0, finiteOr(input.monthlyAmount, 0))
  const years = Math.max(0, finiteOr(input.years, 0))
  const annualReturn = clampNumber(input.annualReturn, -0.2, 0.3, 0.03)
  const discountRate = clampNumber(input.discountRate, 0, 0.2, 0.03)
  const payoutYears = Math.max(1, finiteOr(input.payoutYears, expectedPensionYears(60)))
  const payoutReturn = clampNumber(input.payoutReturn, -0.2, 0.2, 0.02)

  // 退休时余额：月缴按年化收益复利
  const annualContribution = monthly * 12
  const balanceAtRetirement = annualReturn !== 0
    ? annualContribution * ((Math.pow(1 + annualReturn, years) - 1) / annualReturn)
    : annualContribution * years
  const totalContributed = annualContribution * years

  // 领取期等额年金：资金继续按 payoutReturn 增值
  const annualWithdrawal = payoutReturn !== 0
    ? balanceAtRetirement * payoutReturn / (1 - Math.pow(1 + payoutReturn, -payoutYears))
    : balanceAtRetirement / payoutYears

  // 领取期现值（折现到退休时点）：与社保口径一致的等比年金
  let presentValue = 0
  for (let t = 1; t <= Math.ceil(payoutYears); t++) {
    const frac = Math.min(1, payoutYears - (t - 1))
    presentValue += annualWithdrawal * frac / Math.pow(1 + discountRate, t)
  }

  return {
    balanceAtRetirement: round2(balanceAtRetirement),
    totalContributed: round2(totalContributed),
    investmentGain: round2(balanceAtRetirement - totalContributed),
    annualWithdrawal: round2(annualWithdrawal),
    monthlyWithdrawal: round2(annualWithdrawal / 12),
    presentValue: round2(presentValue),
    payoutYears,
  }
}

export interface ComparisonResult {
  social: {
    /** 社保月养老金（元） */
    monthlyPension: number
    /** 社保终身现值（元） */
    presentValue: number
    /** 社保缴费终值（元） */
    contributionValue: number
    /** 回本年龄 */
    breakEvenAge: number | null
    /** 覆盖到多少岁 */
    coveredUntilAge: number
  }
  selfFunded: SelfFundedResult & {
    /** 自助方案资金耗尽的年龄（余额归零） */
    depletionAge: number
    /** 资金是否能覆盖到预期余命 */
    coversLifeExpectancy: boolean
  }
  /** 结论差异：正数表示社保现值更高 */
  presentValueGap: number
  /** 必须让用户看到的结构性差异 */
  caveats: string[]
}

/**
 * 对比「同样月缴额」下社保与自助两条路。
 * @param socialInput 社保侧参数（月养老金、缴费额、年限、退休年龄等）
 * @param selfInput 自助侧参数（月投入、年限、收益率）
 */
export function compareSocialVsSelf(
  socialInput: Parameters<typeof calcPensionActuarial>[0],
  selfInput: SelfFundedInput,
): ComparisonResult {
  const social = calcPensionActuarial(socialInput)
  const selfFunded = calcSelfFunded(selfInput)

  // 自助资金耗尽年龄：按领取额从退休起逐年扣减（领取期继续按 payoutReturn 增值）
  const payoutReturn = selfInput.payoutReturn ?? 0.02
  let balance = selfFunded.balanceAtRetirement
  let yearsCovered = 0
  const retireAge = socialInput.retireAge
  while (balance > 0 && yearsCovered < 100) {
    yearsCovered++
    balance = balance * (1 + payoutReturn) - selfFunded.annualWithdrawal
  }
  const depletionAge = Math.round((retireAge + yearsCovered) * 10) / 10
  // payoutYears 本身就是「按退休年龄估算的预期领取年限」，因此这里判断
  // 自助资金能否覆盖到该年限——覆盖不了就意味着长寿风险敞口
  const coversLifeExpectancy = yearsCovered >= selfFunded.payoutYears

  return {
    social: {
      monthlyPension: round2(socialInput.monthlyPension),
      presentValue: social.presentValue,
      contributionValue: social.contributionPresentValue,
      breakEvenAge: social.breakEvenAge,
      coveredUntilAge: 999, // 社保终身领取，无耗尽年龄
    },
    selfFunded: { ...selfFunded, depletionAge, coversLifeExpectancy },
    presentValueGap: round2(social.presentValue - selfFunded.presentValue),
    caveats: [
      '社保是终身领取（活多久领多久），自助积累有耗尽风险；活过耗尽年龄后社保优势会持续放大',
      '社保与医保绑定：断缴会影响住院报销资格；自助方案不含任何医疗保障',
      '社保含遗属待遇（丧葬补助金 + 抚恤金）；自助积累可继承，但无抚恤',
      '社保个人账户可继承，统筹部分不可继承；自助积累全部可继承',
      '自助方案的收益率是假设，实际市场收益可能为负；社保的记账利率由政策确定',
    ],
  }
}

function finiteOr(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}


