/**
 * 工资薪金年度个税：只做年度综合所得口径，不模拟公司每月累计预扣的波动。
 *
 * 输入全部为分：
 *   年应纳税所得额 = 年税前工资 - 年个人五险一金 - 年专项附加扣除 - 6 万元基本减除
 *   年税额 = 年应纳税所得额 × 税率 - 速算扣除数
 * 月到手按年度结果除以 12 展示，并明确告诉用户「实际月度预扣可能前低后高」。
 * 本函数不推断企业缴费比例、不补任何地方费率；个人扣款由用户按工资条填写。
 */
import {
  Cent,
  Rate,
  subCent,
  mulCentRate,
  divCent,
  nonNegCent,
  safeCent,
  safeRate,
} from '../shared/value-objects'
import type { LaborRemunerationRule, TaxError } from './rules'
import { Result, ok, err } from '../shared/result'
import { findBracket } from './calculator'

export interface WageAnnualResult {
  annualGross: Cent
  annualSocialFund: Cent
  annualSpecialDeduction: Cent
  annualBasicDeduction: Cent
  annualTaxable: Cent
  annualTax: Cent
  monthlyTaxAverage: Cent
  annualNet: Cent
  monthlyNet: Cent
  effectiveRate: Rate
}

export interface WageMonth {
  /** 当月税前工资（分） */
  gross: Cent
  /** 当月个人五险一金（分） */
  socialFund: Cent
  /** 当月专项附加扣除（分） */
  specialDeduction: Cent
}

/** 按 12 个月的实际工资逐月求和后算年度综合所得税。 */
export function calcWageAnnualFromMonths(
  months: readonly WageMonth[],
  rule: Pick<LaborRemunerationRule, 'basicDeductionMonthly' | 'taxTable'>,
): Result<WageAnnualResult, TaxError> {
  if (months.length !== 12) {
    return err({ code: 'INVALID_INPUT', message: '工资薪金年度测算必须提供 12 个月的工资' })
  }
  const values = months.flatMap((month) => [Number(month.gross), Number(month.socialFund), Number(month.specialDeduction)])
  if (!values.every(Number.isFinite) || values.some(v => v < 0)) {
    return err({ code: 'INVALID_INPUT', message: '工资、五险一金和专项附加扣除必须是非负数' })
  }
  if (!rule.taxTable.length) {
    return err({ code: 'INVALID_RULE', message: '税率表为空' })
  }

  const annualGross = safeCent(months.reduce((sum, month) => sum + Number(month.gross), 0))
  const annualSocialFund = safeCent(months.reduce((sum, month) => sum + Number(month.socialFund), 0))
  const annualSpecialDeduction = safeCent(months.reduce((sum, month) => sum + Number(month.specialDeduction), 0))
  const annualBasicDeduction = safeCent(Math.round(Number(rule.basicDeductionMonthly) * 12))
  const annualTaxable = nonNegCent(
    subCent(subCent(subCent(annualGross, annualSocialFund), annualSpecialDeduction), annualBasicDeduction),
  )

  const bracketResult = findBracket(annualTaxable, rule.taxTable)
  if (!bracketResult.ok) return bracketResult
  const bracket = bracketResult.value
  const annualTax = nonNegCent(subCent(mulCentRate(annualTaxable, bracket.rate), bracket.deduction))
  const monthlyTaxAverage = divCent(annualTax, 12)
  const annualNet = subCent(subCent(annualGross, annualTax), annualSocialFund)
  const monthlyNet = divCent(annualNet, 12)
  const effectiveRate = Number(annualGross) > 0
    ? safeRate(Number(annualTax) / Number(annualGross))
    : Rate.create(0)

  return ok({
    annualGross,
    annualSocialFund,
    annualSpecialDeduction,
    annualBasicDeduction,
    annualTaxable,
    annualTax,
    monthlyTaxAverage,
    annualNet,
    monthlyNet,
    effectiveRate,
  })
}

export function calcWageAnnual(
  monthlyGross: Cent,
  monthlySocialFund: Cent,
  monthlySpecialDeduction: Cent,
  rule: Pick<LaborRemunerationRule, 'basicDeductionMonthly' | 'taxTable'>,
): Result<WageAnnualResult, TaxError> {
  const gross = Number(monthlyGross)
  const social = Number(monthlySocialFund)
  const special = Number(monthlySpecialDeduction)
  if (![gross, social, special].every(Number.isFinite) || gross < 0 || social < 0 || special < 0) {
    return err({ code: 'INVALID_INPUT', message: '工资、五险一金和专项附加扣除必须是非负数' })
  }

  return calcWageAnnualFromMonths(
    Array.from({ length: 12 }, () => ({
      gross: safeCent(gross),
      socialFund: safeCent(social),
      specialDeduction: safeCent(special),
    })),
    rule,
  )
}
