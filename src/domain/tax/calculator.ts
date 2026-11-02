import { Cent, Rate, addCent, subCent, mulCentRate, divCent, nonNegCent, safeCent, safeRate } from '../shared/value-objects'
import type { TaxBracket, LaborRemunerationRule, SoleProprietorshipRule, TaxBreakdown, TaxError } from './rules'
import { Result, ok, err } from '../shared/result'

/** 税率档次查找：纯函数，无副作用 */
export function findBracket(taxableIncome: Cent, table: readonly TaxBracket[]): Result<TaxBracket, TaxError> {
  if (table.length === 0) {
    return err({ code: 'INVALID_RULE', message: 'Tax table is empty' })
  }
  const income = Number(taxableIncome)
  for (const bracket of table) {
    if (income >= Number(bracket.min) && income < Number(bracket.max)) {
      return ok(bracket)
    }
  }
  // 超过最高档，返回最后一档
  return ok(table[table.length - 1])
}

/** 计算单月费用扣除额（61号公告第八条） */
function calcMonthlyExpenseDeduction(
  monthlyIncome: Cent,
  rule: LaborRemunerationRule
): Cent {
  const income = Number(monthlyIncome)
  const threshold = Number(rule.expenseDeductionThreshold)
  const fixed = Number(rule.expenseDeductionFixed)
  const rate = Number(rule.expenseDeductionRate)

  if (threshold > 0 && income <= threshold) {
    return safeCent(fixed)
  }
  return safeCent(Math.round(income * rate))
}

/** 计算累计应纳税所得额 */
function calcCumulativeTaxable(
  cumulativeIncome: Cent,
  cumulativeExpense: Cent,
  cumulativeDeduction: Cent
): Cent {
  return nonNegCent(subCent(subCent(cumulativeIncome, cumulativeExpense), cumulativeDeduction))
}

/** 计算累计税额 */
function calcCumulativeTax(taxable: Cent, bracket: TaxBracket): Cent {
  const tax = subCent(mulCentRate(taxable, bracket.rate), bracket.deduction)
  return nonNegCent(tax)
}

/** 月度累计预扣法：核心纯函数 */
export function calcLaborMonthly(
  monthlyIncomes: readonly Cent[],
  specialDeductionMonthly: Cent,
  rule: LaborRemunerationRule
): Result<TaxBreakdown, TaxError> {
  if (monthlyIncomes.length !== 12) {
    return err({ code: 'INVALID_INPUT', message: 'monthlyIncomes must have 12 entries', context: { length: monthlyIncomes.length } })
  }

  const basicDeductionMonthly = rule.basicDeductionMonthly
  const specialDeduction = specialDeductionMonthly
  const monthlyDeduction = addCent(basicDeductionMonthly, specialDeduction)

  let cumulativeIncome = Cent.create(0)
  let cumulativeExpense = Cent.create(0)
  let cumulativeDeduction = Cent.create(0)
  let cumulativeTaxPaid = Cent.create(0)

  const monthlyTax: Cent[] = []

  for (let i = 0; i < 12; i++) {
    const rawIncome = monthlyIncomes[i]
    cumulativeIncome = addCent(cumulativeIncome, rawIncome)

    // 本月费用扣除
    const monthExpense = calcMonthlyExpenseDeduction(rawIncome, rule)
    cumulativeExpense = addCent(cumulativeExpense, monthExpense)

    // 累计减除
    cumulativeDeduction = addCent(cumulativeDeduction, monthlyDeduction)

    // 累计应纳税所得额
    const cumulativeTaxable = calcCumulativeTaxable(cumulativeIncome, cumulativeExpense, cumulativeDeduction)

    // 查找税率档次
    const bracketResult = findBracket(cumulativeTaxable, rule.taxTable)
    if (!bracketResult.ok) return bracketResult
    const bracket = bracketResult.value

    // 累计税额
    const cumulativeTax = calcCumulativeTax(cumulativeTaxable, bracket)

    // 本月税额 = 累计税额 - 已预缴税额
    const monthTax = nonNegCent(subCent(cumulativeTax, cumulativeTaxPaid))
    cumulativeTaxPaid = cumulativeTax

    monthlyTax.push(monthTax)
  }

  // 年度合计
  const totalIncome = monthlyIncomes.reduce((sum, inc) => addCent(sum, inc), Cent.create(0))
  const annualTax = monthlyTax.reduce((sum, tax) => addCent(sum, tax), Cent.create(0))

  // 有效税率 = 年度税额 / 总收入 * 100%
  const effectiveRate = Number(totalIncome) > 0
    ? safeRate(Number(annualTax) / Number(totalIncome))
    : Rate.create(0)

  // 税后收入
  const afterTaxIncome = nonNegCent(subCent(totalIncome, annualTax))

  return ok({
    monthlyTax,
    annualTax,
    effectiveRate,
    afterTaxIncome,
    method: 'labor'
  })
}

/** 年度汇算清缴：等价于月度均匀分布 */
export function calcLaborAnnual(
  annualIncome: Cent,
  specialDeductionMonthly: Cent,
  rule: LaborRemunerationRule
): Result<TaxBreakdown, TaxError> {
  const monthlyIncome = divCent(annualIncome, 12)
  const monthlyIncomes = Array(12).fill(monthlyIncome)
  return calcLaborMonthly(monthlyIncomes, specialDeductionMonthly, rule)
}

/** 个体工商户经营所得个税（核定征收） */
export function calcSoleProprietorship(
  annualTurnover: Cent,
  rule: SoleProprietorshipRule
): Result<TaxBreakdown, TaxError> {
  const turnover = nonNegCent(annualTurnover)
  const incomeRate = rule.itrIncomeRate
  const deductionMonthly = rule.itrDeductionMonthly

  // 年应纳税所得额 = 年营业额 × 行业所得率 - 费用减除标准 × 12
  const incomeAmount = mulCentRate(turnover, incomeRate)
  const totalDeductionCent = safeCent(Number(deductionMonthly) * 12)

  const taxable = nonNegCent(subCent(incomeAmount, totalDeductionCent))

  // 查找税率档次
  const bracketResult = findBracket(taxable, rule.bizTaxTable)
  if (!bracketResult.ok) return bracketResult
  const bracket = bracketResult.value

  // 年度税额直接由公式算出
  const annualTax = nonNegCent(subCent(mulCentRate(taxable, bracket.rate), bracket.deduction))

  const monthly = Math.floor(Number(annualTax) / 12)
  const remainder = Number(annualTax) % 12
  const monthlyTax = Array.from({ length: 12 }, (_, i) => safeCent(monthly + (i < remainder ? 1 : 0)))

  // 有效税率 = 年度税额 / 营业额
  const effectiveRate = Number(turnover) > 0
    ? safeRate(Number(annualTax) / Number(turnover))
    : Rate.create(0)

  // 税后收入 = 营业额 - 税额
  const afterTaxIncome = nonNegCent(subCent(turnover, annualTax))

  return ok({
    monthlyTax,
    annualTax,
    effectiveRate,
    afterTaxIncome,
    method: 'sole_proprietorship'
  })
}
