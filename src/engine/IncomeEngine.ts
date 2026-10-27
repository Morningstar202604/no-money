/**
 * IncomeEngine（UI 原计算路径）
 *
 * ⚠️ 本文件已不再被 UI 调用，仅作为**对拍基准**保留：
 * tests/parity/old-vs-domain.spec.ts 用它比对 domain/income 的产出（单位：元 vs 分）。
 * 在该对拍测试被移除之前请勿删除。
 */
import type { IncomeRule, CostParams, WorkParams, IncomeBreakdown, CostBreakdown } from '../types'
import { round2 as round } from '../utils/number'

export class IncomeEngine {
  constructor(private rule: IncomeRule) {}

  calcIncome(p: WorkParams): IncomeBreakdown {
    const days = safeInt(p.workDaysMonth, 0, 31, 1)
    const orders = safeNum(p.dailyOrders, 0, 200, 0)
    const dist = safeNum(p.avgDistance, 0, 50, 0)
    const hours = safeNum(p.dailyHours, 1, 24, 8)

    const basePay = orders * this.rule.basePricePerOrder * days
    const distancePay = orders * dist * this.rule.distanceRate * days
    const weightKg = safeNum(p.avgWeightKg, 0, 100, 0)
    const overweightKg = weightKg > this.rule.weightSurcharge.threshold
      ? weightKg - this.rule.weightSurcharge.threshold : 0
    const weightPay = orders * overweightKg * this.rule.weightSurcharge.rate * days
    // 除数保护：工作 0 天时日基础应为 0，而不是 0/0 = NaN 污染整条收入链
    const dailyBase = days > 0 ? basePay / days : 0
    // 峰时补贴只作用于峰时段内的单量：占比 = 峰时总时长 ÷ 日均工时，上限 100%
    // 不做折算会把默认参数下的毛收入虚高约 455 元/月
    const peakShare = peakHoursTotal(this.rule.timeSubsidy.peakHours) / hours
    const peakSubsidy = dailyBase * (this.rule.timeSubsidy.multiplier - 1) * Math.min(1, peakShare)
    const rainExtra = Math.min(days, safeNum(p.rainDaysMonth, 0, 31, 0)) * dailyBase * (this.rule.rainSurcharge - 1)
    const holidayExtra = Math.min(days, safeNum(p.holidayDaysMonth, 0, 31, 0)) * dailyBase * (this.rule.holidayMultiplier - 1)
    const subsidyPay = peakSubsidy * days + rainExtra + holidayExtra
    let bonusPay = 0
    if (this.rule.monthlyBonus && orders * days >= this.rule.monthlyBonus.threshold)
      bonusPay = this.rule.monthlyBonus.amount
    return {
      basePay: round(basePay), distancePay: round(distancePay), weightPay: round(weightPay),
      subsidyPay: round(subsidyPay), bonusPay: round(bonusPay),
      grossIncome: round(basePay + distancePay + weightPay + subsidyPay + bonusPay)
    }
  }

  calcCosts(p: CostParams): CostBreakdown {
    // 与 domain/income/calculator 同口径：与车型不匹配的油/电分项不计入
    // （UI 隐藏输入框后隐藏值仍在参数里，照旧加总会扣掉看不见的钱）
    const fuel = p.vehicleType === 'electric' ? 0 : safeNum(p.fuelCostMonth, 0, 20000, 0)
    const electricity = p.vehicleType === 'fuel' ? 0 : safeNum(p.electricityCostMonth, 0, 20000, 0)
    const parts = [
      fuel, electricity, p.maintenanceMonth, p.insuranceMonth,
      p.phoneCostMonth, p.foodCostMonth, p.trafficFineMonth, p.vehicleDepreciationMonth, p.otherCostMonth,
    ].map(v => safeNum(v, 0, 20000, 0))
    const total = parts.reduce((s, v) => s + v, 0)
    return { ...p, fuelCostMonth: fuel, electricityCostMonth: electricity, total: round(total) }
  }
}

/** 把 "11:00-13:00" 这类时段解析为小时数 */
function peakHoursTotal(peakHours: string[]): number {
  return peakHours.reduce((sum, range) => {
    const [a, b] = range.split('-').map(t => Number(t.slice(0, 2)))
    return sum + (Number.isFinite(a) && Number.isFinite(b) && b > a ? b - a : 0)
  }, 0)
}

function safeNum(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.min(Math.max(v, min), max)
}

function safeInt(v: unknown, min: number, max: number, fallback: number): number {
  return Math.round(safeNum(v, min, max, fallback))
}