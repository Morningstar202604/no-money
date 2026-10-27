import { Cent, Rate } from '../shared/value-objects'

/** 养老保险规则：纯类型，来自规则文件 */
export interface PensionRule {
  /** 缴费基数下限（分） */
  baseMin: Cent
  /** 缴费基数上限（分） */
  baseMax: Cent
  /** 缴费费率（基点），灵活就业 20% = 0.2 */
  rate: Rate
}

/** 医疗保险规则：纯类型，来自规则文件 */
export interface MedicalRule {
  /** 缴费基数下限（分） */
  baseMin: Cent
  /** 缴费基数上限（分） */
  baseMax: Cent
  /** 默认档费率（基点），灵活就业 8% = 0.08 */
  rate: Rate
}

/** 医保档次：部分城市（如东莞）对灵活就业人按档设费率 */
export interface MedicalTier {
  /** 档次唯一标识 */
  id: string
  /** 档次显示名称 */
  name: string
  /** 该档费率（基点） */
  rate: Rate
  /** 备注说明 */
  note: string
}

/** 社保规则：组合养老与医疗 */
export interface BenefitRule {
  /** 灵活就业人员自行缴纳全部费率，不存在单位分担 */
  pension: PensionRule
  /** 以本人申报收入为基数，夹在上下限之间。rate 为默认档费率 */
  medical: MedicalRule
  /** 部分城市（如东莞）医保分档收费，无单一法定费率；缺省时按 medical.rate 计算 */
  medicalTiers?: readonly MedicalTier[]
}

/** 退休测算规则：纯类型，来自规则文件 */
export interface RetirementRule {
  /** 计发基数（分/月），深圳单列、其余地市用全省口径 */
  benefitBaseMonthly: Cent
  /** 平均缴费指数（基点），广东规则低于 0.6 按 0.6 计 */
  paymentIndex: Rate
  /** 假想年化投资收益率（基点），仅用于个人账户累积测算 */
  assumedAnnualReturn: Rate
}

export { ISSUANCE_MONTHS, DEFAULT_ISSUANCE_MONTHS, issuanceMonthsForAge } from '../../utils/issuanceMonths'

/** 社保引擎配置：组合社保规则与退休规则 */

/** 用户自选的缴费基数（分）；缺省时按申报收入夹取到上下限 */
export interface ContributionBase {
  /** 用户自选的养老缴费基数（分） */
  pensionBase?: Cent
  /** 用户自选的医保缴费基数（分） */
  medicalBase?: Cent
}

/** 月度缴费测算结果：纯数据，分为单位 */
export interface BenefitBreakdown {
  /** 养老保险月缴费（分） */
  pensionMonthly: Cent
  /** 医疗保险月缴费（分） */
  medicalMonthly: Cent
  /** 月缴费合计（分），未参保时为 0 */
  totalMonthly: Cent
  /** 分项明细 */
  items: readonly BenefitItem[]
}

/** 缴费分项明细 */
export interface BenefitItem {
  /** 项目名称 */
  name: string
  /** 月缴费（分） */
  monthly: Cent
  /** 是否覆盖（参保状态） */
  covered: boolean
  /** 风险等级：缺口为 high，覆盖为 low/medium */
  risk: 'high' | 'medium' | 'low'
}

/** 退休测算投影结果：纯数据 */
export interface RetirementProjection {
  /** 个人账户累积储存额（分） */
  personalAccount: Cent
  /** 基础养老金月标准（分） */
  basePension: Cent
  /** 个人账户养老金月标准（分） */
  personalPension: Cent
  /** 月养老金合计（分） */
  totalPension: Cent
  /** 缴费月数 */
  months: number
}

/** 社保计算错误 */
export interface BenefitError {
  code: 'INVALID_INPUT' | 'INVALID_RULE' | 'CITY_NOT_FOUND' | 'TIER_NOT_FOUND' | 'CALCULATION_OVERFLOW'
  message: string
  context?: Record<string, unknown>
}
