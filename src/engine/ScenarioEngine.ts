/**
 * ScenarioEngine（UI 原计算路径）
 *
 * ⚠️ 本文件已不再被 UI 调用，仅作为**对拍基准**保留：
 * tests/parity/scenario-service.spec.ts 用它逐项比对 application/scenario/ScenarioService
 * 的产出（收入分项、个税12 期明细、社保、净收入、权益评分、洞察文本、排序摘要）。
 *
 * 在该对拍测试被移除之前**请勿删除本文件**，否则将失去「新旧口径一致」的唯一护栏。
 * 如需修改方案编排逻辑，请改 ScenarioService，然后让对拍测试告诉你哪里不一致。
 */
import type { CityRule, WorkParams, CostParams, PersonalParams, ScenarioResult, ComparisonResult } from '../types'
import { IncomeEngine } from './IncomeEngine'
import { TaxEngine, type TaxEngineConfig } from './TaxEngine'
import { BenefitEngine } from './BenefitEngine'
import { round2 as round } from '../utils/number'
import { dataQualityOf } from '../utils/dataQuality'

export class ScenarioEngine {
  constructor(private rule: CityRule) {}

  runScenario(id: string, name: string, work: WorkParams, costs: CostParams, personal: PersonalParams): ScenarioResult {
    const incEng = new IncomeEngine(this.rule.income)
    const income = incEng.calcIncome(work)
    const costBrk = incEng.calcCosts(costs)

    const monthlyGross = income.grossIncome
    const taxEngineConfig: TaxEngineConfig = {
      laborRemuneration: this.rule.tax.laborRemuneration,
      soleProprietorship: this.rule.soleProprietorship
    }
    const tax = new TaxEngine(taxEngineConfig).calcLabor(new Array(12).fill(monthlyGross), personal.specialDeductionMonth)
    // 缴费基数可由用户自选（粤人社规〔2026〕14号第六条），未选时按申报收入夹取
    const benefit = new BenefitEngine(this.rule.benefit, this.rule.retirement).calcMonthly(
      monthlyGross, personal.hasSocialInsurance, personal.medicalTierId,
      { pensionBase: personal.pensionBase, medicalBase: personal.medicalBase },
    )

    const monthlyTax = tax.annualTax / 12
    const insuranceCost = benefit.totalMonthly
    const netMonthly = round(monthlyGross - costBrk.total - monthlyTax - insuranceCost)
    // 年度必须等于月度的 12 倍，否则 UI 同屏展示的月净与年净会对不上
    const netAnnual = round(netMonthly * 12)
    // 时薪只在确实有工作小时时有意义：0 天工作时用 1 小时兜底会把整月固定亏损
    // 除成假时薪（-195/h），与 ScenarioService 同口径，由 parity 锁定。
    const hours = work.dailyHours * work.workDaysMonth
    const netHourly = hours > 0 && Number.isFinite(hours) ? round(netMonthly / hours) : 0

    const { score: rightsScore, flags: rightsFlags } = this.calcRightsScore(work, costBrk.total, income.grossIncome, personal, benefit)
    // 保障缺失时封顶为 viable：否则净收入一高就出现"推荐你不参保"的反向激励。
    // 评级在「缴社保前」的收入能力上计算（社保是保障储备而非亏损，不能因参保降级），
    // 底线用本城最低工资（月）当锚，与 ScenarioService 同口径（parity 测试锁定）。
    const incomeCapacity = netMonthly + insuranceCost
    const minWageFloor = this.rule.minimumWage.monthly
    const incomeTier = incomeCapacity > minWageFloor * 2 ? 'recommended' : incomeCapacity > minWageFloor ? 'viable' : 'risky'
    const recommendation = !personal.hasSocialInsurance && incomeTier === 'recommended' ? 'viable' : incomeTier
    const keyInsights = this.generateInsights(work, costs, tax, netMonthly, benefit, personal)
    // 与 ScenarioService 共用同一判定函数（utils/dataQuality），避免两条路径漂移
    const dataQuality = dataQualityOf(this.rule.sources, personal.hasSocialInsurance)

    return { id, name, work, costs, income, costBreakdown: costBrk, tax, benefit, netMonthly, netAnnual, netHourly, rightsScore, rightsFlags, recommendation, keyInsights, dataQuality }
  }

  compare(scenarios: ScenarioResult[]): ComparisonResult {
    const ranking = scenarios
      .map(s => ({ id: s.id, netAnnual: s.netAnnual, label: s.name }))
      .sort((a, b) => b.netAnnual - a.netAnnual)

    const best = scenarios.reduce((b, s) => s.netAnnual > (b?.netAnnual || -Infinity) ? s : b, null as ScenarioResult | null)

    const summary = best
      ? `「${best.name}」方案年净收入 ¥${best.netAnnual.toLocaleString()}，排名第一。比第二名多 ¥${((best.netAnnual - (ranking[1]?.netAnnual || best.netAnnual))).toLocaleString()}/年。权益评分 ${best.rightsScore}/100。`
      : '请添加至少一个方案进行对比。'

    return { scenarios, best, ranking, summary }
  }

