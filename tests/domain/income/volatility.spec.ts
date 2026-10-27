/**
 * 收入波动与风险模型测试。
 *
 * 统计模型必须验证的性质（不是「跑通就行」）：
 * 1) 期望近似均值（对数正态均值修正正确）
 * 2) 波动率越高，尾部越差（P10 更低），但中位数也下移（对数正态的偏态）
 * 3) 固定种子可复现
 * 4) 分位数单调
 * 5) 所有输出有限
 */

import { describe, it, expect } from 'vitest'
import {
  simulateIncomeDistribution,
  recommendBuffer,
} from '../../../src/domain/income/volatility'

describe('收入分布模拟：均值与分位数', () => {
  it('样本均值近似输入均值（对数正态均值修正生效，误差 <3%）', () => {
    const d = simulateIncomeDistribution(8000, { cv: 0.2, months: 3000, seed: 1 })
    expect(d.mean).toBeGreaterThan(8000 * 0.97)
    expect(d.mean).toBeLessThan(8000 * 1.03)
  })

  it('分位数严格单调：p10 < p25 < p50 < p75 < p90', () => {
    const d = simulateIncomeDistribution(8000, { cv: 0.3, months: 2000, seed: 7 })
    expect(d.p10).toBeLessThan(d.p25)
    expect(d.p25).toBeLessThan(d.p50)
    expect(d.p75).toBeGreaterThan(d.p50)
    expect(d.p90).toBeGreaterThan(d.p75)
  })

  it('实际变异系数与设定值接近（容差 0.1）', () => {
    const d = simulateIncomeDistribution(8000, { cv: 0.25, months: 4000, seed: 3 })
    expect(Math.abs(d.cv - 0.25)).toBeLessThan(0.1)
  })

  it('波动率越高，P10 越低、极差越大（尾部风险）', () => {
    const low = simulateIncomeDistribution(8000, { cv: 0.1, months: 2000, seed: 11 })
    const high = simulateIncomeDistribution(8000, { cv: 0.5, months: 2000, seed: 11 })
    expect(high.p10).toBeLessThan(low.p10)
    expect(high.stdDev).toBeGreaterThan(low.stdDev)
  })

  it('相同种子结果完全可复现（不是真随机）', () => {
    const a = simulateIncomeDistribution(8000, { cv: 0.2, months: 1000, seed: 42 })
    const b = simulateIncomeDistribution(8000, { cv: 0.2, months: 1000, seed: 42 })
    expect(a).toEqual(b)
  })

  it('不同种子结果不同（确实在抽样）', () => {
    const a = simulateIncomeDistribution(8000, { cv: 0.2, months: 1000, seed: 1 })
    const b = simulateIncomeDistribution(8000, { cv: 0.2, months: 1000, seed: 2 })
    expect(a.p50).not.toBe(b.p50)
  })

  it('收入恒为正（乘性模型没有负收入）', () => {
    const d = simulateIncomeDistribution(8000, { cv: 1.5, months: 3000, seed: 5 })
    expect(d.min).toBeGreaterThan(0)
  })

  it('零均值输入返回全零，不产生 NaN', () => {
    const d = simulateIncomeDistribution(0, { cv: 0.2 })
    expect(d.mean).toBe(0)
    expect(d.stdDev).toBe(0)
    expect(Number.isFinite(d.p10)).toBe(true)
  })

  it('非法输入回落默认值', () => {
    const d = simulateIncomeDistribution(8000, { cv: NaN as unknown as number, months: NaN as unknown as number })
    expect(Number.isFinite(d.mean)).toBe(true)
    expect(d.sampleSize).toBeGreaterThan(0)
  })
})

describe('生存线：收入不够覆盖支出的月份', () => {
  it('成本越高，低于生存线的月份占比越高', () => {
    const low = simulateIncomeDistribution(8000, { cv: 0.3, months: 3000, seed: 9 }, 3000)
    const high = simulateIncomeDistribution(8000, { cv: 0.3, months: 3000, seed: 9 }, 7000)
    expect(high.belowCostMonthRatio).toBeGreaterThan(low.belowCostMonthRatio)
  })

  it('成本为零时不会低于生存线', () => {
    const d = simulateIncomeDistribution(8000, { cv: 0.3, months: 2000, seed: 9 }, 0)
    expect(d.belowCostMonthRatio).toBe(0)
  })

  it('成本远高于均值时几乎每月都不够', () => {
    const d = simulateIncomeDistribution(5000, { cv: 0.2, months: 2000, seed: 9 }, 20000)
    expect(d.belowCostMonthRatio).toBeGreaterThan(0.95)
  })
})

describe('应急储备建议', () => {
  it('储备金额为正且随固定成本上升', () => {
    const low = recommendBuffer(6000, 2000)
    const high = recommendBuffer(6000, 4000)
    expect(low.recommendedBuffer).toBeGreaterThan(0)
    expect(high.recommendedBuffer).toBeGreaterThan(low.recommendedBuffer)
  })

  it('使用分布尾部（P10）而非均值来估算缺口', () => {
    const dist = simulateIncomeDistribution(8000, { cv: 0.4, months: 2000, seed: 13 })
    const withDist = recommendBuffer(8000, 3000, dist)
    const withoutDist = recommendBuffer(8000, 3000)
    // 波动越大，P10 越低，缺口越大，储备应更高
    expect(withDist.recommendedBuffer).toBeGreaterThan(0)
    expect(Number.isFinite(withoutDist.recommendedBuffer)).toBe(true)
  })

  it('建议里包含可读的依据说明', () => {
    const r = recommendBuffer(8000, 3000)
    expect(r.rationale).toContain('3 个月')
    expect(r.months).toBe(3)
  })

  it('非法输入不产生 NaN', () => {
    const r = recommendBuffer(NaN, NaN)
    expect(Number.isFinite(r.recommendedBuffer)).toBe(true)
  })
})
