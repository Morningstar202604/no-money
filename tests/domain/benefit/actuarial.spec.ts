/**
 * 养老金精算模型测试。
 *
 * 每个断言都对应一个可手算的基准，确保「划算不划算」的结论不是拍脑袋：
 * 现值用等比年金、缴费用年金终值、回本点按累计现值追平缴费终值。
 */

import { describe, it, expect } from 'vitest'
import {
  calcPensionActuarial,
  expectedPensionYears,
  DEFAULT_PENSION_ADJUST_RATE,
  DEFAULT_DISCOUNT_RATE,
} from '../../../src/domain/benefit/actuarial'

describe('预期领取年限：按退休年龄估算余命', () => {
  it('60 岁约 23 年', () => {
    expect(expectedPensionYears(60)).toBe(23)
  })
  it('退休越晚，预期领取年限越短', () => {
    expect(expectedPensionYears(65)).toBeLessThan(expectedPensionYears(60))
    expect(expectedPensionYears(70)).toBeLessThan(expectedPensionYears(65))
  })
  it('有下限保护（极高龄也不会出现负数或 0 年）', () => {
    expect(expectedPensionYears(95)).toBeGreaterThanOrEqual(8)
  })
  it('非法输入回落默认值', () => {
    expect(expectedPensionYears(NaN)).toBe(20)
  })
})

describe('养老金精算：现值与投入产出', () => {
  const base = {
    monthlyPension: 3000,
    retireAge: 60,
    monthlyContribution: 1500,
    contributionYears: 20,
  }

  it('当调整率 = 贴现率时，现值退化为 P×12×n ÷ (1+g)（增长与贴现完全对冲）', () => {
    const r = calcPensionActuarial({ ...base, adjustRate: 0.03, discountRate: 0.03 })
    // 数学推导：第 t 年金额 P(1+g)^(t-1)，折现 (1+g)^t → 每期现值 = P/(1+g)，
    // 求和 n 期得 PV = n×P/(1+g)。名义额因逐年增长而更大，两者比值 <1 是正常现象。
    expect(r.presentValue).toBeCloseTo(3000 * 12 * r.payoutYears / 1.03, 0)
  })

  it('调整率低于贴现率时，现值显著低于名义总额（通胀侵蚀）', () => {
    const r = calcPensionActuarial({ ...base, adjustRate: 0.01, discountRate: 0.05 })
    expect(r.presentValue).toBeLessThan(r.nominalTotal * 0.8)
  })

  it('调整率高于贴现率时，现值占名义总额的比例更高（购买力保值更好）', () => {
    const high = calcPensionActuarial({ ...base, adjustRate: 0.06, discountRate: 0.02 })
    const low = calcPensionActuarial({ ...base, adjustRate: 0.01, discountRate: 0.06 })
    // d>0 时现值必然小于名义总额（贴现的定义），但 g>d 时保值比例应明显更高
    expect(high.presentValue).toBeLessThan(high.nominalTotal)
    expect(high.presentValue / high.nominalTotal).toBeGreaterThan(low.presentValue / low.nominalTotal)
  })

  it('投入产出倍数：缴费越少、养老金越高，倍数越大', () => {
    const cheap = calcPensionActuarial({ ...base, monthlyContribution: 500 })
    const expensive = calcPensionActuarial({ ...base, monthlyContribution: 3000 })
    expect(cheap.multiple).toBeGreaterThan(expensive.multiple)
  })

  it('回本年龄：缴费更高时回本更晚', () => {
    const cheap = calcPensionActuarial({ ...base, monthlyContribution: 500 })
    const expensive = calcPensionActuarial({ ...base, monthlyContribution: 3000 })
    expect(cheap.breakEvenAge).not.toBeNull()
    if (cheap.breakEvenAge !== null && expensive.breakEvenAge !== null) {
      expect(expensive.breakEvenAge).toBeGreaterThan(cheap.breakEvenAge)
    }
  })

  it('回本年龄必落在退休年龄之后、领取期之内', () => {
    const r = calcPensionActuarial(base)
    expect(r.breakEvenAge).not.toBeNull()
    expect(r.breakEvenAge!).toBeGreaterThan(60)
    expect(r.breakEvenAge!).toBeLessThanOrEqual(60 + r.payoutYears)
  })

  it('零缴费时倍数与回本点不产生 Infinity/NaN', () => {
    const r = calcPensionActuarial({ ...base, monthlyContribution: 0 })
    expect(Number.isFinite(r.multiple)).toBe(true)
    expect(r.multiple).toBe(0)
    expect(Number.isFinite(r.presentValue)).toBe(true)
  })

  it('零养老金时现值与倍数为 0，回本点为 null（永不回本）', () => {
    const r = calcPensionActuarial({ ...base, monthlyPension: 0 })
    expect(r.presentValue).toBe(0)
    expect(r.multiple).toBe(0)
    expect(r.breakEvenAge).toBeNull()
  })

  it('非法假设被夹取并在 assumptions 中回显实际使用值', () => {
    const r = calcPensionActuarial({ ...base, adjustRate: 5, discountRate: -1 })
    expect(r.assumptions.adjustRate).toBeLessThanOrEqual(0.2)
    expect(r.assumptions.discountRate).toBeGreaterThanOrEqual(0)
  })

  it('默认假设是显式常量，不是散落的魔法数字', () => {
    const r = calcPensionActuarial(base)
    expect(r.assumptions.adjustRate).toBe(DEFAULT_PENSION_ADJUST_RATE)
    expect(r.assumptions.discountRate).toBe(DEFAULT_DISCOUNT_RATE)
    expect(r.assumptions.payoutYears).toBe(expectedPensionYears(60))
  })

  it('所有输出都是有限数值（不产生 NaN/Infinity）', () => {
    const r = calcPensionActuarial({ ...base, monthlyPension: NaN, monthlyContribution: Infinity })
    for (const key of ['nominalTotal', 'presentValue', 'contributionPresentValue', 'multiple'] as const) {
      expect(Number.isFinite(r[key]), `${key} 必须是有限值`).toBe(true)
    }
  })
})
