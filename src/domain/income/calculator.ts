/** 纯计算函数：无副作用、可独立测试 */

import type { IncomeRule, WorkParams, CostParams, IncomeBreakdown, CostBreakdown } from './rules'
import { cent } from './rules'
import { clampNumber as clamp, safeDivide } from '../shared/number'

// 安全除法：统一实现见 ../shared/number.ts（额外处理 NaN/Infinity）
export const safeDiv = safeDivide

/** 解析峰时时段字符串数组，返回总小时数 */
export function peakHoursTotal(peakHours: string[]): number {
  return peakHours.reduce((sum, range) => {
    const [a, b] = range.split('-').map(t => Number(t.slice(0, 2)))
    return sum + (Number.isFinite(a) && Number.isFinite(b) && b > a ? b - a : 0)
  }, 0)
}



/** 计算毛收入分项 */
export function calcIncome(rule: IncomeRule, params: WorkParams): IncomeBreakdown {
  // 允许 0 天：语义上「本月工作 0 天」收入即为 0，不应被夹取成 1 天凭空计钱。
  // dailyBase 由 safeDiv 兜底，不会出现 0/0 = NaN。
  const days = Math.round(clamp(params.workDaysMonth, 0, 31, 1))
  const orders = clamp(params.dailyOrders, 0, 200, 0)
  const dist = clamp(params.avgDistance, 0, 50, 0)
  const hours = clamp(params.dailyHours, 1, 24, 8)

  // 基础计件：单量 × 单价 × 天数
  const basePay = Math.round(orders * rule.basePricePerOrder * days)

  // 距离费：单量 × 距离 × 费率 × 天数
  const distancePay = Math.round(orders * dist * rule.distanceRate * days)

  // 超重件加价：单均重量超过阈值时，超出部分按 元/公斤 计。
  // 单均重量未知（未填写）时不参与计算——此前该字段标注「暂不启用」，
  // 实际规则文件里的阈值与费率从未进入任何一条收入链。
  const weightKg = clamp(params.avgWeightKg, 0, 100, 0)
  const overweightKg = weightKg > rule.weightSurcharge.threshold
    ? weightKg - rule.weightSurcharge.threshold
    : 0
  const weightPay = Math.round(orders * overweightKg * rule.weightSurcharge.rate * days)
  
  // 日基础收入（用于补贴计算）
  const dailyBase = safeDiv(basePay, days)
  
  // 峰时补贴折算：峰时总时长 ÷ 日均工时，上限 1。
  // 短工时（兼职）取 1：跑单者按理性会挑高峰时段，高峰全覆盖；
  // 长工时按 峰时/工时 线性折算（假设其余工时分布在非峰时段）。
  const peakTotalHours = peakHoursTotal(rule.timeSubsidy.peakHours)
  const peakShare = Math.min(1, safeDiv(peakTotalHours, hours))
  const peakSubsidyDaily = dailyBase * (rule.timeSubsidy.multiplier - 1) * peakShare
  
  // 雨天/节假日补贴只在「出勤且当天恰为雨天/节假日」时发生：
  // 天数必须与出勤天数夹取，否则月工作 5 天 + 雨天 30 天会按 30 天计发，
  // 补贴被放大到合理上限的 6 倍
  const rainDays = Math.min(days, Math.round(clamp(params.rainDaysMonth, 0, 31, 0)))
  const rainExtra = rainDays * dailyBase * (rule.rainSurcharge - 1)
  
  // 节假日补贴：节假日天数 × 日基础 × (倍率 - 1)，同样不超出勤天数
  const holidayDays = Math.min(days, Math.round(clamp(params.holidayDaysMonth, 0, 31, 0)))
  const holidayExtra = holidayDays * dailyBase * (rule.holidayMultiplier - 1)
  
  // 补贴合计（超重加价单独计入 distancePay 之外的 weightPay）
  const subsidyPay = Math.round(peakSubsidyDaily * days + rainExtra + holidayExtra)
  
  // 冲单奖
  let bonusPay = 0
  if (rule.monthlyBonus && orders * days >= rule.monthlyBonus.threshold) {
    bonusPay = rule.monthlyBonus.amount
  }
  
  // 毛收入
  const grossIncome = basePay + distancePay + weightPay + subsidyPay + bonusPay

  return {
    basePay: cent(basePay),
    distancePay: cent(distancePay),
    weightPay: cent(weightPay),
    subsidyPay: cent(subsidyPay),
    bonusPay: cent(bonusPay),
    grossIncome: cent(grossIncome),
  }
}

/** 计算成本分项 */
export function calcCosts(params: CostParams): CostBreakdown {
  // 车型决定油/电哪一项真实发生：UI 会隐藏另一项的输入框，
  // 但隐藏的值仍留在参数里。若照旧加总，电动车用户会被已看不见的油费持续扣减净收入。
  // 这里只把「与车型不匹配」的分项归零，不改写输入参数本身——切回原车型即恢复原值。
  const isElectric = params.vehicleType === 'electric'
  const isFuel = params.vehicleType === 'fuel'
  const fuelCostMonth = isElectric ? 0 : clamp(params.fuelCostMonth, 0, 2000000, 0)
  const electricityCostMonth = isFuel ? 0 : clamp(params.electricityCostMonth, 0, 2000000, 0)
  const maintenanceMonth = clamp(params.maintenanceMonth, 0, 2000000, 0)
  const insuranceMonth = clamp(params.insuranceMonth, 0, 2000000, 0)
  const phoneCostMonth = clamp(params.phoneCostMonth, 0, 2000000, 0)
  const foodCostMonth = clamp(params.foodCostMonth, 0, 2000000, 0)
  const trafficFineMonth = clamp(params.trafficFineMonth, 0, 2000000, 0)
  const vehicleDepreciationMonth = clamp(params.vehicleDepreciationMonth, 0, 2000000, 0)
  const otherCostMonth = clamp(params.otherCostMonth, 0, 2000000, 0)
  
  const total = fuelCostMonth + electricityCostMonth + maintenanceMonth + insuranceMonth
    + phoneCostMonth + foodCostMonth + trafficFineMonth + vehicleDepreciationMonth + otherCostMonth
  
  return {
    vehicleType: params.vehicleType,
    fuelCostMonth: cent(fuelCostMonth),
    electricityCostMonth: cent(electricityCostMonth),
    maintenanceMonth: cent(maintenanceMonth),
    insuranceMonth: cent(insuranceMonth),
    phoneCostMonth: cent(phoneCostMonth),
    foodCostMonth: cent(foodCostMonth),
    trafficFineMonth: cent(trafficFineMonth),
    vehicleDepreciationMonth: cent(vehicleDepreciationMonth),
    otherCostMonth: cent(otherCostMonth),
    total: cent(total),
  }
}
