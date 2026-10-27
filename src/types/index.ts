// ===== 核心数据模型 =====

// 每条外部数据必须携带来源，UI 上可逐条回溯；confidence=unverified 的值不得对外引用
export interface SourceRef {
  title: string
  docNo?: string
  issuedBy?: string
  url?: string
  effectiveFrom?: string
  retrievedAt: string
  confidence: 'official' | 'derived' | 'unverified'
  note?: string
}

export interface CityRule {
  city: string
  cityName: string
  year: number
  lastCheckedAt: string
  /** 该城市全部条目均已官方核对时为 true，UI 据此显示数据可信度标识 */
  verified: boolean
  occupation: string
  occupationName: string
  income: IncomeRule
  tax: TaxRule
  benefit: BenefitRule
  minimumWage: { monthly: number; nonFullTimeHourly: number }
  /** 退休测算参数：计发基数与假想收益率均为外部输入，禁止在代码里写死 */
  retirement: RetirementRule
  /** 个体工商户税负参数：增值税与个人所得税是两个税种，必须分列 */
  soleProprietorship: SoleProprietorshipRule
  sources: Record<string, SourceRef>
}

/**
 * 个体工商户税负。
 * 增值税与个人所得税是两套独立体系：
 * - 增值税适用小规模纳税人简易计税的减按优惠（国家层面统一）
 * - 个税核定征收按「行业所得率法」，行业与地区分别核定，不存在全国统一税率
 */
export interface SoleProprietorshipRule {
  /** 小规模纳税人增值税优惠税率（小数） */
  vatRate: number
  /** 增值税起征点（月销售额），未达则免征 */
  vatThresholdMonthly: number
  /** 个税核定征收的行业所得率（小数），随行业与地区变化 */
  itrIncomeRate: number
  /** 核定征收的费用减除标准（元/月），与工资薪金同口径 */
  itrDeductionMonthly: number
  /** 经营所得个人所得税税率表（5%-35%） */
  bizTaxTable: TaxBracket[]
}

/** 养老金计发参数。benefitBaseMonthly 为本城计发基数，深圳单列、其余地市用全省口径 */
export interface RetirementRule {
  benefitBaseMonthly: number
  paymentIndex: number
  assumedAnnualReturn: number
  /** 记入个人账户的费率（粤人社规〔2026〕14号第七条：20% 中 8% 记个人账户、12% 进统筹） */
  personalAccountRate?: number
}

export interface IncomeRule {
  basePricePerOrder: number
  distanceRate: number
  /** 超重件加价：单均超 threshold 公斤部分按 rate 元/公斤加价；单均重量未知时不参与计算 */
  weightSurcharge: { threshold: number; rate: number }
  /** 峰时时段用于折算峰时单量占比（peakHours 合计时长 ÷ 日均工时，上限 100%） */
  timeSubsidy: { peakHours: string[]; multiplier: number }
  holidayMultiplier: number
  rainSurcharge: number
  monthlyBonus?: { threshold: number; amount: number }
}

/**
 * 用户实测计价：本城规则里的平台计价是占位值（无跨平台权威来源），
 * 用户按自己 APP 的流水覆盖后才构成「基于真实数据的测算」。
 * 只允许覆盖计价侧参数——法定参数（社保基数、税率）不允许用户改，
 * 否则工具会输出看似官方的错误结论。
 */
export interface IncomeOverrides {
  /** 每单基础配送费（元/单） */
  basePricePerOrder?: number
  /** 距离费（元/公里） */
  distanceRate?: number
  /** 峰时倍率（如 1.25 表示峰时段 1.25 倍） */
  peakMultiplier?: number
  /** 雨天倍率 */
  rainSurcharge?: number
  /** 节假日倍率 */
  holidayMultiplier?: number
  /** 单均超重公斤数（用于超重加价；留空表示不适用） */
  avgWeightKg?: number
}

export interface TaxRule {
  /**
   * annual_consolidated = 年度汇算清缴口径（税率表一，3%-45%）。
   * 若平台成为扣缴义务人，真实预扣预缴应改用 61号公告预扣率表二（20%/30%/40%），两者差异很大。
   */
  method: string
  laborRemuneration: {
    expenseDeductionRate: number
    /** 61号公告第八条：每次收入不超过 4000 元的，减除费用按 800 元计算 */
    expenseDeductionFixed?: number
    /** 该分支的适用阈值（每次收入额上限），由规则文件承载，不写死在代码里 */
    expenseDeductionThreshold?: number
    basicDeductionMonthly: number
    taxTable: TaxBracket[]
  }
}

export interface TaxBracket {
  min: number
  max: number
  rate: number
  deduction: number
}

export interface BenefitRule {
  /** 灵活就业人员自行缴纳全部费率，不存在单位分担 */
  pension: { baseMin: number; baseMax: number; rate: number }
  /** 以本人申报收入为基数，夹在上下限之间。rate 为默认档费率 */
  medical: { baseMin: number; baseMax: number; rate: number }
  /** 部分城市（如东莞）医保分档收费，无单一法定费率；缺省时按 medical.rate 计算 */
  medicalTiers?: MedicalTier[]
}

/** 医保档次：东莞等地对灵活就业人按档设费率，用户可自行选择实际参保档次 */
export interface MedicalTier {
  id: string
  name: string
  rate: number
  note: string
}

