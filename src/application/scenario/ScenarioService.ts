/**
 * ScenarioService - 场景编排（已切换到 domain 层计算）
 *
 * 职责：把领域引擎组合成一个完整方案（收入 → 税 → 社保 → 净收入 → 权益）。
 * 本层不含任何计算公式，只做编排与不变式校验。
 *
 * 单位约定（重要）：
 * - 内部全部走 domain 引擎，金额单位为**分**（整数）
 * - 对外返回的 ScenarioResult 沿用 `src/types` 契约，单位为**元**
 * - 分↔元换算只发生在本文件末尾的 `toResult`，业务代码里不得再出现裸换算
 *
 * 与旧 ScenarioEngine 的数值等价性由 tests/parity/old-vs-domain.spec.ts 保证。
 */

import type {
  CityRule,
  WorkParams,
  CostParams,
  PersonalParams,
  ScenarioResult,
  ComparisonResult,
  IncomeOverrides,
} from '../../types'
import { calcIncome as domainCalcIncome, calcCosts as domainCalcCosts } from '../../domain/income/calculator'
import { calcLaborMonthly as domainCalcLabor } from '../../domain/tax/calculator'
import { calcMonthly as domainCalcBenefit } from '../../domain/benefit/calculator'
import { findMedicalTierRate } from '../../domain/benefit/calculator'
import { ok, err, tryCatch } from '../../domain/shared/result'
import type { Result } from '../../domain/shared/result'
import { AppError } from '../errors'
import {
  adaptWork,
  adaptCosts,
  adaptIncomeRule,
  adaptLaborRule,
  adaptBenefitRule,
  toCent,
  toYuan,
} from '../adapters/ruleAdapters'
import type { IncomeRule as DomainIncomeRule } from '../../domain/income/rules'
import type { LaborRemunerationRule as DomainLaborRule } from '../../domain/tax/rules'
import type { BenefitRule as DomainBenefitRule } from '../../domain/benefit/rules'
import { round2 } from '../../utils/number'
import { dataQualityOf } from '../../utils/dataQuality'

/** 场景输入 */
export interface ScenarioInput {
  id: string
  name: string
  work: WorkParams
  costs: CostParams
  personal: PersonalParams
}

/** 对比输入 */
export interface ComparisonInput {
  scenarios: ScenarioInput[]
}

/** 除数保护：任一因子为 0 或非有限时回落到 1，避免 Infinity */
function safeDivisor(v: number): number {
  return Number.isFinite(v) && v > 0 ? v : 1
}

export class ScenarioService {
  /** 原始规则：洞察文案需要读取非数值字段（如本城养老基数下限），故保留 */
  private readonly rawRule: CityRule
  private readonly incomeRule: DomainIncomeRule
  private readonly laborRule: DomainLaborRule
  private readonly benefitRule: DomainBenefitRule
  /** 用户实测计价覆盖：构造函数入参是唯一来源，计算与数据质量判定都读它 */
  private readonly overrides?: IncomeOverrides
  /** 用户填入的本省社保参数覆盖（基数上下限 + 最低工资） */
  private readonly statutory?: { baseMin?: number; baseMax?: number; minWageMonthly?: number }

  constructor(
    rule: CityRule,
    overrides?: IncomeOverrides,
    /** 用户填入的本省社保基数上下限（规则值为 unverified 占位值时使用） */
    statutory?: { baseMin?: number; baseMax?: number; minWageMonthly?: number },
  ) {
    if (!rule) throw AppError.ruleInvalid('unknown', 'CityRule is required')
    this.rawRule = rule
    // 规则是常量，构造时适配一次，避免每次计算重复转换。
    // overrides 是用户按自己 APP 流水填的实测计价（见 IncomeOverrides 注释）
    this.overrides = overrides
    this.statutory = statutory
    this.incomeRule = adaptIncomeRule(rule.income, overrides)
    this.laborRule = adaptLaborRule(rule.tax.laborRemuneration)
    this.benefitRule = adaptBenefitRule(rule.benefit, statutory)
  }

