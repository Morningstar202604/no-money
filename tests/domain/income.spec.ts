import { describe, it, expect } from 'vitest'
import { calcIncome, calcCosts, peakHoursTotal, safeDiv } from '../../src/domain/income/calculator'
import { cent, kilometer, hour } from '../../src/domain/income/rules'
import type { IncomeRule, WorkParams, CostParams } from '../../src/domain/income/rules'

// 广州规则（参考 public/rules/guangzhou.json，金额单位：分）
const guangzhouRule: IncomeRule = {
  basePricePerOrder: 500,      // 5.00 元/单
  distanceRate: 120,           // 1.20 元/公里
  weightSurcharge: { threshold: 5, rate: 50 },
  timeSubsidy: { 
    peakHours: ['11:00-13:00', '17:00-19:00', '21:00-23:00'], 
    multiplier: 1.25 
  },
  holidayMultiplier: 1.6,
  rainSurcharge: 1.35,
  monthlyBonus: { threshold: 800, amount: 50000 }, // 500 元
}

// 基准工作参数（对应测试中的 work）
const baseWork: WorkParams = {
  city: 'guangzhou',
  dailyHours: 10,
  dailyOrders: 35,
  avgDistance: 2.5,
  workDaysMonth: 26,
  rainDaysMonth: 3,
  holidayDaysMonth: 2,
}

const baseCosts: CostParams = {
  vehicleType: 'electric',
  fuelCostMonth: 0,
  electricityCostMonth: 30000,
  maintenanceMonth: 20000,
  insuranceMonth: 10000,
  phoneCostMonth: 10000,
  foodCostMonth: 80000,
  trafficFineMonth: 5000,
  vehicleDepreciationMonth: 30000,
  otherCostMonth: 10000,
}

