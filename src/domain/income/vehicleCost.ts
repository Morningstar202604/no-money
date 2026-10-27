/**
 * 车辆单位经济学：把「油费/电费/维护/折旧」从拍脑袋的月固定额，
 * 改成「固定成本 + 每公里变动成本」两段模型。
 *
 * 为什么重要：当前所有成本都是月度固定值，导致方案对比出现反直觉结论——
 * 「多跑 2 小时」成本完全不变、「多接 5 单」成本完全不变，
 * 于是任何「多跑」都必然增加净收入，模型实际上在鼓励无限加班（已由产能
 * 模型部分约束），但变动成本这一层仍然是缺失的。
 *
 * 建模依据（车辆全生命周期成本 TCO 的标准分解）：
 *   每公里变动成本 = 能耗成本 + 保养摊销 + 轮胎/刹车摊销 + 折旧摊销
 *   月度成本 = 固定成本（保险/停车/通讯）+ 月里程 × 每公里变动成本
 *
 * 各参数均来自可测的业务量（电耗/油耗、保养周期与单价、轮胎寿命、残值率），
 * 用户可用自己的实际账本校准。默认值取常见量级，标注为假设。
 */

import type { CostParams } from '../../types'

/** 费用单位：元（本模块对外用元，内部不做分换算；调用方负责边界） */
export interface VehicleProfile {
  /** 百公里能耗：电动车 kWh/100km，燃油车 L/100km */
  energyPer100km: number
  /** 能源单价：电费 元/kWh，油价 元/L */
  energyPrice: number
  /** 保养间隔（公里） */
  maintenanceIntervalKm: number
  /** 单次保养费用（元） */
  maintenanceCostPerService: number
  /** 轮胎/刹车等易损件每公里摊销（元/公里） */
  wearPerKm: number
  /** 车辆购置价（元） */
  purchasePrice: number
  /** 预计总行驶里程（公里） */
  lifetimeKm: number
  /** 残值率（0-1） */
  residualRate: number
}

/** 行业量级默认值（假设，非官方数据） */
export const DEFAULT_ELECTRIC_PROFILE: VehicleProfile = {
  energyPer100km: 2.5,
  energyPrice: 0.6,
  maintenanceIntervalKm: 5000,
  maintenanceCostPerService: 80,
  wearPerKm: 0.05,
  purchasePrice: 3500,
  lifetimeKm: 40000,
  residualRate: 0.1,
}

export const DEFAULT_FUEL_PROFILE: VehicleProfile = {
  energyPer100km: 2.8,
  energyPrice: 7.5,
  maintenanceIntervalKm: 3000,
  maintenanceCostPerService: 120,
  wearPerKm: 0.08,
  purchasePrice: 9000,
  lifetimeKm: 60000,
  residualRate: 0.15,
}

export interface CostBreakdownByKm {
  /** 每公里能耗成本（元/km） */
  energyPerKm: number
  /** 每公里保养摊销（元/km） */
  maintenancePerKm: number
  /** 每公里易损件摊销（元/km） */
  wearPerKm: number
  /** 每公里折旧摊销（元/km） */
  depreciationPerKm: number
  /** 每公里变动成本合计（元/km） */
  variablePerKm: number
  /** 月度变动成本（元）= 月里程 × 每公里变动成本 */
  monthlyVariable: number
  /** 月度总成本（元）= 固定成本 + 月度变动成本 */
  monthlyTotal: number
  /** 月里程（公里） */
  monthlyKm: number
}

/** 每公里固定摊销项（保养/折旧）与变动项（能耗/易损）分解 */
export function variableCostPerKm(profile: VehicleProfile): Omit<CostBreakdownByKm, 'monthlyVariable' | 'monthlyTotal' | 'monthlyKm'> {
  const energyPerKm = (profile.energyPer100km / 100) * profile.energyPrice
  const maintenancePerKm = profile.maintenanceIntervalKm > 0
    ? profile.maintenanceCostPerService / profile.maintenanceIntervalKm
    : 0
  const depreciationPerKm = profile.lifetimeKm > 0
    ? (profile.purchasePrice * (1 - profile.residualRate)) / profile.lifetimeKm
    : 0
  return {
    energyPerKm: round4(energyPerKm),
    maintenancePerKm: round4(maintenancePerKm),
    wearPerKm: round4(profile.wearPerKm),
    depreciationPerKm: round4(depreciationPerKm),
    variablePerKm: round4(energyPerKm + maintenancePerKm + profile.wearPerKm + depreciationPerKm),
  }
}

/**
 * 月度总成本：固定成本（保险/通讯/餐饮/罚款/其他，即与里程无关的部分）
 * + 月里程 × 每公里变动成本。
 *
 * 注意：月度固定部分沿用用户已填的 CostParams（不含油电费与折旧，
 * 那两项改为按里程计算，避免与变动成本重复计费）。
 */
export function calcMonthlyCostByKm(
  params: Pick<CostParams, 'insuranceMonth' | 'phoneCostMonth' | 'foodCostMonth' | 'trafficFineMonth' | 'otherCostMonth'>,
  monthlyKm: number,
  profile: VehicleProfile,
): CostBreakdownByKm {
  const km = Number.isFinite(monthlyKm) ? Math.max(0, monthlyKm) : 0
  const perKm = variableCostPerKm(profile)
  const fixed = Math.max(0, params.insuranceMonth) + Math.max(0, params.phoneCostMonth)
    + Math.max(0, params.foodCostMonth) + Math.max(0, params.trafficFineMonth)
    + Math.max(0, params.otherCostMonth)
  const monthlyVariable = km * perKm.variablePerKm
  return {
    ...perKm,
    monthlyKm: km,
    monthlyVariable: round2(monthlyVariable),
    monthlyTotal: round2(fixed + monthlyVariable),
  }
}

/** 月里程估算：日单量 × 单均距离 × 月工作天（含空驶系数） */
export function estimateMonthlyKm(dailyOrders: number, avgDistanceKm: number, workDaysMonth: number, deadheadRatio = 0.25): number {
  const orders = Number.isFinite(dailyOrders) ? Math.max(0, dailyOrders) : 0
  const dist = Number.isFinite(avgDistanceKm) ? Math.max(0, avgDistanceKm) : 0
  const days = Number.isFinite(workDaysMonth) ? Math.max(0, workDaysMonth) : 0
  const ratio = Number.isFinite(deadheadRatio) ? Math.max(0, deadheadRatio) : 0.25
  // 空驶系数：接单与返程的空跑里程，按配送里程的比例估算
  return round2(orders * dist * days * (1 + ratio))
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
function round4(v: number): number {
  return Math.round(v * 10000) / 10000
}
