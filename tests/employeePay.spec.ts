import { describe, expect, it } from 'vitest'
import { calcEmployeePay } from '../src/application/employee/EmployeePayService'
import type { CityRule } from '../src/types'

const rule = {
  tax: {
    laborRemuneration: {
      basicDeductionMonthly: 5000,
      taxTable: [
        { min: 0, max: 36000, rate: 0.03, deduction: 0 },
        { min: 36000, max: 144000, rate: 0.1, deduction: 2520 },
      ],
    },
  },
} as unknown as CityRule

describe('企业职工到手服务', () => {
  it('输入元不被当成分：月到手与个人五险一金展示正确', () => {
    const result = calcEmployeePay({
      monthlyGross: 10000,
      monthlySocialFund: 1000,
      monthlySpecialDeduction: 0,
    }, rule)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.monthlyNet).toBe(8810)
    expect(result.value.monthlySocialFund).toBe(1000)
    expect(result.value.monthlyTaxAverage).toBe(190)
    expect(result.value.annualNet).toBe(105720)
    expect(result.value.effectiveRate).toBe(1.9)
  })

  it('扣款大于工资时给出核对标记', () => {
    const result = calcEmployeePay({
      monthlyGross: 2000,
      monthlySocialFund: 3000,
      monthlySpecialDeduction: 0,
    }, rule)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.deductionsExceedGross).toBe(true)
    expect(result.value.annualTax).toBe(0)
  })
})