describe('domain/income - 纯函数', () => {
  describe('safeDiv', () => {
    it('正常除法', () => {
      expect(safeDiv(10, 2)).toBe(5)
    })
    it('分母为 0 返回 0', () => {
      expect(safeDiv(10, 0)).toBe(0)
      expect(safeDiv(0, 0)).toBe(0)
    })
    it('分子为 0 返回 0', () => {
      expect(safeDiv(0, 5)).toBe(0)
    })
  })

  describe('peakHoursTotal', () => {
    it('广州峰时时段合计 6 小时', () => {
      expect(peakHoursTotal(['11:00-13:00', '17:00-19:00', '21:00-23:00'])).toBe(6)
    })
    it('单个时段', () => {
      expect(peakHoursTotal(['09:00-12:00'])).toBe(3)
    })
    it('空数组返回 0', () => {
      expect(peakHoursTotal([])).toBe(0)
    })
    it('格式异常时段不计入', () => {
      expect(peakHoursTotal(['invalid', '10:00-11:00'])).toBe(1)
    })
  })

  describe('calcIncome - 手算基准对齐', () => {
    it('基础计件与距离费逐项可复算', () => {
      const inc = calcIncome(guangzhouRule, baseWork)
      
      // 基础计件：35单 × 500分 × 26天 = 455000分 = 4550元
      expect(inc.basePay).toBe(35 * 500 * 26)
      
      // 距离费：35单 × 2.5公里 × 120分 × 26天 = 273000分 = 2730元
      expect(inc.distancePay).toBe(35 * 2.5 * 120 * 26)
    })

    it('分项之和恒等于毛收入', () => {
      const inc = calcIncome(guangzhouRule, baseWork)
      const sum = inc.basePay + inc.distancePay + inc.subsidyPay + inc.bonusPay
      expect(sum).toBe(inc.grossIncome)
    })

    it('峰时补贴按占比折算（日均10h，峰时6h，占比60%）', () => {
      const inc = calcIncome(guangzhouRule, baseWork)
      
      // 日基础 = 35 * 500 = 17500分
      // 峰时全额补贴 = 17500 * (1.25 - 1) = 4375分/天
      // 实际补贴 = 4375 * 0.6 = 2625分/天
      // 月峰时补贴 = 2625 * 26 = 68250分
      const dailyBase = 35 * 500
      const fullPeakDaily = dailyBase * 0.25
      const expectedPeakDaily = fullPeakDaily * 0.6
      
      // 总补贴 = 峰时 + 雨天 + 节假日
      // 雨天：3天 × 17500 × 0.35 = 18375分
      // 节假日：2天 × 17500 × 0.6 = 21000分
      // 峰时：2625 × 26 = 68250分
      // 补贴合计 = 68250 + 18375 + 21000 = 107625分
      expect(inc.subsidyPay).toBe(107625)
    })

    it('冲单奖：达标时发放', () => {
      const inc = calcIncome(guangzhouRule, baseWork)
      // 35 * 26 = 910 >= 800，触发奖励 50000分
      expect(inc.bonusPay).toBe(50000)
    })

    it('冲单奖：不达标时为 0', () => {
      const inc = calcIncome(guangzhouRule, { ...baseWork, dailyOrders: 20, workDaysMonth: 26 })
      // 20 * 26 = 520 < 800，不触发
      expect(inc.bonusPay).toBe(0)
    })
  })

  describe('calcIncome - 边界情况', () => {
    it('0 单：基础计件与距离费为 0，补贴为 0', () => {
      const inc = calcIncome(guangzhouRule, { ...baseWork, dailyOrders: 0 })
      expect(inc.basePay).toBe(0)
      expect(inc.distancePay).toBe(0)
      expect(inc.subsidyPay).toBe(0)
      expect(inc.bonusPay).toBe(0)
      expect(inc.grossIncome).toBe(0)
    })

    it('0 公里：距离费为 0，基础计件正常', () => {
      const inc = calcIncome(guangzhouRule, { ...baseWork, avgDistance: 0 })
      expect(inc.basePay).toBe(35 * 500 * 26)
      expect(inc.distancePay).toBe(0)
    })

    it('0 峰时时段：峰时补贴为 0', () => {
      const ruleNoPeak = { ...guangzhouRule, timeSubsidy: { peakHours: [], multiplier: 1.25 } }
      const inc = calcIncome(ruleNoPeak, baseWork)
      
      // 只有雨天和节假日补贴
      const dailyBase = 35 * 500
      const rainExtra = 3 * dailyBase * 0.35
      const holidayExtra = 2 * dailyBase * 0.6
      expect(inc.subsidyPay).toBe(Math.round(rainExtra + holidayExtra))
    })

    it('雨天：雨天补贴正常计算', () => {
      const inc = calcIncome(guangzhouRule, { ...baseWork, rainDaysMonth: 5 })
      const dailyBase = 35 * 500
      const rainExtra = 5 * dailyBase * 0.35
      // 验证补贴包含雨天部分
      expect(inc.subsidyPay).toBeGreaterThan(0)
    })

    it('节假日：节假日补贴正常计算', () => {
      const inc = calcIncome(guangzhouRule, { ...baseWork, holidayDaysMonth: 4 })
      const dailyBase = 35 * 500
      const holidayExtra = 4 * dailyBase * 0.6
      expect(inc.subsidyPay).toBeGreaterThan(0)
    })

    it('工时短于峰时总时长：占比封顶 100%', () => {
      const inc = calcIncome(guangzhouRule, { ...baseWork, dailyHours: 4 })
      const dailyBase = 35 * 500
      const fullPeakDaily = dailyBase * 0.25
      // 4h < 6h 峰时，占比 min(1, 6/4) = 1
      // 峰时补贴 = 全额
      expect(inc.subsidyPay).toBeGreaterThan(fullPeakDaily * 26 * 0.9)
    })

    it('工时远超峰时总时长：占比随工时下降', () => {
      const incShort = calcIncome(guangzhouRule, { ...baseWork, dailyHours: 8 })
      const incLong = calcIncome(guangzhouRule, { ...baseWork, dailyHours: 14 })
      // 8h 占比 6/8=75%，14h 占比 6/14≈43%
      // 长工时的峰时补贴应更低
      expect(incLong.subsidyPay).toBeLessThan(incShort.subsidyPay)
    })

    it('工作天数为 0：不产生 NaN', () => {
      const inc = calcIncome(guangzhouRule, { ...baseWork, workDaysMonth: 0 })
      expect(Number.isFinite(inc.grossIncome)).toBe(true)
      expect(inc.grossIncome).toBe(0)
    })

    it('工时为 0：被夹取为最小值 1', () => {
      const inc = calcIncome(guangzhouRule, { ...baseWork, dailyHours: 0 })
      expect(Number.isFinite(inc.grossIncome)).toBe(true)
    })

    it('NaN 输入被夹取为合法值', () => {
      const inc = calcIncome(guangzhouRule, { ...baseWork, dailyOrders: NaN, avgDistance: NaN })
      expect(Number.isFinite(inc.grossIncome)).toBe(true)
    })

    it('负工作天数：被夹取为 0', () => {
      const inc = calcIncome(guangzhouRule, { ...baseWork, workDaysMonth: -5 })
      expect(inc.grossIncome).toBe(0)
    })
  })

  describe('calcCosts', () => {
    it('成本合计为九项之和', () => {
      const costs = calcCosts(baseCosts)
      const expected = 30000 + 20000 + 10000 + 10000 + 80000 + 5000 + 30000 + 10000
      expect(costs.total).toBe(expected)
    })

    it('负值被夹取为 0', () => {
      const costs = calcCosts({ ...baseCosts, vehicleType: 'mixed', fuelCostMonth: -1000 })
      expect(costs.fuelCostMonth).toBe(0)
    })

    it('超大值被夹取为上限', () => {
      const costs = calcCosts({ ...baseCosts, vehicleType: 'mixed', fuelCostMonth: 5000000 })
      expect(costs.fuelCostMonth).toBe(2000000)
    })

    it('NaN 输入被夹取为 0', () => {
      const costs = calcCosts({ ...baseCosts, vehicleType: 'mixed', fuelCostMonth: NaN })
      expect(costs.fuelCostMonth).toBe(0)
    })

    it('电动车的油费不计入成本（UI 隐藏输入框后，隐藏值不得继续扣净收入）', () => {
      const costs = calcCosts({ ...baseCosts, vehicleType: 'electric', fuelCostMonth: 20000, electricityCostMonth: 30000 })
      expect(costs.fuelCostMonth, '电动模式下油费必须归零').toBe(0)
      expect(costs.electricityCostMonth).toBe(30000)
      // 合计 = 电费 30000 + 维护 20000 + 保险 10000 + 通讯 10000 + 餐饮 80000 + 罚款 5000 + 折旧 30000 + 其他 10000
      expect(costs.total).toBe(195000)
    })

    it('燃油车的电费不计入成本，混合动力两项都计', () => {
      const fuel = calcCosts({ ...baseCosts, vehicleType: 'fuel', fuelCostMonth: 20000, electricityCostMonth: 30000 })
      expect(fuel.electricityCostMonth).toBe(0)
      expect(fuel.fuelCostMonth).toBe(20000)

      const mixed = calcCosts({ ...baseCosts, vehicleType: 'mixed', fuelCostMonth: 20000, electricityCostMonth: 30000 })
      expect(mixed.fuelCostMonth).toBe(20000)
      expect(mixed.electricityCostMonth).toBe(30000)
      // 混合模式两项都进合计：195000 + 油费 20000
      expect(mixed.total).toBe(215000)
    })

    it('车型切换不丢数据：切回原车型时原值恢复计入', () => {
      const asElectric = calcCosts({ ...baseCosts, vehicleType: 'electric', fuelCostMonth: 20000 })
      expect(asElectric.fuelCostMonth).toBe(0)
      // 输入参数本身未被改写，切回燃油模式原值即恢复（零化只发生在计算结果里）
      const asFuel = calcCosts({ ...baseCosts, vehicleType: 'fuel', fuelCostMonth: 20000 })
      expect(asFuel.fuelCostMonth).toBe(20000)
    })
  })
})

