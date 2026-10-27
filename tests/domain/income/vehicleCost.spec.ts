/**
 * 车辆单位经济学测试。
 *
 * 每个断言回答一个真实问题：
 * - 电动车每公里成本是否显著低于燃油车（这是换车决策的基础）
 * - 多跑单时成本是否真的上升（旧模型里成本是常数）
 * - 空驶是否被计入（骑手实际里程远高于配送里程）
 */

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_ELECTRIC_PROFILE,
  DEFAULT_FUEL_PROFILE,
  variableCostPerKm,
  calcMonthlyCostByKm,
  estimateMonthlyKm,
} from '../../../src/domain/income/vehicleCost'

describe('每公里变动成本分解', () => {
  it('电动车每公里成本由能耗+保养+易损+折旧四项构成', () => {
    const p = variableCostPerKm(DEFAULT_ELECTRIC_PROFILE)
    expect(p.variablePerKm).toBeCloseTo(
      p.energyPerKm + p.maintenancePerKm + p.wearPerKm + p.depreciationPerKm, 3)
  })

  it('电动车每公里成本约为燃油车的 1/3（含折旧后 0.16 vs 0.46 元/km）', () => {
    const e = variableCostPerKm(DEFAULT_ELECTRIC_PROFILE).variablePerKm
    const f = variableCostPerKm(DEFAULT_FUEL_PROFILE).variablePerKm
    expect(e).toBeLessThan(f)
    // 不含折旧的纯能耗差距更大（0.015 vs 0.21，约 14 倍）；
    // 计入折旧后电动车购价低但寿命短，差距收敛到约 2.9 倍
    expect(f / e).toBeGreaterThan(2.5)
    expect(f / e).toBeLessThan(3.5)
  })

  it('电动车能耗项：2.5 kWh/100km × 0.6 元 = 0.015 元/km', () => {
    expect(variableCostPerKm(DEFAULT_ELECTRIC_PROFILE).energyPerKm).toBeCloseTo(0.015, 4)
  })

  it('燃油车能耗项：2.8 L/100km × 7.5 元 = 0.21 元/km', () => {
    expect(variableCostPerKm(DEFAULT_FUEL_PROFILE).energyPerKm).toBeCloseTo(0.21, 4)
  })

  it('保养为零间隔时摊销为 0（不产生除零）', () => {
    const p = variableCostPerKm({ ...DEFAULT_ELECTRIC_PROFILE, maintenanceIntervalKm: 0 })
    expect(p.maintenancePerKm).toBe(0)
    expect(Number.isFinite(p.variablePerKm)).toBe(true)
  })

  it('寿命里程为 0 时折旧摊销为 0（不产生 Infinity）', () => {
    const p = variableCostPerKm({ ...DEFAULT_ELECTRIC_PROFILE, lifetimeKm: 0 })
    expect(p.depreciationPerKm).toBe(0)
    expect(Number.isFinite(p.variablePerKm)).toBe(true)
  })

  it('残值率越高，每公里折旧越低', () => {
    const low = variableCostPerKm({ ...DEFAULT_ELECTRIC_PROFILE, residualRate: 0 })
    const high = variableCostPerKm({ ...DEFAULT_ELECTRIC_PROFILE, residualRate: 0.5 })
    expect(high.depreciationPerKm).toBeLessThan(low.depreciationPerKm)
  })
})

describe('月度成本：固定 + 变动', () => {
  const fixed = {
    insuranceMonth: 100, phoneCostMonth: 100, foodCostMonth: 800,
    trafficFineMonth: 50, otherCostMonth: 100,
  }

  it('月里程为 0 时只有固定成本', () => {
    const r = calcMonthlyCostByKm(fixed, 0, DEFAULT_ELECTRIC_PROFILE)
    expect(r.monthlyVariable).toBe(0)
    expect(r.monthlyTotal).toBe(1150)
  })

  it('多跑单（月里程增加）成本真的上升——这是旧固定成本模型做不到的', () => {
    const a = calcMonthlyCostByKm(fixed, 1000, DEFAULT_ELECTRIC_PROFILE)
    const b = calcMonthlyCostByKm(fixed, 2000, DEFAULT_ELECTRIC_PROFILE)
    expect(b.monthlyTotal).toBeGreaterThan(a.monthlyTotal)
    expect(b.monthlyVariable).toBeCloseTo(a.monthlyVariable * 2, 2)
  })

  it('月度总成本 = 固定 + 月里程 × 每公里成本', () => {
    const r = calcMonthlyCostByKm(fixed, 1500, DEFAULT_FUEL_PROFILE)
    expect(r.monthlyTotal).toBeCloseTo(1150 + 1500 * r.variablePerKm, 2)
  })

  it('负里程按 0 处理', () => {
    expect(calcMonthlyCostByKm(fixed, -500, DEFAULT_ELECTRIC_PROFILE).monthlyVariable).toBe(0)
  })

  it('NaN 里程不产生 NaN 成本', () => {
    const r = calcMonthlyCostByKm(fixed, NaN, DEFAULT_ELECTRIC_PROFILE)
    expect(Number.isFinite(r.monthlyTotal)).toBe(true)
    expect(r.monthlyVariable).toBe(0)
  })
})

describe('月里程估算：必须计入空驶', () => {
  it('35 单 × 2.5km × 26 天 = 2275km 配送里程，含 25% 空驶约 2843.75km', () => {
    expect(estimateMonthlyKm(35, 2.5, 26)).toBeCloseTo(2843.75, 2)
  })

  it('空驶系数可调，系数越高里程越大', () => {
    const low = estimateMonthlyKm(35, 2.5, 26, 0)
    const high = estimateMonthlyKm(35, 2.5, 26, 0.5)
    expect(high).toBeGreaterThan(low)
  })

  it('零单量零里程', () => {
    expect(estimateMonthlyKm(0, 2.5, 26)).toBe(0)
  })

  it('非法输入不产生 NaN', () => {
    expect(Number.isFinite(estimateMonthlyKm(NaN, NaN, NaN))).toBe(true)
  })
})

describe('成本模型的经济含义', () => {
  it('同样的月里程，燃油车总成本显著高于电动车', () => {
    const fixed = { insuranceMonth: 100, phoneCostMonth: 100, foodCostMonth: 800, trafficFineMonth: 50, otherCostMonth: 100 }
    const e = calcMonthlyCostByKm(fixed, 2800, DEFAULT_ELECTRIC_PROFILE)
    const f = calcMonthlyCostByKm(fixed, 2800, DEFAULT_FUEL_PROFILE)
    expect(f.monthlyTotal).toBeGreaterThan(e.monthlyTotal)
    // 差额应达到数百元量级，足以影响「换电动车是否划算」的决策
    expect(f.monthlyTotal - e.monthlyTotal).toBeGreaterThan(300)
  })

  it('月里程越高，电动车相对燃油车的成本优势越大', () => {
    const fixed = { insuranceMonth: 100, phoneCostMonth: 100, foodCostMonth: 800, trafficFineMonth: 50, otherCostMonth: 100 }
    const gap = (km: number) =>
      calcMonthlyCostByKm(fixed, km, DEFAULT_FUEL_PROFILE).monthlyTotal -
      calcMonthlyCostByKm(fixed, km, DEFAULT_ELECTRIC_PROFILE).monthlyTotal
    expect(gap(4000)).toBeGreaterThan(gap(1500))
  })
})