  /** 运行单个场景 */
  runScenario(input: ScenarioInput): Result<ScenarioResult, AppError> {
    const validationErr = this.validateInput(input)
    if (validationErr) return err(validationErr)

    return tryCatch(
      () => {
        const { id, name, work, costs, personal } = input

        // ===== 以下全部以「分」为单位 =====
        // avgWeightKg 属于「计价实测」的一部分：personal 内联与构造入参两处取其一，
        // 优先 construct 入参（store 的单一来源），避免同一概念两份来源打架
        const weightKg = this.overrides?.avgWeightKg ?? personal.incomeOverrides?.avgWeightKg
        const income = domainCalcIncome(this.incomeRule, adaptWork(work, weightKg))
        const costBreakdown = domainCalcCosts(adaptCosts(costs))

        const monthlyGrossCent = income.grossIncome
        // 税前扣除合并为一个月度金额：专项附加扣除 + 个人养老金（12000/年）+ 税优健康险（2400/年）。
        // 后两项按年缴、按月平均计入综合所得扣除——这是「买这两项能省多少税」的唯一正确口径，
        // 此前页面只写「未计入测算」，用户无法验证值不值得买。
        const extraAnnualDeduction =
          (Number.isFinite(personal.personalPensionAnnual) ? Math.max(0, personal.personalPensionAnnual as number) : 0) +
          (Number.isFinite(personal.taxHealthInsuranceAnnual) ? Math.max(0, personal.taxHealthInsuranceAnnual as number) : 0)
        const monthlyDeductionYuan = personal.specialDeductionMonth + extraAnnualDeduction / 12
        const taxResult = domainCalcLabor(
          new Array(12).fill(monthlyGrossCent),
          toCent(monthlyDeductionYuan),
          this.laborRule,
        )
        if (!taxResult.ok) throw new Error(`个税计算失败: ${taxResult.error.code}`)

        const medicalTierRate = findMedicalTierRate(this.benefitRule.medicalTiers, personal.medicalTierId)
        const benefitResult = domainCalcBenefit(
          monthlyGrossCent,
          personal.hasSocialInsurance,
          medicalTierRate,
          {
            pensionBase: personal.pensionBase !== undefined ? toCent(personal.pensionBase) : undefined,
            medicalBase: personal.medicalBase !== undefined ? toCent(personal.medicalBase) : undefined,
          },
          this.benefitRule,
        )
        if (!benefitResult.ok) throw new Error(`社保计算失败: ${benefitResult.error.code}`)

        const monthlyTaxCent = taxResult.value.annualTax / 12
        // 月度个税是「年度分额 ÷ 12」，可能产生不足 1 分的零数。
        // 净额必须收敛到整数分（等价于旧引擎按元保留 2 位小数），
        // 否则除法尾数会让界面出现 7924.766666666666 这类数字。
        const netMonthlyCent = Math.round(
          monthlyGrossCent - costBreakdown.total - monthlyTaxCent - benefitResult.value.totalMonthly,
        )
        const netAnnualCent = netMonthlyCent * 12
        // 时薪只在「确实有工作小时」时有意义：0 天工作时若用 1 小时兜底当分母，
        // 会把整月固定亏损除成 ¥-195/h 这类假时薪。无工作小时即无时薪（0），与旧引擎同步。
        const workedHours = work.dailyHours * work.workDaysMonth
        const netHourlyCent = workedHours > 0 && Number.isFinite(workedHours)
          ? netMonthlyCent / workedHours
          : 0
        // ===== 分 → 元，产出对外契约 =====
        const monthlyTaxYuan = toYuan(monthlyTaxCent)
        const netMonthly = toYuan(netMonthlyCent)
        const netAnnual = toYuan(netAnnualCent)
        // 时薪是比值而非金额，分单位换算后仍需保留 2 位小数，与旧引擎的 round2 口径一致
        const netHourly = round2(netHourlyCent / 100)
        // domain 返回小数比率（如 0.119），对外契约与阈值判定均使用百分数（11.9）
        const effectiveRatePercent = Math.round(Number(taxResult.value.effectiveRate) * 100 * 100) / 100

        // 权益评分与保障缺口（与评分口径文档保持一致）
        let score = 100
        const flags: string[] = []
        if (!personal.hasSocialInsurance) {
          flags.push('未缴社保：发生重大疾病时医保与养老待遇全额自付，风险极高')
        }
        const uncoveredHighRisk = benefitResult.value.items.filter(i => !i.covered && i.risk === 'high')
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
        // 成本高低必须相对本城收入水平判断：3000 元在长沙与在深圳含义不同
        // （同文件下文明确不写死只匹配广州购买力的数字，此处同样不能写死）
        const costYuan = costBreakdown.total / 100
        const incomeForCost = monthlyGrossCent / 100
        if (incomeForCost > 0 && costYuan / incomeForCost > 0.35) {
          score -= 5
          flags.push(`运营成本偏高：占毛收入的 ${((costYuan / incomeForCost) * 100).toFixed(0)}%，高固定支出压缩净收入`)
        }
        score -= 5
        flags.push('单一收入来源：平台政策变动即影响全部收入，无兜底')
        const rightsScore = Math.max(0, score)

        // 保障缺失时封顶为 viable：否则净收入一高就出现"推荐你不参保"的反向激励。
        // 评级在「缴社保前」的收入能力上计算——社保是自己的保障储备，不是亏损，
        // 不能因为参保把方案从 viable 拖成 risky（那是同一激励的下一层翻版）。
        // 底线用本城最低工资（月）当锚，不写死 7000/4500 这类只匹配广州购买力的数字：
        // 低于最低工资 = risky（不如去做最低工资的全职）；超过 2 倍才够 recommended。
        const incomeCapacity = netMonthly + toYuan(benefitResult.value.totalMonthly)
        // 最低工资也允许用户覆盖：19 个新省的规则值是占位量级，
        // 用占位值做评级锚点会把"低于本地最低工资"误判成"可行"
        const minWageFloor = this.effectiveMinWage()
        const incomeTier = incomeCapacity > minWageFloor * 2 ? 'recommended' : incomeCapacity > minWageFloor ? 'viable' : 'risky'
        const recommendation =
          !personal.hasSocialInsurance && incomeTier === 'recommended' ? 'viable' : incomeTier

        const keyInsights = this.generateInsights(work, costs, effectiveRatePercent, netMonthly, {
          totalMonthly: toYuan(benefitResult.value.totalMonthly),
          pensionMonthly: toYuan(benefitResult.value.pensionMonthly),
          medicalMonthly: toYuan(benefitResult.value.medicalMonthly),
        }, personal)

        // 不变式：年度与月度必须闭合
        if (Math.abs(netAnnual - netMonthly * 12) > 0.1) {
          throw AppError.invariantViolation('年度净额与月度净额×12 不闭合', { netAnnual, netMonthly })
        }

        return {
          id,
          name,
          work,
          costs,
          income: {
            basePay: toYuan(income.basePay),
            distancePay: toYuan(income.distancePay),
            weightPay: toYuan(income.weightPay),
            subsidyPay: toYuan(income.subsidyPay),
            bonusPay: toYuan(income.bonusPay),
            grossIncome: toYuan(income.grossIncome),
          },
          costBreakdown: {
            vehicleType: costBreakdown.vehicleType,
            fuelCostMonth: toYuan(costBreakdown.fuelCostMonth),
            electricityCostMonth: toYuan(costBreakdown.electricityCostMonth),
            maintenanceMonth: toYuan(costBreakdown.maintenanceMonth),
            insuranceMonth: toYuan(costBreakdown.insuranceMonth),
            phoneCostMonth: toYuan(costBreakdown.phoneCostMonth),
            foodCostMonth: toYuan(costBreakdown.foodCostMonth),
            trafficFineMonth: toYuan(costBreakdown.trafficFineMonth),
            vehicleDepreciationMonth: toYuan(costBreakdown.vehicleDepreciationMonth),
            otherCostMonth: toYuan(costBreakdown.otherCostMonth),
            total: toYuan(costBreakdown.total),
          },
          tax: {
            monthlyTax: taxResult.value.monthlyTax.map(m => toYuan(m)),
            annualTax: toYuan(taxResult.value.annualTax),
            // domain 返回小数比率，对外契约要求百分数并保留 2 位
            effectiveRate: effectiveRatePercent,
            afterTaxIncome: toYuan(taxResult.value.afterTaxIncome),
            method: 'labor',
          },
          benefit: {
            pensionMonthly: toYuan(benefitResult.value.pensionMonthly),
            medicalMonthly: toYuan(benefitResult.value.medicalMonthly),
            totalMonthly: toYuan(benefitResult.value.totalMonthly),
            items: benefitResult.value.items.map(i => ({
              name: i.name,
              monthly: toYuan(i.monthly),
              covered: i.covered,
              // 对外契约的 risk 表示「该项的重要性」，与是否参保无关：
              // 养老与医疗无论参保与否都是 high，职业伤害保障为 medium。
              // domain 内部按 covered 细分为 low/high，此处归一化以保证
              // ScenarioResult 与旧引擎产出逐项一致（由端到端对拍守护）。
              risk: i.risk === 'medium' ? 'medium' : 'high',
            })),
          },
          netMonthly,
          netAnnual,
          netHourly,
          rightsScore,
          rightsFlags: flags,
          recommendation,
          keyInsights,
          dataQuality: dataQualityOf(this.rawRule.sources, personal.hasSocialInsurance, this.overrides ?? personal.incomeOverrides),
        } satisfies ScenarioResult
      },
      e => AppError.engine('ScenarioService.runScenario', e instanceof Error ? e.message : String(e)),
    )
  }