// ===== 用户输入模型 =====

export interface WorkParams {
  city: string
  dailyHours: number
  dailyOrders: number
  avgDistance: number
  workDaysMonth: number
  rainDaysMonth: number
  holidayDaysMonth: number
  /** 单均重量（公斤）；仅在用户填写时参与超重件加价 */
  avgWeightKg?: number
}

export interface CostParams {
  vehicleType: 'electric' | 'fuel' | 'mixed'
  fuelCostMonth: number
  electricityCostMonth: number
  maintenanceMonth: number
  insuranceMonth: number
  phoneCostMonth: number
  foodCostMonth: number
  trafficFineMonth: number
  vehicleDepreciationMonth: number
  otherCostMonth: number
}

export interface PersonalParams {
  currentAge: number
  expectedRetireAge: number
  hasSocialInsurance: boolean
  specialDeductionMonth: number
  /** 医保档次 id，对应 rule.benefit.medicalTiers；为空表示用默认档 */
  medicalTierId?: string
  /** 用户自选的养老缴费基数；为空表示按申报收入夹取 */
  pensionBase?: number
  /** 用户自选的医保缴费基数；为空表示按申报收入夹取 */
  medicalBase?: number
  /**
   * 用户实测计价覆盖（按自己 APP 的流水）。为空表示仍用本城规则里的占位值，
   * 此时测算会在数据质量门禁中被标为「假设测算」。
   */
  incomeOverrides?: IncomeOverrides
  /**
   * 个人账户记账利率假设（年化，如 0.03 表示 3%）。
   * 规则文件里的 assumedAnnualReturn 只是一个默认假设，不是官方发布值；
   * 用户自己设定后才算「按你的假设测算」。为空表示用规则默认值。
   */
  assumedAnnualReturn?: number
  /**
   * 养老金年度调整率假设（精算用，默认 3%）。
   * 近年全国企业退休人员基本养老金调整幅度约 2%-4%，本项目取 3% 为默认假设，
   * 不是官方承诺。影响「终身现值」与「回本年龄」。
   */
  pensionAdjustRate?: number
  /**
   * 贴现率假设（精算用，默认 3%）：钱留在自己手里的机会成本。
   * 影响养老金现值与回本判断，不是市场收益率预测。
   */
  discountRate?: number
  /**
   * 自助养老方案的投资年化收益率假设（默认 4%）。
   * 用于「缴社保 vs 自己存」的对照测算；这是假设，不是收益承诺。
   */
  selfInvestReturn?: number
}

// ===== 计算结果模型 =====

export interface IncomeBreakdown {
  basePay: number
  distancePay: number
  /** 超重件加价（元）；单均重量未知或未超阈值时为 0 */
  weightPay: number
  subsidyPay: number
  bonusPay: number
  grossIncome: number
}

export interface CostBreakdown extends CostParams {
  total: number
}

export interface TaxBreakdown {
  monthlyTax: number[]
  annualTax: number
  effectiveRate: number
  afterTaxIncome: number
  method: 'labor' | 'sole_proprietorship'
}

export interface BenefitBreakdown {
  pensionMonthly: number
  medicalMonthly: number
  totalMonthly: number
  items: { name: string; monthly: number; covered: boolean; risk: 'high' | 'medium' | 'low' }[]
}

export interface ScenarioResult {
  id: string
  name: string
  work: WorkParams
  costs: CostParams
  income: IncomeBreakdown
  costBreakdown: CostBreakdown
  tax: TaxBreakdown
  benefit: BenefitBreakdown
  netMonthly: number
  netAnnual: number
  netHourly: number
  rightsScore: number
  rightsFlags: string[]
  recommendation: 'recommended' | 'viable' | 'risky'
  keyInsights: string[]
  /**
   * 数据质量：本结果依赖的输入里是否存在未回溯官方的占位值。
   * provisional=true 时「最优/推荐」只是按占位假设算出的排序，不得作为决策依据。
   */
  dataQuality: DataQuality
}

export interface DataQuality {
  /** 为 true 表示结果建立在占位/未核实数据上，只能作为假设测算展示 */
  provisional: boolean
  /** 未核实的字段名（中文标签），供 UI 直接展示 */
  unverifiedFields: string[]
  /** 已回溯官方的字段名（中文标签） */
  officialFields: string[]
  /** 用户用自己的流水实测覆盖过的字段名（中文标签）；这些字段不再计入 provisional */
  overriddenFields?: string[]
}

export interface ComparisonResult {
  scenarios: ScenarioResult[]
  best: ScenarioResult | null
  ranking: { id: string; netAnnual: number; label: string }[]
  summary: string
}

// ===== 权益补偿结果（供文书生成器引用） =====

/**
 * claim        — 可直接主张，计入合计
 * conditional  — 需前置条件（行政责令、劳动关系认定、解除/终止等）才成立
 * info         — 无金额或裁审口径不一，仅作提示
 */
export interface CompensationItem { name: string; amount: number; note: string; kind: 'claim' | 'conditional' | 'info' }
export interface CompensationLegalRef { law: string; article: string; summary: string }
export interface CompensationResult {
  scene: string
  total: number
  conditionalTotal: number
  items: CompensationItem[]
  legalRefs: CompensationLegalRef[]
}
