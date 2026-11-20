/**
 * 企业职工工资条到手指南：
 * 只使用用户填写的「税前月薪 + 个人五险一金 + 专项附加扣除」，
 * 不推断企业缴费比例、不补地方社保费率、不把灵活就业费率套到职工身上。
 */
import type { CityRule } from '../../types'
import { adaptLaborRule, toCent, toYuan } from '../adapters/ruleAdapters'
import { calcWageAnnual } from '../../domain/tax/wage'
import { ok, err, type Result } from '../../domain/shared/result'
import { AppError } from '../errors'
import { round2 } from '../../utils/number'

export interface EmployeePayInput {
  monthlyGross: number
  monthlySocialFund: number
  monthlySpecialDeduction: number
}

export interface EmployeePayResult {
  monthlyGross: number
  monthlySocialFund: number
  monthlySpecialDeduction: number
  annualGross: number
  annualTaxable: number
  annualTax: number
  monthlyTaxAverage: number
  annualNet: number
  monthlyNet: number
  effectiveRate: number
  /** 用户填的个人扣款合计是否超过税前工资；为 true 时 UI 必须提示核对 */
  deductionsExceedGross: boolean
}

export function calcEmployeePay(
  input: EmployeePayInput,
  rule: CityRule,
): Result<EmployeePayResult, AppError> {
  const values = [input.monthlyGross, input.monthlySocialFund, input.monthlySpecialDeduction]
  if (!values.every(Number.isFinite) || values.some(v => v < 0)) {
    return err(AppError.validation('税前工资、个人五险一金和专项附加扣除都必须是 0 或正数'))
  }

  const wage = calcWageAnnual(
    toCent(input.monthlyGross),
    toCent(input.monthlySocialFund),
    toCent(input.monthlySpecialDeduction),
    adaptLaborRule(rule.tax.laborRemuneration),
  )
  if (!wage.ok) return err(AppError.validation(wage.error.message))

  return ok({
    // 这三个是用户输入的「元」，不是分；只有 domain 输出才需要 toYuan
    monthlyGross: round2(input.monthlyGross),
    monthlySocialFund: round2(input.monthlySocialFund),
    monthlySpecialDeduction: round2(input.monthlySpecialDeduction),
    annualGross: toYuan(wage.value.annualGross),
    annualTaxable: toYuan(wage.value.annualTaxable),
    annualTax: toYuan(wage.value.annualTax),
    monthlyTaxAverage: toYuan(wage.value.monthlyTaxAverage),
    annualNet: toYuan(wage.value.annualNet),
    monthlyNet: toYuan(wage.value.monthlyNet),
    effectiveRate: Math.round(Number(wage.value.effectiveRate) * 100 * 100) / 100,
    deductionsExceedGross: input.monthlySocialFund > input.monthlyGross,
  })
}