  /** 对比多个场景，输出排序、最佳方案与摘要 */
  compare(input: ComparisonInput): Result<ComparisonResult, AppError> {
    if (!input.scenarios || input.scenarios.length === 0) {
      return err(AppError.validation('至少需要一个方案才能对比'))
    }

    const results = input.scenarios.map(s => this.runScenario(s))
    const firstErr = results.find(r => !r.ok)
    if (firstErr && !firstErr.ok) return err(firstErr.error)

    const scenarios = results.map(r => (r as { ok: true; value: ScenarioResult }).value)

    return tryCatch(
      () => {
        const ranking = scenarios
          .map(s => ({ id: s.id, netAnnual: s.netAnnual, label: s.name }))
          .sort((a, b) => b.netAnnual - a.netAnnual)

        const best = scenarios.reduce<ScenarioResult | null>(
          (b, s) => (s.netAnnual > (b?.netAnnual ?? -Infinity) ? s : b),
          null,
        )

        const runnerUp = ranking[1]?.netAnnual
        const gap = best && runnerUp !== undefined ? Math.round(best.netAnnual - runnerUp) : 0
        const summary = best
          ? `「${best.name}」方案年净收入 ¥${best.netAnnual.toLocaleString()}，排名第一${
              runnerUp !== undefined ? `，比第二名多 ¥${gap.toLocaleString()}/年` : ''
            }。权益评分 ${best.rightsScore}/100。`
          : '请添加至少一个方案进行对比。'

        return { scenarios, best, ranking, summary }
      },
      e => AppError.engine('ScenarioService.compare', e instanceof Error ? e.message : String(e)),
    )
  }