  private calcRightsScore(work: WorkParams, costTotal: number, grossIncome: number, personal: PersonalParams, benefit: ReturnType<BenefitEngine['calcMonthly']>): { score: number; flags: string[] } {
    let score = 100
    const flags: string[] = []

    if (!personal.hasSocialInsurance) {
      flags.push('未缴社保：发生重大疾病时医保与养老待遇全额自付，风险极高')
    }

    const uncoveredHighRisk = benefit.items.filter(i => !i.covered && i.risk === 'high')
    if (uncoveredHighRisk.length > 0) {
      score -= uncoveredHighRisk.length * 10
      flags.push(`缺少保障：${uncoveredHighRisk.map(i => i.name).join('、')}`)
    }

    if (work.dailyHours > 11) {
      score -= 15
      flags.push('日均超11小时：连续高强度作业，健康与事故风险显著上升')
    } else if (work.dailyHours > 8) {
      score -= 5
      flags.push('日均超8小时：超出部分在劳动关系下应付1.5倍报酬')
    }

    if (work.workDaysMonth >= 26) {
      score -= 10
      flags.push('月工作26天+：远超法定21.75天，每月至少应享4天休息')
    } else if (work.workDaysMonth >= 22) {
      score -= 3
      flags.push('月工作22天+：接近法定上限，注意休息权')
    }

    // 成本占比口径（与 ScenarioService 一致），不写死 3000 元绝对值
    if (grossIncome > 0 && costTotal / grossIncome > 0.35) {
      score -= 5
      flags.push(`运营成本偏高：占毛收入的 ${((costTotal / grossIncome) * 100).toFixed(0)}%，高固定支出压缩净收入`)
    }

    score -= 5
    flags.push('单一收入来源：平台政策变动即影响全部收入，无兜底')

    return { score: Math.max(0, score), flags }
  }

  private generateInsights(work: WorkParams, costs: CostParams, tax: { effectiveRate: number; annualTax: number }, netMonthly: number, benefit: ReturnType<BenefitEngine['calcMonthly']>, personal: PersonalParams): string[] {
    const insights: string[] = []
    const dailyNet = netMonthly / (work.workDaysMonth || 1)
    // 阈值锚定本城最低工资（与 ScenarioService 同口径），不写死一线城市购买力数字
    const minWage = this.rule.minimumWage.monthly
    if (minWage > 0 && netMonthly > minWage * 3) {
      insights.push(`日均净收入 ¥${dailyNet.toFixed(0)}，约为本城最低工资（¥${minWage}/月）的 ${(netMonthly / minWage).toFixed(1)} 倍，属收入较高区间`)
    } else if (minWage > 0 && netMonthly > 0 && netMonthly < minWage) {
      insights.push(`日均净收入 ¥${dailyNet.toFixed(0)}，低于本城最低工资 ¥${minWage}/月——全职投入下不如去做最低工资的全职工作，值得重新核算成本与单量`)
    }
    if (work.dailyHours > 10) insights.push('日工时超10小时，存在健康风险和效率递减，建议控制在8-10小时')
    if (tax.effectiveRate > 5) insights.push(`个税负担较重（${tax.effectiveRate}%），可咨询税务师核实是否符合其他计税方式`)
    if (costs.fuelCostMonth > 0 && netMonthly > 0 && costs.fuelCostMonth / Math.max(1, netMonthly) > 0.15) {
      insights.push(`燃油成本占月净收入 ${((costs.fuelCostMonth / netMonthly) * 100).toFixed(0)}%，若改用电动车可显著降低这块支出`)
    }
    if (benefit.totalMonthly > 0) {
      insights.push(`已参保：每月自缴养老+医保 ¥${benefit.totalMonthly.toLocaleString()}，净收入相应下降`)
    } else {
      insights.push(`若以灵活就业参保（养老+医保），每月需自缴 ¥${(benefit.pensionMonthly + benefit.medicalMonthly).toLocaleString()}，净收入相应下降`)
      const insuranceCost = benefit.pensionMonthly + benefit.medicalMonthly
      if (insuranceCost > netMonthly && netMonthly > 0) {
        insights.push(`注意：参保月缴（¥${insuranceCost.toLocaleString()}）已超过当前月净收入，需靠其他收入或积蓄支撑；但断缴会损失缴费年限累计，建议先按最低基数评估`)
      }
    }
    if (personal.pensionBase && personal.pensionBase < this.rule.benefit.pension.baseMin + 1) {
      insights.push('你选择了最低档缴费基数：当期支出最低，但退休时的平均缴费指数随之降低，基础养老金会减少')
    }
    // 与 ScenarioService 同口径声明（parity 测试锁定文本一致）
    if (tax.effectiveRate > 0) {
      insights.push('个税按年度汇算清缴口径测算：月收入超 4000 元按 20% 减除费用、未超按 800 元，另减 5000 元/月基本减除；若平台按次预扣（20% 起）月到手会更低，以汇算为准')
    } else if (netMonthly > 0) {
      insights.push('个税按年度汇算清缴口径测算：当前收入未超减除标准，年度税额为 0')
    }
    return insights
  }
}
