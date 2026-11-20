import type { BenefitRule, BenefitBreakdown, RetirementRule } from '../types'
import { round2 as round } from '../utils/number'
import { issuanceMonthsForAge } from '../utils/issuanceMonths'

/** 调用方可自选的缴费基数；缺省时按申报收入夹取到上下限 */
export interface ContributionBase {
  pensionBase?: number
  medicalBase?: number
}

export class BenefitEngine {
  constructor(private rule: BenefitRule, private retirement?: RetirementRule) {}

  /**
   * 灵活就业人员可自愿参加的只有养老与医保，且需个人全额承担（无单位分担）；
   * 职业伤害保障由平台按单缴费，不构成个人支出。
   *
   * 缴费基数规则原文（粤人社规〔2026〕14号第六条、穗医保规字〔2026〕4号一(一)）
   * 是在上下限范围内"自选"，不是"按实收收入全额申报"，
   * 因此调用方可通过 base 传入用户实际选择的档次；不传时保持按申报收入夹取的保守口径。
   */
  calcMonthly(
    income: number,
    enrolled: boolean,
    medicalTierId?: string,
    base: ContributionBase = {},
  ): BenefitBreakdown {
    const declared = Number.isFinite(income) && income > 0 ? income : 0

    const pensionBase = resolveBase(base.pensionBase, declared, this.rule.pension.baseMin, this.rule.pension.baseMax)
    const tier = this.rule.medicalTiers?.find(t => t.id === medicalTierId)
    // 部分城市各档单独规定基数（如成都统账 6265、单建 7831）；
    // 固定附加费（大额医疗、长护）按档覆盖，未设档时落到 medical.fixedMonthly。
    const medicalBase = tier?.baseMonthly !== undefined
      ? tier.baseMonthly
      : resolveBase(base.medicalBase, declared, this.rule.medical.baseMin, this.rule.medical.baseMax)
    const pensionMonthly = round(pensionBase * this.rule.pension.rate)
    const fixedMonthly = tier?.fixedMonthly ?? this.rule.medical.fixedMonthly ?? 0
    const medicalMonthly = round(medicalBase * (tier?.rate ?? this.rule.medical.rate) + fixedMonthly)

    const items: BenefitBreakdown['items'] = [
      { name: '养老保险', monthly: pensionMonthly, covered: enrolled, risk: 'high' },
      { name: '医疗保险', monthly: medicalMonthly, covered: enrolled, risk: 'high' },
      // 由平台按单缴费，不构成个人支出；但待遇项目少于工伤保险，不等同工伤保障
      { name: '职业伤害保障', monthly: 0, covered: true, risk: 'medium' },
    ]

    return {
      pensionMonthly,
      medicalMonthly,
      totalMonthly: enrolled ? round(pensionMonthly + medicalMonthly) : 0,
      items,
    }
  }

  /**
   * 计发基数、缴费指数、假想收益率都是外部输入，一律从本城规则文件读取，
   * 不在代码里写死字面量——否则调用方漏传时界面显示的收益率与实际计算值会不一致
   * （规则文件当前为 3%，而旧默认值写的是 5%）。无规则时回落广州口径 9493 / 0.6 / 3%。
   */
  projectRetirement(
    currentAge: number,
    retireAge: number,
    monthlyContribution: number,
    yearsContributed: number,
    annualReturn = this.retirement?.assumedAnnualReturn ?? 0.03,
    paymentIndex = this.retirement?.paymentIndex ?? 0.6,
  ) {
    const benefitBase = this.retirement?.benefitBaseMonthly ?? 9493
    const safeAge = Number.isFinite(currentAge) ? currentAge : 0
    const safeRetire = Number.isFinite(retireAge) ? Math.max(retireAge, safeAge) : safeAge
    const safeYears = Number.isFinite(yearsContributed) ? Math.max(yearsContributed, 0) : 0
    const contribution = Number.isFinite(monthlyContribution) ? Math.max(monthlyContribution, 0) : 0

    const months = Math.max(0, Math.round((safeRetire - safeAge) * 12))
    // 缴费年限与基础养老金共用同一年限（不超过到退休的年数）：只封顶个账月数会让
    // 基础养老金按超额年限算，同一结果里两套年限打架。与 domain 同口径，由 parity 锁定。
    const effectiveYears = Math.min(safeYears, safeRetire - safeAge)
    const contributionMonths = Math.min(months, Math.max(0, effectiveYears) * 12)
    let balance = 0
    const safeReturn = Number.isFinite(annualReturn) ? Math.min(Math.max(annualReturn, -1), 1) : 0.05
    for (let i = 0; i < months; i++) {
      balance = balance * (1 + safeReturn / 12) + (i < contributionMonths ? contribution : 0)
    }
    const personalAccount = round(balance)
    // 国发〔2005〕38号：基础养老金 = 计发基数 ×(1+平均缴费指数)÷2 × 缴费年限 × 1%
    // 缴费指数低于 0.6 时按 0.6 计（低于该档需按 0.6/指数 的折扣系数调整，此处取下限口径）
    const idx = Math.max(0.6, Number.isFinite(paymentIndex) ? paymentIndex : 0.6)
    const basePension = round(benefitBase * (1 + idx) / 2 * effectiveYears * 0.01)
    const personalPension = personalAccount > 0 ? round(personalAccount / issuanceMonthsForAge(safeRetire)) : 0
    return { personalAccount, basePension, personalPension, totalPension: round(basePension + personalPension), months }
  }
}

/** 用户自选基数优先；未选或非法时回落到申报收入夹取，再夹到法定上下限 */
function resolveBase(chosen: number | undefined, declared: number, min: number, max: number): number {
  const source = Number.isFinite(chosen) && (chosen as number) > 0 ? (chosen as number) : declared
  return Math.min(Math.max(source, min), max)
}