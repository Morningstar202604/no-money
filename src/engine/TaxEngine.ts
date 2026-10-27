import type { CityRule, TaxRule, TaxBreakdown } from '../types'
import { round2 as round } from '../utils/number'

/** TaxEngine 所需的最小配置：劳务报酬税表 + 个体户核定征收配置 */
export interface TaxEngineConfig {
  laborRemuneration: TaxRule['laborRemuneration']
  soleProprietorship: CityRule['soleProprietorship']
}

export class TaxEngine {
  constructor(private cfg: TaxEngineConfig) {}

  /**
   * 年度汇算清缴口径（个人所得税税率表一）。
   *
   * 与「累计预扣预缴」的区别：预扣预缴时劳务报酬按每次收入套预扣率表二（20%/30%/40%，
   * 国家税务总局公告2018年第61号第八条），年度汇算时劳务报酬按 80% 折算收入额并入综合所得，
   * 套税率表一（3%-45%）。本方法算的是后者，规则文件的 tax.method 必须如实标注。
   */
  calcLabor(monthlyIncomes: number[], specialDeductionMonth = 0): TaxBreakdown {
    const { expenseDeductionRate, basicDeductionMonthly, expenseDeductionFixed, expenseDeductionThreshold, taxTable } = this.cfg.laborRemuneration
    const fixed = expenseDeductionFixed ?? 0
    const threshold = expenseDeductionThreshold ?? 0
    let cumIncome = 0, cumTaxPaid = 0
    const monthlyTax: number[] = []

    for (let i = 0; i < 12; i++) {
      const raw = monthlyIncomes[i]
      cumIncome += Number.isFinite(raw) ? raw : 0
      // 61号公告第八条：每次收入不超过 4000 元的，减除费用按 800 元计算；超过的按 20%
      const months = i + 1
      const cumExpense = threshold > 0
        ? (cumIncome / months <= threshold ? cumIncome - fixed * months : cumIncome * expenseDeductionRate)
        : cumIncome * expenseDeductionRate
      const cumDeduction = basicDeductionMonthly * months + Math.max(0, specialDeductionMonth) * months
      const cumTaxable = Math.max(0, cumIncome - cumExpense - cumDeduction)
      const bracket = this.findBracket(cumTaxable, taxTable)
      if (!bracket) break
      const cumTax = Math.max(0, cumTaxable * bracket.rate - bracket.deduction)
      const monthTax = Math.max(0, round(cumTax - cumTaxPaid))
      cumTaxPaid = round(cumTax)
      monthlyTax.push(monthTax)
    }

    const totalIncome = monthlyIncomes.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0)
    const annualTax = round(monthlyTax.reduce((s, v) => s + v, 0))
    return {
      monthlyTax, annualTax, effectiveRate: totalIncome > 0 ? round(annualTax / totalIncome * 100) : 0,
      afterTaxIncome: round(totalIncome - annualTax), method: 'labor'
    }
  }

  calcLaborAnnual(annualIncome: number, specialDeductionMonth = 0): TaxBreakdown {
    return this.calcLabor(new Array(12).fill(annualIncome / 12), specialDeductionMonth)
  }

  /**
   * 个体工商户经营所得个人所得税（核定征收）。
   *
   * 核定公式（粤税发〔2018〕79号）：
   *   应纳税所得额 = 经营额 × 行业所得率 − 费用减除标准 × 实际经营月数
   *   应纳税额 = 应纳税所得额 × 税率 − 速算扣除数（经营所得税率表 5%-35%）
   *
   * 早期实现错误地把「增值税 1% 优惠税率」当作个税税率，导致个体户税负被严重低估。
   * 现在增值税与个税分列：增值税见 soleProprietorship.vatRate，个税走本方法。
   *
   * @param annualTurnover 年营业额（经营额）
   */
  calcSoleProprietorship(annualTurnover: number): TaxBreakdown {
    const { itrIncomeRate, itrDeductionMonthly, bizTaxTable } = this.cfg.soleProprietorship
    const turnover = Math.max(0, Number.isFinite(annualTurnover) ? annualTurnover : 0)
    const incomeRate = Math.max(0, itrIncomeRate)
    const deductionMonthly = Math.max(0, itrDeductionMonthly)
    // 年应纳税所得额 = 年营业额 × 行业所得率 − 费用减除标准 × 12
    const taxable = Math.max(0, turnover * incomeRate - deductionMonthly * 12)
    const bracket = this.findBracket(taxable, bizTaxTable)
    // 年度税额直接由公式算出，不经过 12 期 round 之和，避免 100 → 99.96 的偏差
    const annualTax = round(Math.max(0, taxable * bracket.rate - bracket.deduction))
    // 月度值仅用于展示，最后一月兜底使 12 期之和等于年度税额
    const monthly = round(annualTax / 12)
    const monthlyTax = new Array(12).fill(monthly)
    monthlyTax[11] = round(annualTax - monthly * 11)
    return {
      monthlyTax, annualTax, effectiveRate: turnover > 0 ? round(annualTax / turnover * 100) : 0,
      afterTaxIncome: round(turnover - annualTax), method: 'sole_proprietorship'
    }
  }

  private findBracket(taxable: number, table: { min: number; max: number; rate: number; deduction: number }[]) {
    for (const b of table) if (taxable >= b.min && taxable < b.max) return b
    return table[table.length - 1]
  }
}