  /** 输入校验 */
  private validateInput(input: ScenarioInput): AppError | null {
    if (!input || !input.id || !input.name) return AppError.validation('场景 id 与 name 必填')
    if (!input.work || !input.costs || !input.personal) {
      return AppError.validation('work / costs / personal 必填')
    }
    const { work, personal } = input
    if (!Number.isFinite(work.dailyHours) || work.dailyHours <= 0) {
      return AppError.validation('work.dailyHours 必须为正数')
    }
    // 允许 0 天：与 domain/income/calculator 的口径一致（「本月工作 0 天」收入即为 0，
    // 成本仍在，净收入为负是正确结果）。此处曾要求 >0，与域层注释直接矛盾，
    // 会导致「0 天」在域层可算、经服务层却被拒——两层必须同口径。
    if (!Number.isFinite(work.workDaysMonth) || work.workDaysMonth < 0) {
      return AppError.validation('work.workDaysMonth 必须为非负数')
    }
    if (!Number.isFinite(work.dailyOrders) || work.dailyOrders < 0) {
      return AppError.validation('work.dailyOrders 必须为非负数')
    }
    if (!Number.isFinite(personal.currentAge) || personal.currentAge < 16) {
      return AppError.validation('personal.currentAge 必须 ≥ 16')
    }
    if (!Number.isFinite(personal.expectedRetireAge) || personal.expectedRetireAge <= personal.currentAge) {
      return AppError.validation('personal.expectedRetireAge 必须大于 currentAge')
    }
    return null
  }

