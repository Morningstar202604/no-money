import type { CityRule } from '../types'

type Check = (value: unknown) => boolean
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const text: Check = value => typeof value === 'string' && value.trim().length > 0
const number: Check = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
const rate: Check = value => number(value) && (value as number) <= 1
const optional = (check: Check): Check => value => value === undefined || check(value)
const shape = (fields: Record<string, Check>): Check => value => object(value) && Object.entries(fields).every(([key, check]) => check(value[key]))
const list = (check: Check): Check => value => Array.isArray(value) && value.length > 0 && value.every(check)
const bracket = shape({ min: number, max: number, rate: number, deduction: number })
const insurance = shape({ baseMin: number, baseMax: number, rate: number })
const source = shape({
  title: text, retrievedAt: text,
  confidence: value => value === 'official' || value === 'derived' || value === 'unverified',
  docNo: optional(value => typeof value === 'string'), issuedBy: optional(value => typeof value === 'string'),
  url: optional(value => typeof value === 'string'), effectiveFrom: optional(value => typeof value === 'string'), note: optional(value => typeof value === 'string'),
})
const cityRule = shape({
  city: text, cityName: text, year: value => number(value) && Number.isInteger(value),
  lastCheckedAt: text, verified: value => typeof value === 'boolean', occupation: text, occupationName: text,
  income: shape({ basePricePerOrder: number, distanceRate: number, weightSurcharge: shape({ threshold: number, rate: number }),
    timeSubsidy: shape({ peakHours: value => Array.isArray(value) && value.every(text), multiplier: number }),
    holidayMultiplier: number, rainSurcharge: number, monthlyBonus: optional(shape({ threshold: number, amount: number })) }),
  tax: shape({ method: text, laborRemuneration: shape({ expenseDeductionRate: rate, expenseDeductionFixed: optional(number),
    expenseDeductionThreshold: optional(number), basicDeductionMonthly: number, taxTable: list(bracket) }) }),
  benefit: shape({ pension: insurance, medical: insurance,
    medicalTiers: optional(list(shape({ id: text, name: text, rate: rate, note: text }))) }),
  minimumWage: shape({ monthly: number, nonFullTimeHourly: number }),
  retirement: shape({ benefitBaseMonthly: number, paymentIndex: number, assumedAnnualReturn: rate, personalAccountRate: optional(rate) }),
  soleProprietorship: shape({ vatRate: rate, vatThresholdMonthly: number, itrIncomeRate: rate, itrDeductionMonthly: number, bizTaxTable: list(bracket) }),
  sources: value => object(value) && Object.keys(value).length > 0 && Object.values(value).every(source),
})

export function parseCityRule(value: unknown): CityRule {
  if (!cityRule(value)) throw new Error('城市规则格式无效，请核对规则文件')
  const rule = value as CityRule
  const invalidInsurance = [rule.benefit.pension, rule.benefit.medical].some(item => item.baseMin <= 0 || item.baseMax <= item.baseMin || item.rate <= 0 || item.rate >= 1)
  const tableInvalid = (table: CityRule['tax']['laborRemuneration']['taxTable']) =>
    table[0].min !== 0
    // 首档必须零扣除，否则 0 元收入会算出负税并在取整时被掩盖
    || table[0].deduction !== 0
    // 单一档位不得税率为 0，否则等于对所有收入免税
    || (table.length === 1 && table[0].rate === 0)
    || table.some((item, index) =>
      item.max <= item.min
      || item.rate <= 0
      || item.rate >= 1
      || (index > 0 && item.min !== table[index - 1].max)
      // 速算扣除数必须让相邻档位在交界处税额连续，否则会静默算错税
      || (index > 0 && Math.abs(
        table[index - 1].max * table[index - 1].rate - table[index - 1].deduction
        - (table[index - 1].max * item.rate - item.deduction),
      ) > 1),
    )
  if (invalidInsurance || tableInvalid(rule.tax.laborRemuneration.taxTable) || tableInvalid(rule.soleProprietorship.bizTaxTable)) {
    throw new Error('城市规则数值区间无效，请核对规则文件')
  }
  const requiredSources = ['pension', 'pensionRate', 'medical', 'tax', 'minimumWage', 'retirement', 'income', 'soleVat', 'soleItr']
  if (rule.verified && (requiredSources.some(key => !rule.sources[key]) || Object.values(rule.sources).some(s => s.confidence !== 'official' || !(s.docNo || s.url)))) {
    throw new Error('城市规则核验状态与来源不一致')
  }
  return rule
}

export function ruleTimeNotice(rule: CityRule): string {
  return `规则为 ${rule.year} 年版，记录的最近核对日期为 ${rule.lastCheckedAt}；来源和政策可能变化，使用前请向当地主管部门核实，历史核对不代表当前有效。`
}