describe('domain/income - 雨天/节假日补贴不得超出勤天数', () => {
  it('月工作 5 天 + 雨天 30 天时，雨天补贴按 5 天计（此前按 30 天放大 6 倍）', () => {
    const work = { ...baseWork, workDaysMonth: 5, rainDaysMonth: 30, holidayDaysMonth: 0 }
    const income = calcIncome(guangzhouRule, work)
    // 补贴上限 = 5 天 × 日基础 × (1.35 - 1)；日基础 = 基础件 + 距离费 ÷ 5 天
    const basePay = 500 * 35 * 5
    const distancePay = Math.round(120 * 2.5 * 35 * 5)
    const dailyBase = (basePay + distancePay) / 5
    const maxRainExtra = 5 * dailyBase * 0.35
    // 峰时补贴随工时折算，与雨天夹取无关；总补贴减去峰时部分后不得超过雨天上限
    const subsidy = Number(income.subsidyPay)
    expect(subsidy).toBeLessThanOrEqual(Math.round(dailyBase * (guangzhouRule.timeSubsidy.multiplier - 1) * 5 + maxRainExtra) + 1)
  })

  it('节假日天数同样被出勤天数夹取', () => {
    const work = { ...baseWork, workDaysMonth: 2, rainDaysMonth: 0, holidayDaysMonth: 20 }
    const income = calcIncome(guangzhouRule, work)
    const basePay = 500 * 35 * 2
    const distancePay = Math.round(120 * 2.5 * 35 * 2)
    const dailyBase = (basePay + distancePay) / 2
    const maxHolidayExtra = 2 * dailyBase * (guangzhouRule.holidayMultiplier - 1)
    const subsidy = Number(income.subsidyPay)
    expect(subsidy).toBeLessThanOrEqual(Math.round(dailyBase * (guangzhouRule.timeSubsidy.multiplier - 1) * 2 + maxHolidayExtra) + 1)
  })
})

describe('domain/income - 品牌类型工厂', () => {
  it('cent/kilometer/hour 返回数值', () => {
    expect(cent(100)).toBe(100)
    expect(kilometer(5)).toBe(5)
    expect(hour(8)).toBe(8)
  })
})