  /** 生效的最低工资：用户覆盖优先（省级值），否则用规则文件值 */
  private effectiveMinWage(): number {
    const o = this.statutory?.minWageMonthly
    return typeof o === 'number' && Number.isFinite(o) && o > 0 ? o : this.rawRule.minimumWage.monthly
  }

  private generateInsights(
    work: WorkParams,
    costs: CostParams,
    effectiveRate: number,
    netMonthly: number,
    benefit: { totalMonthly: number; pensionMonthly: number; medicalMonthly: number },
    personal: PersonalParams,
  ): string[] {
    const insights: string[] = []
    const dailyNet = netMonthly / safeDivisor(work.workDaysMonth)
    // 阈值一律锚定本城最低工资，不写死 8000/2000 这类只匹配一线城市购买力的数字：
    // 同样的 ¥6000 在长沙算高收入、在广州只是刚过线
    const minWage = this.effectiveMinWage()

    if (minWage > 0 && netMonthly > minWage * 3) {
      insights.push(`日均净收入 ¥${dailyNet.toFixed(0)}，约为本城最低工资（¥${minWage}/月）的 ${(netMonthly / minWage).toFixed(1)} 倍，属收入较高区间`)
    } else if (minWage > 0 && netMonthly > 0 && netMonthly < minWage) {
      insights.push(`日均净收入 ¥${dailyNet.toFixed(0)}，低于本城最低工资 ¥${minWage}/月——全职投入下不如去做最低工资的全职工作，值得重新核算成本与单量`)
    }
    if (work.dailyHours > 10) insights.push('日工时超10小时，存在健康风险和效率递减，建议控制在8-10小时')
    if (effectiveRate > 5) insights.push(`个税负担较重（${effectiveRate}%），可咨询税务师核实是否符合其他计税方式`)
    // 燃油成本以「占收入比例」判断而非绝对金额：月入 4000 与月入 15000 的 2000 元油费含义完全不同
    if (costs.fuelCostMonth > 0 && netMonthly > 0 && costs.fuelCostMonth / Math.max(1, netMonthly) > 0.15) {
      insights.push(`燃油成本占月净收入 ${((costs.fuelCostMonth / netMonthly) * 100).toFixed(0)}%，若改用电动车可显著降低这块支出`)
    }

    if (benefit.totalMonthly > 0) {
      insights.push(`已参保：每月自缴养老+医保 ¥${benefit.totalMonthly.toLocaleString()}，净收入相应下降`)
    } else {
      insights.push(
        `若以灵活就业参保（养老+医保），每月需自缴 ¥${(benefit.pensionMonthly + benefit.medicalMonthly).toLocaleString()}，净收入相应下降`,
      )
      // 参保成本超过月净收入时点破：否则用户只看到"净收入下降"，实际是当月入不敷出
      const insuranceCost = benefit.pensionMonthly + benefit.medicalMonthly
      if (insuranceCost > netMonthly && netMonthly > 0) {
        insights.push(`注意：参保月缴（¥${insuranceCost.toLocaleString()}）已超过当前月净收入，需靠其他收入或积蓄支撑；但断缴会损失缴费年限累计，建议先按最低基数评估`)
      }
    }

    if (personal.pensionBase && personal.pensionBase < this.rawRule.benefit.pension.baseMin + 1) {
      insights.push('你选择了最低档缴费基数：当期支出最低，但退休时的平均缴费指数随之降低，基础养老金会减少')
    }

    // 口径声明：本工具的税额是「年度汇算清缴」结果。若平台或雇主按次预扣（劳务报酬 20% 起），
    // 月到手会明显低于此处的月均税负，次年汇算才退补差额；不声明会让人以为每月只扣这么多。
    if (effectiveRate > 0) {
      insights.push('个税按年度汇算清缴口径测算：月收入超 4000 元按 20% 减除费用、未超按 800 元，另减 5000 元/月基本减除；若平台按次预扣（20% 起）月到手会更低，以汇算为准')
    } else if (netMonthly > 0) {
      insights.push('个税按年度汇算清缴口径测算：当前收入未超减除标准，年度税额为 0')
    }

    return insights
  }
}