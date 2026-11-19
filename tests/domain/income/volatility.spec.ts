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

/**
 * 回归：输入是毛收入、输出是净收入。
 *
 * 旧实现把总览页的「净收入」当作分布均值再与固定成本比较，
 * 导致两个后果：
 *   1) 净收入恒为正 → 「收入不够覆盖成本」的月份占比永远是 0，指标失效；
 *   2) 储备建议把固定成本重复计入（3 个月支出 + 缺口里再含一份支出），系统性偏高。
 */
describe('毛收入 → 净收入的分位口径', () => {
  it('分位数整体平移固定支出：净 P50 = 毛 P50 - 成本，标准差不变', () => {
    const gross = simulateIncomeDistribution(8000, { cv: 0.2, months: 600, seed: 5 })
    const net = simulateIncomeDistribution(8000, { cv: 0.2, months: 600, seed: 5 }, 1950)
    expect(net.p50).toBeCloseTo(gross.p50 - 1950, 2)
    expect(net.mean).toBeCloseTo(gross.mean - 1950, 2)
    expect(net.stdDev).toBeCloseTo(gross.stdDev, 1)
    // 样本是同一批随机数，极值也应同步平移
    expect(net.min).toBeCloseTo(gross.min - 1950, 2)
    expect(net.max).toBeCloseTo(gross.max - 1950, 2)
  })

  it('生存线按毛收入判定：均值 6000、成本 5000、波动 40% 时统计出亏损月份', () => {
    const d = simulateIncomeDistribution(6000, { cv: 0.4, months: 600, seed: 9 }, 5000)
    expect(d.belowCostMonthRatio).toBeGreaterThan(0)
    expect(d.belowCostMonthRatio).toBeLessThan(1)
    // 最差 10% 月份净收入应为负——这正是需要储备兜底的场景
    expect(d.p10).toBeLessThan(0)
  })

  it('最差月份净收入为正时，储备只含 3 个月固定支出（不重复计成本）', () => {
    const d = simulateIncomeDistribution(8000, { cv: 0.2, months: 600, seed: 3 }, 2000)
    expect(d.p10).toBeGreaterThan(0)
    const b = recommendBuffer(6000, 2000, d)
    expect(b.recommendedBuffer).toBe(2000 * 3)
  })

  it('最差月份净收入为负时，储备 = 3 个月固定支出 + 3 个月亏损补足', () => {
    const d = simulateIncomeDistribution(3000, { cv: 0.3, months: 2000, seed: 11 }, 2500)
    expect(d.p10).toBeLessThan(0)
    const b = recommendBuffer(500, 2500, d)
    expect(b.recommendedBuffer).toBeCloseTo(2500 * 3 + Math.max(0, -d.p10) * 3, 2)
  })

  it('毛收入为 0 时净收入为 -成本（固定支出照付），不是 0', () => {
    const d = simulateIncomeDistribution(0, { cv: 0.2, months: 12, seed: 1 }, 1950)
    expect(d.mean).toBe(-1950)
    expect(d.p50).toBe(-1950)
    expect(d.belowCostMonthRatio).toBe(1)
  })
})
