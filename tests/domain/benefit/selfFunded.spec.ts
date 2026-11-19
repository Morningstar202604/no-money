/**
 * 自助养老 vs 社保养老对比测试。
 *
 * 关键不变量：
 * 1) 自助侧的退休余额 = 年金终值解析解
 * 2) 收益率越高，余额越大
 * 3) 同样的钱，社保回本与否要能被量化
 * 4) 长寿风险：自助方案有耗尽年龄，社保没有
 * 5) 所有输出有限，不产生 NaN/Infinity
 */

import { describe, it, expect } from 'vitest'
import { calcSelfFunded, compareSocialVsSelf } from '../../../src/domain/benefit/selfFunded'
import { expectedPensionYears } from '../../../src/domain/benefit/actuarial'

describe('自助积累：年金终值', () => {
  it('月投 1500、20 年、3%：年金终值解析解', () => {
    const r = calcSelfFunded({ monthlyAmount: 1500, years: 20, annualReturn: 0.03 })
    // 年缴 18000，20 年，3% 年金终值
    const expected = 18000 * ((Math.pow(1.03, 20) - 1) / 0.03)
    expect(r.balanceAtRetirement).toBeCloseTo(expected, 1)
  })

  it('零收益率时余额 = 本金总额', () => {
    const r = calcSelfFunded({ monthlyAmount: 1500, years: 20, annualReturn: 0 })
    expect(r.balanceAtRetirement).toBe(1500 * 12 * 20)
    expect(r.investmentGain).toBe(0)
  })

  it('收益率越高，退休余额越大（单调）', () => {
    const a = calcSelfFunded({ monthlyAmount: 1500, years: 20, annualReturn: 0.01 })
    const b = calcSelfFunded({ monthlyAmount: 1500, years: 20, annualReturn: 0.05 })
    const c = calcSelfFunded({ monthlyAmount: 1500, years: 20, annualReturn: 0.08 })
    expect(b.balanceAtRetirement).toBeGreaterThan(a.balanceAtRetirement)
    expect(c.balanceAtRetirement).toBeGreaterThan(b.balanceAtRetirement)
  })

  it('本金与投资收益之和等于余额', () => {
    const r = calcSelfFunded({ monthlyAmount: 2000, years: 25, annualReturn: 0.04 })
    expect(r.totalContributed + r.investmentGain).toBeCloseTo(r.balanceAtRetirement, 1)
  })

  it('领取额按年金摊还：本金越大领取越多', () => {
    const small = calcSelfFunded({ monthlyAmount: 500, years: 20, annualReturn: 0.03 })
    const large = calcSelfFunded({ monthlyAmount: 2000, years: 20, annualReturn: 0.03 })
    expect(large.monthlyWithdrawal).toBeGreaterThan(small.monthlyWithdrawal)
  })

  it('零投入不产生 NaN', () => {
    const r = calcSelfFunded({ monthlyAmount: 0, years: 20, annualReturn: 0.03 })
    expect(r.balanceAtRetirement).toBe(0)
    expect(Number.isFinite(r.monthlyWithdrawal)).toBe(true)
  })
})

