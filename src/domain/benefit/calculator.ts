import { Cent, Rate, addCent, mulCentRate, nonNegCent, safeCent, safeRate, divCent, maxCent, minCent } from '../shared/value-objects'
import type { BenefitRule, BenefitBreakdown, BenefitItem, RetirementProjection, BenefitError, ContributionBase, MedicalTier } from './rules'
import { issuanceMonthsForAge } from './rules'
import { Result, ok, err } from '../shared/result'

/** 解析缴费基数：用户自选优先；未选或非法时回落到申报收入夹取，再夹到法定上下限 */
export function resolveBase(
  chosen: Cent | undefined,
  declared: Cent,
  min: Cent,
  max: Cent
): Cent {
  const source = (chosen !== undefined && Number(chosen) > 0) ? chosen : declared
  // 夹取到 [min, max] 区间
  return maxCent(minCent(source, max), min)
}

/** 查找医保档次费率 */
export function findMedicalTierRate(tiers: readonly MedicalTier[] | undefined, tierId: string | undefined): Rate | undefined {
  if (!tierId || !tiers || tiers.length === 0) return undefined
  const tier = tiers.find(t => t.id === tierId)
  return tier?.rate
}

/** 月度缴费测算：纯函数，无副作用 */
export function calcMonthly(
  income: Cent,
  enrolled: boolean,
  medicalTierRate: Rate | undefined,
  base: ContributionBase,
  rule: BenefitRule
): Result<BenefitBreakdown, BenefitError> {
  const declared = (Number(income) > 0 && Number.isFinite(Number(income))) ? income : Cent.create(0)

  // 解析养老与医保缴费基数
  const pensionBase = resolveBase(base.pensionBase, declared, rule.pension.baseMin, rule.pension.baseMax)
  const medicalBase = resolveBase(base.medicalBase, declared, rule.medical.baseMin, rule.medical.baseMax)

  // 计算月缴费：基数 × 费率
  const pensionMonthly = nonNegCent(mulCentRate(pensionBase, rule.pension.rate))
  const medicalRate = medicalTierRate ?? rule.medical.rate
  const medicalMonthly = nonNegCent(mulCentRate(medicalBase, medicalRate))

  // 构建分项明细
  const items: BenefitItem[] = [
    { name: '养老保险', monthly: pensionMonthly, covered: enrolled, risk: enrolled ? 'low' : 'high' },
    { name: '医疗保险', monthly: medicalMonthly, covered: enrolled, risk: enrolled ? 'low' : 'high' },
    // 职业伤害保障由平台按单缴费，不构成个人支出
    { name: '职业伤害保障', monthly: Cent.create(0), covered: true, risk: 'medium' },
  ]

  const totalMonthly = enrolled
    ? nonNegCent(addCent(pensionMonthly, medicalMonthly))
    : Cent.create(0)

  return ok({
    pensionMonthly,
    medicalMonthly,
    totalMonthly,
    items,
  })
}

/** 退休测算：基础养老金 + 个人账户养老金
 *  基础养老金 = 计发基数 × (1 + 缴费指数) / 2 × 缴费年限 × 1%
 *  个人账户养老金 = 储存额 / 计发月数（国发〔2005〕38号附表按退休年龄查，60 岁为 139）
 */
export function projectRetirement(
  currentAge: number,
  retireAge: number,
  monthlyContribution: Cent,
  yearsContributed: number,
  annualReturn: Rate,
  paymentIndex: Rate,
  benefitBaseMonthly: Cent
): Result<RetirementProjection, BenefitError> {
  // 参数安全处理
  const safeAge = Number.isFinite(currentAge) ? Math.max(0, Math.floor(currentAge)) : 0
  const safeRetire = Number.isFinite(retireAge) ? Math.max(safeAge, Math.floor(retireAge)) : safeAge
  const safeYears = Number.isFinite(yearsContributed) ? Math.max(0, Math.floor(yearsContributed)) : 0
  const contribution = (Number.isFinite(Number(monthlyContribution)) && Number(monthlyContribution) >= 0)
    ? monthlyContribution
    : Cent.create(0)

  const months = Math.max(0, Math.round((safeRetire - safeAge) * 12))
  // 实际缴费年限：不得超过「退休年龄-当前年龄」。年缴满即停缴，
  // 账户余额继续按记账利率滚存至退休领取日。
  // 两处封顶必须共用同一年限：只封顶个账月数而让基础养老金仍按超额年限算，
  // 会让同一结果里出现两套年限（个账按 5 年、基础养老金按 30 年），养老金被系统性高估。
  const effectiveYears = Math.min(safeYears, safeRetire - safeAge)
  const contributionMonths = Math.min(months, Math.max(0, effectiveYears) * 12)

  // 个人账户累积：缴费期内月复利注入，缴费期后仅复利
  const safeReturn = Number.isFinite(Number(annualReturn))
    ? Math.max(-1, Math.min(1, Number(annualReturn)))
    : 0.05
  const monthlyRate = safeReturn / 12

  let balance = 0
  const monthlyContributionNum = Number(contribution)
  for (let i = 0; i < months; i++) {
    balance = balance * (1 + monthlyRate) + (i < contributionMonths ? monthlyContributionNum : 0)
    // 防止溢出
    if (!Number.isFinite(balance) || balance > 1e15) {
      balance = 1e15
      break
    }
  }
  const personalAccount = safeCent(Math.round(balance))

  // 基础养老金：国发〔2005〕38号公式
  // 缴费指数按法定口径夹取：低于 0.6 按 0.6 计（广东规则），高于 3.0 按 3.0 计
  // （工伤保险条例第64条同类口径：本人工资高于社平300%的按300%）
  const idx = Math.min(3, Math.max(0.6, Number.isFinite(Number(paymentIndex)) ? Number(paymentIndex) : 0.6))
  const basePensionNum = Number(benefitBaseMonthly) * (1 + idx) / 2 * effectiveYears * 0.01
  const basePension = safeCent(Math.round(basePensionNum))

  // 个人账户养老金：计发月数按退休年龄查表（国发〔2005〕38号附表，60 岁 = 139）
  const issuanceMonths = issuanceMonthsForAge(safeRetire)
  const personalPension = personalAccount > Cent.create(0)
    ? safeCent(Math.round(Number(personalAccount) / issuanceMonths))
    : Cent.create(0)

  const totalPension = nonNegCent(addCent(basePension, personalPension))

  return ok({
    personalAccount,
    basePension,
    personalPension,
    totalPension,
    months,
  })
}
