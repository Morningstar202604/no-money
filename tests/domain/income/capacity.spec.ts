/**
 * 产能模型测试。
 *
 * 核心不变量：
 * 1) 单均耗时随距离增加
 * 2) 「想要更多单」必须换算成「需要更多工时」
 * 3) 「投入更多工时」才能得到「更多单」，不是凭空加单
 * 4) 疲劳折减：超过 8 小时后效率下降，不会出现「工时翻倍产出翻倍」
 * 5) 所有输出有限，不产生 NaN/Infinity
 */

import { describe, it, expect } from 'vitest'
import {
  calcCapacity,
  effectiveMinutesPerOrder,
  requiredHoursForOrders,
  requiredClockHoursForOrders,
  achievableOrdersForHours,
  fatigueFactor,
  DEFAULT_CAPACITY,
} from '../../../src/domain/income/capacity'

describe('单均耗时：固定开销 + 骑行时间', () => {
  it('2.5km、20km/h：6 + 7.5 = 13.5 分钟', () => {
    const m = effectiveMinutesPerOrder(2.5)
    expect(m).toBeCloseTo(6 + (2.5 / 20) * 60, 2)
  })

  it('距离越远，单均耗时越长', () => {
    expect(effectiveMinutesPerOrder(5)).toBeGreaterThan(effectiveMinutesPerOrder(2.5))
    expect(effectiveMinutesPerOrder(2.5)).toBeGreaterThan(effectiveMinutesPerOrder(0))
  })

  it('速度为 0 或非法时回落默认值，不产生 Infinity', () => {
    const m = effectiveMinutesPerOrder(2.5, { ...DEFAULT_CAPACITY, avgSpeedKmh: 0 })
    expect(Number.isFinite(m)).toBe(true)
    expect(m).toBeGreaterThan(0)
  })

  it('负距离按 0 处理', () => {
    expect(effectiveMinutesPerOrder(-5)).toBe(DEFAULT_CAPACITY.fixedMinutesPerOrder)
  })
})

describe('产能评估：工时与单量必须自洽', () => {
  it('10 小时、2.5km：可用 540 分钟，产能上限再乘疲劳折减', () => {
    const r = calcCapacity(10, 30, 2.5)
    expect(r.availableMinutes).toBe(600 - 60)
    // 产能 = 可用分钟 ÷ 单均耗时 × 疲劳系数（10 小时已超 8 小时阈值）
    expect(r.maxOrdersPerDay).toBeCloseTo((540 / r.minutesPerOrder) * fatigueFactor(10), 3)
    expect(r.maxOrdersPerDay).toBeLessThan(540 / r.minutesPerOrder)
  })

  it('工时越长，疲劳折减越强（10h 上限低于按分钟线性推算）', () => {
    const a = calcCapacity(8, 30, 2.5)
    const b = calcCapacity(12, 30, 2.5)
    // 12h 的可用分钟是 8h 的 ~1.53 倍，但产能上限增幅更小
    expect(b.maxOrdersPerDay / a.maxOrdersPerDay).toBeLessThan(630 / 390)
  })

  it('单量超出产能时标记 overloaded 并给出所需工时', () => {
    const r = calcCapacity(8, 60, 2.5)
    expect(r.overloaded).toBe(true)
    expect(r.requiredHours).toBeGreaterThan(8)
  })

  it('产能范围内的单量不标记过载', () => {
    const r = calcCapacity(10, 20, 2.5)
    expect(r.overloaded).toBe(false)
  })

  it('短工时不会出现负的可用时间', () => {
    const r = calcCapacity(1, 1, 2.5)
    expect(r.availableMinutes).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(r.maxOrdersPerDay)).toBe(true)
  })
})

describe('双向反推：单量↔工时', () => {
  it('「多接 5 单」需要多少工时：由所需工时反推，不是拍脑袋', () => {
    const hours = requiredHoursForOrders(40, 2.5)
    const back = achievableOrdersForHours(hours, 2.5)
    expect(back).toBeCloseTo(40, 6)
  })

  it('工时越长，可完成单量越多（单调递增）', () => {
    const a = achievableOrdersForHours(8, 2.5)
    const b = achievableOrdersForHours(10, 2.5)
    const c = achievableOrdersForHours(12, 2.5)
    expect(b).toBeGreaterThan(a)
    expect(c).toBeGreaterThan(b)
  })

  it('距离越远，同样工时能完成的单量越少', () => {
    expect(achievableOrdersForHours(10, 5)).toBeLessThan(achievableOrdersForHours(10, 2.5))
  })

  it('零工时零单量，不产生除零', () => {
    expect(achievableOrdersForHours(0, 2.5)).toBe(0)
    expect(requiredHoursForOrders(0, 2.5)).toBe(0)
    expect(requiredClockHoursForOrders(0, 2.5)).toBeCloseTo(DEFAULT_CAPACITY.breakMinutesPerDay / 60, 6)
  })
})

describe('疲劳折减：边际报酬递减', () => {
  it('8 小时内不折减', () => {
    expect(fatigueFactor(6)).toBe(1)
    expect(fatigueFactor(8)).toBe(1)
  })

  it('超过 8 小时后效率单调下降', () => {
    expect(fatigueFactor(10)).toBeLessThan(1)
    expect(fatigueFactor(12)).toBeLessThan(fatigueFactor(10))
    expect(fatigueFactor(14)).toBeLessThan(fatigueFactor(12))
  })

  it('折减幅度温和（12 小时仍有 90% 以上效率）', () => {
    expect(fatigueFactor(12)).toBeGreaterThan(0.9)
  })

  it('可调阈值与系数', () => {
    expect(fatigueFactor(10, 10, 0.15)).toBe(1)
    expect(fatigueFactor(12, 8, 0)).toBe(1)
  })

  it('非法输入不产生 NaN', () => {
    expect(Number.isFinite(fatigueFactor(NaN))).toBe(true)
    expect(Number.isFinite(fatigueFactor(-5))).toBe(true)
  })
})