describe('社保 vs 自助：对比口径', () => {
  const social = {
    monthlyPension: 3000,
    retireAge: 60,
    monthlyContribution: 1500,
    contributionYears: 20,
    adjustRate: 0.03,
    discountRate: 0.03,
  }
  const self = {
    monthlyAmount: 1500,
    years: 20,
    annualReturn: 0.04,
    payoutReturn: 0.02,
    discountRate: 0.03,
  }

  it('两侧都算出有限的现值', () => {
    const r = compareSocialVsSelf(social, self)
    expect(Number.isFinite(r.social.presentValue)).toBe(true)
    expect(Number.isFinite(r.selfFunded.presentValue)).toBe(true)
  })

  it('社保终身领取：不设耗尽年龄；自助有耗尽年龄', () => {
    const r = compareSocialVsSelf(social, self)
    expect(r.social.coveredUntilAge).toBe(999)
    expect(r.selfFunded.depletionAge).toBeGreaterThan(60)
    expect(r.selfFunded.depletionAge).toBeLessThan(120)
  })

  it('自助收益率越高，资金耗尽越晚（长寿风险越小）', () => {
    const low = compareSocialVsSelf(social, { ...self, annualReturn: 0.02 })
    const high = compareSocialVsSelf(social, { ...self, annualReturn: 0.07 })
    expect(high.selfFunded.depletionAge).toBeGreaterThanOrEqual(low.selfFunded.depletionAge)
  })

  it('现存价值差额符号与两侧现值一致', () => {
    const r = compareSocialVsSelf(social, self)
    expect(r.presentValueGap).toBeCloseTo(r.social.presentValue - r.selfFunded.presentValue, 1)
  })

  it('结构性差异必须被列出（不能只比数字）', () => {
    const r = compareSocialVsSelf(social, self)
    expect(r.caveats.length).toBeGreaterThanOrEqual(4)
    expect(r.caveats.join('')).toContain('终身领取')
    expect(r.caveats.join('')).toContain('医保')
    expect(r.caveats.join('')).toContain('遗属')
    expect(r.caveats.join('')).toContain('继承')
  })

  it('极端输入不产生 NaN', () => {
    const r = compareSocialVsSelf(
      { ...social, monthlyPension: 0, monthlyContribution: 0 },
      { ...self, monthlyAmount: 0, years: 0, annualReturn: NaN as unknown as number },
    )
    expect(Number.isFinite(r.social.presentValue)).toBe(true)
    expect(Number.isFinite(r.selfFunded.presentValue)).toBe(true)
    expect(Number.isFinite(r.presentValueGap)).toBe(true)
  })
})

/**
 * 回归：两侧领取年限必须同口径。
 *
 * 旧实现里 calcSelfFunded 未显式传 payoutYears 时固定按 60 岁 23 年摊还，
 * 与社保侧按退休年龄估算的余命不一致：50 岁退休时社保按 30 年、自助按 23 年，
 * 自助方案的年领取额被抬高、现值被高估，结论偏向「自己存更划算」。
 */
describe('社保 vs 自助：领取年限同口径', () => {
  const baseSocial = {
    monthlyPension: 3000,
    retireAge: 60,
    monthlyContribution: 1500,
    contributionYears: 20,
    adjustRate: 0.03,
    discountRate: 0.03,
  }
  const baseSelf = {
    monthlyAmount: 1500,
    years: 20,
    annualReturn: 0.04,
    payoutReturn: 0.02,
    discountRate: 0.03,
  }

  it('未显式传 payoutYears 时按社保侧退休年龄的预期余命', () => {
    for (const age of [50, 55, 60, 65, 70]) {
      const r = compareSocialVsSelf({ ...baseSocial, retireAge: age }, baseSelf)
      expect(r.selfFunded.payoutYears, `退休 ${age} 岁`).toBeCloseTo(expectedPensionYears(age), 5)
    }
  })

  it('显式传入 payoutYears 时优先使用，不被退休年龄覆盖', () => {
    const r = compareSocialVsSelf({ ...baseSocial, retireAge: 50 }, { ...baseSelf, payoutYears: 15 })
    expect(r.selfFunded.payoutYears).toBe(15)
  })

  it('coversLifeExpectancy 使用同一领取年限判定', () => {
    // 退休越晚预期余命越短，自助资金应按更短的年限摊还；
    // 若仍按 23 年算，年领取额偏低、耗尽判断也会偏差
    const young = compareSocialVsSelf({ ...baseSocial, retireAge: 50 }, baseSelf)
    const old = compareSocialVsSelf({ ...baseSocial, retireAge: 70 }, baseSelf)
    expect(young.selfFunded.payoutYears).toBeGreaterThan(old.selfFunded.payoutYears)
    expect(typeof young.selfFunded.coversLifeExpectancy).toBe('boolean')
    expect(typeof old.selfFunded.coversLifeExpectancy).toBe('boolean')
  })
})
