/**
 * 规则与参数适配器 —— legacy CityRule（元）→ domain 规则（分）
 *
 * 职责边界说明：
 * 本文件是「单位与形状转换」的唯一收口处。domain 层一律以**分**做整数运算，
 * 而对外契约 `src/types` 与 UI 仍使用**元**。所有 ×100 / ÷100 都在这里发生，
 * 业务代码里不允许再出现裸的单位换算。
 *
 * 为什么与 tests/parity 里的同名转换分开写：
 * 对拍测试必须使用**独立实现**，否则适配器写错时两边一起错，对拍就失去意义。
 * 两份实现不一致 = 对拍失败，这正是我们要的信号。
 */

import type { CityRule, WorkParams, CostParams, IncomeOverrides } from '../../types'
import { Cent, Rate, yuanToCent, centToYuan } from '../../domain/shared/value-objects'

import type { IncomeRule as DomainIncomeRule } from '../../domain/income/rules'
import type { WorkParams as DomainWorkParams, CostParams as DomainCostParams } from '../../domain/income/rules'
import type { LaborRemunerationRule as DomainLaborRule } from '../../domain/tax/rules'
import type {
  BenefitRule as DomainBenefitRule,
  RetirementRule as DomainRetirementRule,
} from '../../domain/benefit/rules'

// ===== 元 → 分 =====
export const toCent = (yuan: number): Cent => yuanToCent(yuan)
// ===== 分 → 元（保留 2 位）=====
// 形参用 number 而非 Cent：调用点常直接传入表达式的数值结果（如 basePay / 100），
// 品牌类型在这里是编译期约束而非运行期校验，统一在边界收敛更实际。
export const toYuan = (cent: number): number => centToYuan(cent as Cent)

/**
 * 收入规则：单价与费率单位为元/单、元/千米，转分。
 *
 * overrides 是用户按自己 APP 流水填的实测计价：本城规则里的计价是占位值
 * （平台商业规则无跨平台权威来源），只有覆盖后测算才建立在真实数据上。
 * 覆盖只作用于计价侧；法定参数（社保基数/费率/税率）不接受用户覆盖。
 */
export function adaptIncomeRule(r: CityRule['income'], overrides?: IncomeOverrides): DomainIncomeRule {
  const base = overrides?.basePricePerOrder !== undefined ? overrides.basePricePerOrder : r.basePricePerOrder
  const dist = overrides?.distanceRate !== undefined ? overrides.distanceRate : r.distanceRate
  const peak = overrides?.peakMultiplier !== undefined ? overrides.peakMultiplier : r.timeSubsidy.multiplier
  const rain = overrides?.rainSurcharge !== undefined ? overrides.rainSurcharge : r.rainSurcharge
  const holiday = overrides?.holidayMultiplier !== undefined ? overrides.holidayMultiplier : r.holidayMultiplier
  return {
    basePricePerOrder: toCent(base),
    distanceRate: toCent(dist),
    weightSurcharge: {
      threshold: r.weightSurcharge.threshold,
      rate: toCent(r.weightSurcharge.rate),
    },
    timeSubsidy: { peakHours: r.timeSubsidy.peakHours, multiplier: peak },
    holidayMultiplier: holiday,
    rainSurcharge: rain,
    monthlyBonus: r.monthlyBonus
      ? { threshold: r.monthlyBonus.threshold, amount: toCent(r.monthlyBonus.amount) }
      : undefined,
  }
}

/** 劳务报酬税表：税率表上下限与速算扣除数均以元为单位 */
export function adaptLaborRule(r: CityRule['tax']['laborRemuneration']): DomainLaborRule {
  return {
    expenseDeductionRate: Rate.create(r.expenseDeductionRate),
    expenseDeductionFixed: toCent(r.expenseDeductionFixed ?? 800),
    expenseDeductionThreshold: toCent(r.expenseDeductionThreshold ?? 4000),
    basicDeductionMonthly: toCent(r.basicDeductionMonthly),
    taxTable: r.taxTable.map(b => ({
      min: toCent(b.min),
      max: toCent(b.max),
      rate: Rate.create(b.rate),
      deduction: toCent(b.deduction),
    })),
  }
}

/** 个体工商户核定征收规则 */
export function adaptSoleRule(r: CityRule['soleProprietorship']) {
  return {
    vatRate: Rate.create(r.vatRate),
    vatThresholdMonthly: toCent(r.vatThresholdMonthly),
    itrIncomeRate: Rate.create(r.itrIncomeRate),
    itrDeductionMonthly: toCent(r.itrDeductionMonthly),
    bizTaxTable: r.bizTaxTable.map(b => ({
      min: toCent(b.min),
      max: toCent(b.max),
      rate: Rate.create(b.rate),
      deduction: toCent(b.deduction),
    })),
  }
}

/** 社保规则：缴费基数上下限以元为单位 */
export function adaptBenefitRule(r: CityRule['benefit']): DomainBenefitRule {
  return {
    pension: {
      baseMin: toCent(r.pension.baseMin),
      baseMax: toCent(r.pension.baseMax),
      rate: Rate.create(r.pension.rate),
    },
    medical: {
      baseMin: toCent(r.medical.baseMin),
      baseMax: toCent(r.medical.baseMax),
      rate: Rate.create(r.medical.rate),
    },
    medicalTiers: r.medicalTiers?.map(t => ({
      id: t.id,
      name: t.name,
      rate: Rate.create(t.rate),
      note: t.note,
    })),
  }
}

/** 退休测算规则：计发基数以元为单位 */
export function adaptRetirementRule(r: CityRule['retirement']): DomainRetirementRule {
  return {
    benefitBaseMonthly: toCent(r.benefitBaseMonthly),
    paymentIndex: Rate.create(r.paymentIndex),
    assumedAnnualReturn: Rate.create(r.assumedAnnualReturn),
  }
}

/** 工作参数：工时/单量/天数/距离均无量纲换算 */
export function adaptWork(w: WorkParams, avgWeightKg?: number): DomainWorkParams {
  return {
    city: w.city,
    dailyHours: w.dailyHours as DomainWorkParams['dailyHours'],
    dailyOrders: w.dailyOrders,
    avgDistance: w.avgDistance as DomainWorkParams['avgDistance'],
    workDaysMonth: w.workDaysMonth,
    rainDaysMonth: w.rainDaysMonth,
    holidayDaysMonth: w.holidayDaysMonth,
    avgWeightKg: Number.isFinite(avgWeightKg) ? avgWeightKg : undefined,
  }
}

/** 成本参数：九项金额均为元 → 分 */
export function adaptCosts(c: CostParams): DomainCostParams {
  return {
    vehicleType: c.vehicleType,
    fuelCostMonth: toCent(c.fuelCostMonth),
    electricityCostMonth: toCent(c.electricityCostMonth),
    maintenanceMonth: toCent(c.maintenanceMonth),
    insuranceMonth: toCent(c.insuranceMonth),
    phoneCostMonth: toCent(c.phoneCostMonth),
    foodCostMonth: toCent(c.foodCostMonth),
    trafficFineMonth: toCent(c.trafficFineMonth),
    vehicleDepreciationMonth: toCent(c.vehicleDepreciationMonth),
    otherCostMonth: toCent(c.otherCostMonth),
  }
}