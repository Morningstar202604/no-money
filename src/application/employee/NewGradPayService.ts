/**
 * 新毕业生第一年：试用期 + 转正两段工资。
 *
 * 与单月工资条一样，只使用用户填写的税前工资、个人五险一金和专项附加扣除；
 * 不推断单位缴费比例、不补地方社保费率、不判断试用期工资是否合法。
 */
import type { CityRule } from '../../types'
import { adaptLaborRule, toCent, toYuan } from '../adapters/ruleAdapters'
import { calcWageAnnualFromMonths, type WageMonth } from '../../domain/tax/wage'
import { ok, err, type Result } from '../../domain/shared/result'
import { AppError } from '../errors'
import { round2 } from '../../utils/number'

export interface NewGradPayInput {
  /** 试用期月薪（元） */
  probationMonthlyGross: number
  /** 试用期月数（0–12，整数） */
  probationMonths: number
  /** 转正后月薪（元） */
  regularMonthlyGross: number
  /** 个人五险一金/月（元），按工资条填，不推断 */
  monthlySocialFund: number
  /** 专项附加扣除/月（元） */
  monthlySpecialDeduction: number
}

export interface NewGradPayResult {
  probationMonthlyGross: number
  regularMonthlyGross: number
  probationMonths: number
  regularMonths: number
  monthlySocialFund: number
  monthlySpecialDeduction: number
  annualGross: number
  annualTaxable: number
  annualTax: number
  annualNet: number
  /** 试用期月到手：按年度平均税负折算，不是公司当月实际预扣 */
  probationMonthlyNet: number
  /** 转正后月到手：按年度平均税负折算 */
  regularMonthlyNet: number
  probationMonthlyTax: number
  regularMonthlyTax: number
  effectiveRate: number
  /** 个人扣款是否超过任一阶段税前工资；为 true 时 UI 必须提示核对 */
  deductionsExceedGross: boolean
}

/** 把试用期/转正两段工资展开为 12 个月，交给年度综合所得税函数。 */
export function buildNewGradMonths(input: NewGradPayInput): WageMonth[] {
  const months = Math.min(12, Math.max(0, Math.round(input.probationMonths)))
  return Array.from({ length: 12 }, (_, index) => {
    const inProbation = index < months
    return {
      gross: toCent(inProbation ? input.probationMonthlyGross : input.regularMonthlyGross),
      socialFund: toCent(input.monthlySocialFund),
      specialDeduction: toCent(input.monthlySpecialDeduction),
    }
  })
}

export function calcNewGradPay(
  input: NewGradPayInput,
  rule: CityRule,
): Result<NewGradPayResult, AppError> {
  const { probationMonthlyGross, probationMonths, regularMonthlyGross, monthlySocialFund, monthlySpecialDeduction } = input
  const values = [probationMonthlyGross, probationMonths, regularMonthlyGross, monthlySocialFund, monthlySpecialDeduction]
  if (!values.every(Number.isFinite) || values.some(v => v < 0)) {
    return err(AppError.validation('工资、试用期月数、五险一金和专项附加扣除都必须是 0 或正数'))
  }
  if (!Number.isInteger(probationMonths) || probationMonths < 0 || probationMonths > 12) {
    return err(AppError.validation('试用期月数必须是 0–12 的整数'))
  }
  if (regularMonthlyGross <= 0) {
    return err(AppError.validation('转正后月薪必须大于 0'))
  }
  if (probationMonths > 0 && probationMonthlyGross <= 0) {
    return err(AppError.validation('试用期月薪必须大于 0；没有试用期请把月数填 0'))
  }

  const wage = calcWageAnnualFromMonths(
    buildNewGradMonths(input),
    adaptLaborRule(rule.tax.laborRemuneration),
  )
  if (!wage.ok) return err(AppError.validation(wage.error.message))

  const rate = Number(wage.value.effectiveRate)
  const regularMonths = 12 - probationMonths
  // 没有试用期 / 没有转正段时，对应月到手不参与展示，也不能算成负数
  const probationTax = probationMonths > 0 ? round2(probationMonthlyGross * rate) : 0
  const regularTax = regularMonths > 0 ? round2(regularMonthlyGross * rate) : 0
  const probationNet = probationMonths > 0
    ? round2(probationMonthlyGross - monthlySocialFund - probationTax)
    : 0
  const regularNet = regularMonths > 0
    ? round2(regularMonthlyGross - monthlySocialFund - regularTax)
    : 0

  return ok({
    probationMonthlyGross: round2(probationMonthlyGross),
    regularMonthlyGross: round2(regularMonthlyGross),
    probationMonths,
    regularMonths,
    monthlySocialFund: round2(monthlySocialFund),
    monthlySpecialDeduction: round2(monthlySpecialDeduction),
    annualGross: toYuan(wage.value.annualGross),
    annualTaxable: toYuan(wage.value.annualTaxable),
    annualTax: toYuan(wage.value.annualTax),
    annualNet: toYuan(wage.value.annualNet),
    probationMonthlyNet: probationNet,
    regularMonthlyNet: regularNet,
    probationMonthlyTax: probationTax,
    regularMonthlyTax: regularTax,
    effectiveRate: Math.round(rate * 100 * 100) / 100,
    deductionsExceedGross: monthlySocialFund > probationMonthlyGross || monthlySocialFund > regularMonthlyGross,
  })
}
