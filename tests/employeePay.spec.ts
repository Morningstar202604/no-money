import { describe, expect, it } from 'vitest'
import { calcEmployeePay } from '../src/application/employee/EmployeePayService'
import { calcNewGradPay } from '../src/application/employee/NewGradPayService'
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

describe('新毕业生第一年', () => {
  it('试用期 3 个月 8,000 + 转正 9 个月 10,000：年税 1,680，两段月到手按年度税负折算', () => {
    const result = calcNewGradPay({
      probationMonthlyGross: 8000,
      probationMonths: 3,
      regularMonthlyGross: 10000,
      monthlySocialFund: 1000,
      monthlySpecialDeduction: 0,
    }, rule)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.annualGross).toBe(114000)
    expect(result.value.annualTax).toBe(1680)
    expect(result.value.annualNet).toBe(100320)
    expect(result.value.probationMonthlyNet).toBe(6882.11)
    expect(result.value.regularMonthlyNet).toBe(8852.63)
    expect(result.value.regularMonths).toBe(9)
  })

  it('试用期 0 个月等价于全年转正工资', () => {
    const result = calcNewGradPay({
      probationMonthlyGross: 0,
      probationMonths: 0,
      regularMonthlyGross: 10000,
      monthlySocialFund: 1000,
      monthlySpecialDeduction: 0,
    }, rule)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.annualGross).toBe(120000)
    expect(result.value.annualTax).toBe(2280)
    expect(result.value.regularMonthlyNet).toBe(8810)
    expect(result.value.probationMonthlyNet).toBe(0)
  })

  it('试用期月数不是 0–12 的整数时返回错误', () => {
    const result = calcNewGradPay({
      probationMonthlyGross: 8000,
      probationMonths: 12.5,
      regularMonthlyGross: 10000,
      monthlySocialFund: 1000,
      monthlySpecialDeduction: 0,
    }, rule)
    expect(result.ok).toBe(false)
  })

  it('有试用期但试用期工资为 0 时返回错误；扣款超过工资时给出标记', () => {
    const bad = calcNewGradPay({
      probationMonthlyGross: 0,
      probationMonths: 3,
      regularMonthlyGross: 10000,
      monthlySocialFund: 1000,
      monthlySpecialDeduction: 0,
    }, rule)
    expect(bad.ok).toBe(false)

    const flagged = calcNewGradPay({
      probationMonthlyGross: 8000,
      probationMonths: 3,
      regularMonthlyGross: 10000,
      monthlySocialFund: 9000,
      monthlySpecialDeduction: 0,
    }, rule)
    expect(flagged.ok).toBe(true)
    if (!flagged.ok) return
    expect(flagged.value.deductionsExceedGross).toBe(true)
  })
})
