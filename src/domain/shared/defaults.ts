/**
 * 默认参数的唯一来源。
 *
 * 为什么必须只有一份：Web 的左侧参数栏、CLI/API/MCP 的 `calculate()` 都声称
 * 「同一输入算出同一个数」，但默认成本此前在 store 与 kernel 各写了一遍，
 * 且逐项金额不同（维护 200/150、餐饮 800/1200、保险 100/0……）。
 * 默认总额恰好都是 1950 元，所以旧测试只对净收入断言时发现不了；
 * 一旦调用方只传部分成本，两套默认就会拼出不同的成本结构。
 *
 * 这里只放数据，不依赖 Vue/Pinia/DOM，Web 与 Node 入口共用。
 */
import type { WorkParams, CostParams, PersonalParams } from '../../types'

/** 默认工作参数；城市只作为缺省值，调用方会按实际请求覆盖 */
export const DEFAULT_WORK: WorkParams = {
  city: 'guangzhou',
  dailyHours: 10,
  dailyOrders: 35,
  avgDistance: 2.5,
  workDaysMonth: 26,
  rainDaysMonth: 3,
  holidayDaysMonth: 2,
}

/** 默认成本参数：把常见月度支出逐项列全，避免「没填=0」被误读为真实账单 */
export const DEFAULT_COSTS: CostParams = {
  vehicleType: 'electric',
  fuelCostMonth: 0,
  electricityCostMonth: 300,
  maintenanceMonth: 200,
  insuranceMonth: 100,
  phoneCostMonth: 100,
  foodCostMonth: 800,
  trafficFineMonth: 50,
  vehicleDepreciationMonth: 300,
  otherCostMonth: 100,
}

/**
 * 默认个人参数。
 * 可选项显式写 undefined：hydrateParams 的白名单按 fallback 的键生成，
 * 缺键会让用户填过的字段在刷新/导入时被静默丢弃。
 */
export const DEFAULT_PERSONAL: PersonalParams = {
  currentAge: 25,
  expectedRetireAge: 60,
  hasSocialInsurance: false,
  specialDeductionMonth: 0,
  medicalTierId: undefined,
  pensionBase: undefined,
  medicalBase: undefined,
  incomeOverrides: undefined,
  assumedAnnualReturn: undefined,
  pensionAdjustRate: undefined,
  discountRate: undefined,
  selfInvestReturn: undefined,
  deadheadRatio: undefined,
  vehicleProfile: undefined,
  statutoryOverrides: undefined,
  personalPensionAnnual: undefined,
  taxHealthInsuranceAnnual: undefined,
}
