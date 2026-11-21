import { Cent, Rate } from '../shared/value-objects'

/** 税率档次：纯类型，无行为 */
export interface TaxBracket {
  /** 起始应纳税所得额（分） */
  min: Cent
  /** 结束应纳税所得额（分），不含 */
  max: Cent
  /** 税率（基点） */
  rate: Rate
  /** 速算扣除数（分） */
  deduction: Cent
}

/** 劳务报酬税收规则：纯类型，来自规则文件 */
export interface LaborRemunerationRule {
  /** 费用扣除率（如 0.2） */
  expenseDeductionRate: Rate
  /** 低收入分支固定扣除（分），如 80000 = 800元 */
  expenseDeductionFixed: Cent
  /** 低收入分支适用阈值（分），如 400000 = 4000元 */
  expenseDeductionThreshold: Cent
  /** 基本减除费用（分/月），如 500000 = 5000元 */
  basicDeductionMonthly: Cent
  /** 税率表（税率表一：综合所得 3%-45%） */
  taxTable: readonly TaxBracket[]
}

/** 个体工商户核定征收规则：纯类型，来自规则文件 */
export interface SoleProprietorshipRule {
  /** 增值税优惠税率（小规模纳税人减按1%） */
  vatRate: Rate
  /** 增值税起征点（分/月） */
  vatThresholdMonthly: Cent
  /** 个税核定征收行业所得率 */
  itrIncomeRate: Rate
  /** 核定征收费用减除标准（分/月） */
  itrDeductionMonthly: Cent
  /** 经营所得个税税率表（5%-35%） */
  bizTaxTable: readonly TaxBracket[]
}

/** 税收计算结果：纯数据，分为单位 */
export interface TaxBreakdown {
  /** 月度税额明细（分） */
  monthlyTax: readonly Cent[]
  /** 年度税额合计（分） */
  annualTax: Cent
  /** 年度费用减除合计（分）：劳务报酬为 20% 或 800 元/月，个体户为核定费用减除 */
  expenseDeduction: Cent
  /** 年度应纳税所得额（分） */
  taxableIncome: Cent
  /** 有效税率（基点） */
  effectiveRate: Rate
  /** 税后收入（分） */
  afterTaxIncome: Cent
  /** 计算口径标识 */
  method: 'labor' | 'sole_proprietorship'
}

/** 税收计算错误 */
export interface TaxError {
  code: 'INVALID_INPUT' | 'INVALID_RULE' | 'BRACKET_NOT_FOUND' | 'CALCULATION_OVERFLOW'
  message: string
  context?: Record<string, unknown>
}
