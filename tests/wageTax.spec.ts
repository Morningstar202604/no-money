import { describe, expect, it } from 'vitest'
import { calcWageAnnual, calcWageAnnualFromMonths } from '../src/domain/tax/wage'
import { adaptLaborRule } from '../src/application/adapters/ruleAdapters'
import type { CityRule } from '../src/types'
import { Cent } from '../src/domain/shared/value-objects'

const rule = adaptLaborRule({
  expenseDeductionRate: 0.2,
  expenseDeductionFixed: 800,
  expenseDeductionThreshold: 4000,
  basicDeductionMonthly: 5000,
  taxTable: [
    { min: 0, max: 36000, rate: 0.03, deduction: 0 },
    { min: 36000, max: 144000, rate: 0.1, deduction: 2520 },
    { min: 144000, max: 300000, rate: 0.2, deduction: 16920 },
  ],
} as CityRule['tax']['laborRemuneration'])

describe('工资薪金年度个税', () => {
  it('10,000 月薪、个人五险一金 1,000：年税 2,280，月均到手 8,810', () => {
    const result = calcWageAnnual(Cent.create(1000000), Cent.create(100000), Cent.create(0), rule)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.annualTaxable).toBe(4800000)
    expect(result.value.annualTax).toBe(228000)
    expect(result.value.monthlyTaxAverage).toBe(19000)
    expect(result.value.monthlyNet).toBe(881000)
    expect(result.value.annualNet).toBe(10572000)
  })

  it('月薪低于基本减除且无五险一金：税额为 0', () => {
    const result = calcWageAnnual(Cent.create(500000), Cent.create(0), Cent.create(0), rule)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.annualTaxable).toBe(0)
    expect(result.value.annualTax).toBe(0)
    expect(result.value.monthlyNet).toBe(500000)
  })

  it('专项附加扣除降低应纳税所得额；扣款大于工资时不制造负数税额', () => {
    const result = calcWageAnnual(Cent.create(800000), Cent.create(300000), Cent.create(200000), rule)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.annualTaxable).toBe(0)
    expect(result.value.annualTax).toBe(0)
  })

  it('非法输入返回错误，不返回 0 元假结论', () => {
    const result = calcWageAnnual(Cent.create(-1), Cent.create(0), Cent.create(0), rule)
    expect(result.ok).toBe(false)
  })

  it('试用期 3 个月 8,000 + 转正 9 个月 10,000：年税 1,680，第一年到手 100,320', () => {
    const months = Array.from({ length: 12 }, (_, index) => ({
      gross: Cent.create(index < 3 ? 800000 : 1000000),
      socialFund: Cent.create(100000),
      specialDeduction: Cent.create(0),
    }))
    const result = calcWageAnnualFromMonths(months, rule)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.annualGross).toBe(11400000)
    expect(result.value.annualTaxable).toBe(4200000)
    expect(result.value.annualTax).toBe(168000)
    expect(result.value.annualNet).toBe(10032000)
    expect(result.value.monthlyNet).toBe(836000)
  })

  it('变额工资必须正好 12 个月，否则不拿 11 个月当全年', () => {
    const months = Array.from({ length: 11 }, () => ({
      gross: Cent.create(1000000),
      socialFund: Cent.create(0),
      specialDeduction: Cent.create(0),
    }))
    expect(calcWageAnnualFromMonths(months, rule).ok).toBe(false)
  })
})
