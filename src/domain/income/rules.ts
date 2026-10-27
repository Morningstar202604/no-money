/** 纯类型定义：品牌类型确保单位安全 */

// ===== 品牌类型 =====
// Cent 统一取自 domain/shared/value-objects（全域唯一来源）。
// 此前本文件另行声明过一份形状不同的 Cent（__brand: unique symbol），
// 与 tax / benefit 使用的 Brand<number,'Cent'> 不兼容，导致适配器无法赋值。
// 现统一为单一来源，避免同一概念出现两套不兼容的品牌类型。
import { Cent } from '../shared/value-objects'

/** 分（Cent）：金额最小单位。直接复用 domain/shared/value-objects 的品牌工具，
 *  导出同名符号以便 `import { Cent } from './rules'` 的既有调用方不受影响。 */
export { Cent }
/** 千米 */
export type Kilometer = number & { readonly __brand: 'Kilometer' }
/** 小时 */
export type Hour = number & { readonly __brand: 'Hour' }

/** 构造品牌类型的工厂函数 */
export function cent(n: number): Cent {
  return Cent.create(Number.isFinite(n) ? Math.round(n) : 0)
}
export function kilometer(n: number): Kilometer { return n as Kilometer }
export function hour(n: number): Hour { return n as Hour }

// ===== 收入规则 =====
export interface IncomeRule {
  /** 基础单价（分/单） */
  basePricePerOrder: Cent
  /** 距离费率（分/千米） */
  distanceRate: Cent
  /** 超重件加价：单均超过 threshold 公斤的部分按 rate（分/公斤）加价 */
  weightSurcharge: { threshold: number; rate: Cent }
  /** 时段补贴：峰时时段与倍率 */
  timeSubsidy: { peakHours: string[]; multiplier: number }
  /** 节假日倍率 */
  holidayMultiplier: number
  /** 雨天加价倍率 */
  rainSurcharge: number
  /** 月度冲单奖：门槛单量与奖励金额（分） */
  monthlyBonus?: { threshold: number; amount: Cent }
}

// ===== 工作参数 =====
export interface WorkParams {
  city: string
  /** 日均工时（小时） */
  dailyHours: Hour
  /** 日均单量 */
  dailyOrders: number
  /** 单均距离（千米） */
  avgDistance: Kilometer
  /** 月工作天数 */
  workDaysMonth: number
  /** 月雨天天数 */
  rainDaysMonth: number
  /** 月节假日天数 */
  holidayDaysMonth: number
  /** 单均重量（公斤）；仅在填写时才参与超重件加价，留空表示不适用 */
  avgWeightKg?: number
}

// ===== 成本参数 =====
export interface CostParams {
  vehicleType: 'electric' | 'fuel' | 'mixed'
  /** 油费（分/月） */
  fuelCostMonth: Cent
  /** 电费（分/月） */
  electricityCostMonth: Cent
  /** 维护费（分/月） */
  maintenanceMonth: Cent
  /** 保险费（分/月） */
  insuranceMonth: Cent
  /** 话费（分/月） */
  phoneCostMonth: Cent
  /** 餐费（分/月） */
  foodCostMonth: Cent
  /** 违章罚款（分/月） */
  trafficFineMonth: Cent
  /** 车辆折旧（分/月） */
  vehicleDepreciationMonth: Cent
  /** 其他杂费（分/月） */
  otherCostMonth: Cent
}

// ===== 计算结果 =====
export interface IncomeBreakdown {
  /** 基础计件（分） */
  basePay: Cent
  /** 距离费（分） */
  distancePay: Cent
  /** 超重件加价（分）；单均重量未知或未超阈值时为 0 */
  weightPay: Cent
  /** 补贴合计（分） */
  subsidyPay: Cent
  /** 冲单奖（分） */
  bonusPay: Cent
  /** 毛收入（分） */
  grossIncome: Cent
}

export interface CostBreakdown extends CostParams {
  /** 成本合计（分） */
  total: Cent
}
