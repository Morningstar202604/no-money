/**
 * 端到端对拍：旧 ScenarioEngine（UI 原路径）vs 新 ScenarioService（UI 现路径）
 *
 * 这是切换的最终闸门。前面 tests/parity/old-vs-domain.spec.ts 证明的是
 * 「引擎等价」；本文件证明的是「整条编排链等价」——即用户实际看到的每一个数字、
 * 每一条权益提示、每一次方案排序都必须一致。
 *
 * 旧引擎 src/engine/ScenarioEngine.ts 保留在仓库中专门用于本对拍，
 * 在本文件全部转绿之前不得删除。
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ScenarioEngine } from '../../src/engine/ScenarioEngine'
import { ScenarioService } from '../../src/application/scenario/ScenarioService'
import type { CityRule, WorkParams, CostParams, PersonalParams } from '../../src/types'

const CITIES = ['guangzhou', 'shenzhen', 'dongguan'] as const
const rules = Object.fromEntries(
  CITIES.map(c => [c, JSON.parse(readFileSync(`public/rules/${c}.json`, 'utf8')) as CityRule]),
) as Record<(typeof CITIES)[number], CityRule>

const BASE_WORK: WorkParams = {
  city: 'guangzhou',
  dailyHours: 10,
  dailyOrders: 35,
  avgDistance: 2.5,
  workDaysMonth: 26,
  rainDaysMonth: 3,
  holidayDaysMonth: 2,
}

const BASE_COSTS: CostParams = {
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

const BASE_PERSONAL: PersonalParams = {
  currentAge: 25,
  expectedRetireAge: 60,
  hasSocialInsurance: false,
  specialDeductionMonth: 0,
}

const CASES: Array<{ label: string; work: WorkParams; costs: CostParams; personal: PersonalParams }> = [
  { label: '默认参数', work: BASE_WORK, costs: BASE_COSTS, personal: BASE_PERSONAL },
  { label: '已参保', work: BASE_WORK, costs: BASE_COSTS, personal: { ...BASE_PERSONAL, hasSocialInsurance: true } },
  { label: '专项附加2000', work: BASE_WORK, costs: BASE_COSTS, personal: { ...BASE_PERSONAL, specialDeductionMonth: 2000 } },
  { label: '高收入200单', work: { ...BASE_WORK, dailyOrders: 200 }, costs: BASE_COSTS, personal: BASE_PERSONAL },
  { label: '低收入零单', work: { ...BASE_WORK, dailyOrders: 0 }, costs: BASE_COSTS, personal: BASE_PERSONAL },
  { label: '超长工时14h', work: { ...BASE_WORK, dailyHours: 14 }, costs: BASE_COSTS, personal: BASE_PERSONAL },
  { label: '月工作30天', work: { ...BASE_WORK, workDaysMonth: 30 }, costs: BASE_COSTS, personal: BASE_PERSONAL },
  { label: '高成本', work: BASE_WORK, costs: { ...BASE_COSTS, fuelCostMonth: 3000, foodCostMonth: 2000 }, personal: BASE_PERSONAL },
  { label: '东莞医保一档', work: BASE_WORK, costs: BASE_COSTS, personal: { ...BASE_PERSONAL, medicalTierId: 't1', hasSocialInsurance: true } },
  { label: '自选最低养老基数', work: BASE_WORK, costs: BASE_COSTS, personal: { ...BASE_PERSONAL, hasSocialInsurance: true, pensionBase: 5521 } },
]

describe('端到端对拍：ScenarioEngine(旧) vs ScenarioService(新)', () => {
  for (const city of CITIES) {
    const rule = rules[city]
    const oldEngine = new ScenarioEngine(rule)
    const newService = new ScenarioService(rule)

    for (const c of CASES) {
      describe(`${city} / ${c.label}`, () => {
        const work = { ...c.work, city }
        const old = oldEngine.runScenario('t', '测试方案', work, c.costs, c.personal)
        const res = newService.runScenario({ id: 't', name: '测试方案', work, costs: c.costs, personal: c.personal })

        it('返回成功', () => {
          expect(res.ok, res.ok ? '' : JSON.stringify(res.error)).toBe(true)
        })

        it('毛收入与四个分项完全一致', () => {
          expect(res.ok).toBe(true)
          if (!res.ok) return
          const v = res.value
          expect(v.income.grossIncome).toBe(old.income.grossIncome)
          expect(v.income.basePay).toBe(old.income.basePay)
          expect(v.income.distancePay).toBe(old.income.distancePay)
          expect(v.income.subsidyPay).toBe(old.income.subsidyPay)
          expect(v.income.bonusPay).toBe(old.income.bonusPay)
        })

        it('成本合计一致', () => {
          if (!res.ok) return
          expect(res.value.costBreakdown.total).toBe(old.costBreakdown.total)
        })

        it('个税年度额与12期明细一致', () => {
          if (!res.ok) return
          expect(res.value.tax.annualTax).toBe(old.tax.annualTax)
          expect(res.value.tax.monthlyTax).toEqual(old.tax.monthlyTax)
          expect(res.value.tax.effectiveRate).toBe(old.tax.effectiveRate)
        })

        it('社保三项与保障项列表一致', () => {
          if (!res.ok) return
          expect(res.value.benefit.pensionMonthly).toBe(old.benefit.pensionMonthly)
          expect(res.value.benefit.medicalMonthly).toBe(old.benefit.medicalMonthly)
          expect(res.value.benefit.totalMonthly).toBe(old.benefit.totalMonthly)
          expect(res.value.benefit.items.map(i => ({ name: i.name, covered: i.covered, risk: i.risk }))).toEqual(
            old.benefit.items.map(i => ({ name: i.name, covered: i.covered, risk: i.risk })),
          )
        })

        it('净收入三项完全一致', () => {
          if (!res.ok) return
          expect(res.value.netMonthly).toBe(old.netMonthly)
          expect(res.value.netAnnual).toBe(old.netAnnual)
          expect(res.value.netHourly).toBe(old.netHourly)
        })

        it('权益评分、缺口提示、评级、洞察完全一致', () => {
          if (!res.ok) return
          expect(res.value.rightsScore).toBe(old.rightsScore)
          // 新引擎在迁移后新增了「有效时薪 vs 法定最低时薪」提示（v3.1.1），
          // 旧引擎没有这条能力。对拍的是「迁移是否等价」，不是「新功能是否更好」，
          // 因此这里比对的是旧引擎产出的那部分，新增条目单独由
          // tests/hourlyWage.spec.ts 覆盖。
          const NEW_FLAG = /有效时薪.*(低于当地非全日制最低时薪|是当地最低时薪的)/
          const newOnly = res.value.rightsFlags.filter((f) => NEW_FLAG.test(f))
          const comparable = res.value.rightsFlags.filter((f) => !NEW_FLAG.test(f))
          expect(newOnly.length).toBeLessThanOrEqual(1)
          expect(comparable).toEqual(old.rightsFlags)
          expect(res.value.recommendation).toBe(old.recommendation)
          expect(res.value.keyInsights).toEqual(old.keyInsights)
        })
      })
    }
  }
})

describe('端到端对拍：方案对比与排序', () => {
  const rule = rules.guangzhou
  const oldEngine = new ScenarioEngine(rule)
  const newService = new ScenarioService(rule)

  const inputs = [
    { id: 'current', name: '当前方案', work: BASE_WORK },
    { id: 'more_hours', name: '多跑2小时', work: { ...BASE_WORK, dailyHours: 12 } },
    { id: 'more_orders', name: '多接5单', work: { ...BASE_WORK, dailyOrders: 40 } },
    { id: 'less_orders', name: '少接10单', work: { ...BASE_WORK, dailyOrders: 25 } },
  ]

  it('排名顺序一致', () => {
    const oldRanking = oldEngine
      .compare(inputs.map(i => oldEngine.runScenario(i.id, i.name, i.work, BASE_COSTS, BASE_PERSONAL)))
      .ranking.map(r => ({ id: r.id, netAnnual: r.netAnnual }))

    const res = newService.compare({
      scenarios: inputs.map(i => ({ ...i, costs: BASE_COSTS, personal: BASE_PERSONAL })),
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.ranking.map(r => ({ id: r.id, netAnnual: r.netAnnual }))).toEqual(oldRanking)
  })

  it('最佳方案与摘要一致', () => {
    const oldBest = oldEngine.compare(
      inputs.map(i => oldEngine.runScenario(i.id, i.name, i.work, BASE_COSTS, BASE_PERSONAL)),
    ).best

    const res = newService.compare({
      scenarios: inputs.map(i => ({ ...i, costs: BASE_COSTS, personal: BASE_PERSONAL })),
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.best?.id).toBe(oldBest?.id)
    expect(res.value.summary).toBe(
      oldBest
        ? `「${oldBest.name}」方案年净收入 ¥${oldBest.netAnnual.toLocaleString()}，排名第一，比第二名多 ¥${Math.round(oldBest.netAnnual - oldEngine.compare(inputs.map(i => oldEngine.runScenario(i.id, i.name, i.work, BASE_COSTS, BASE_PERSONAL))).ranking[1].netAnnual).toLocaleString()}/年。权益评分 ${oldBest.rightsScore}/100。`
        : '请添加至少一个方案进行对比。',
    )
  })

  it('UI 默认的四个方案（当前/多跑2小时/多接5单/缴齐社保）数值一致', () => {
    const uiCases = [
      { id: 'current', name: '当前方案', work: BASE_WORK, personal: BASE_PERSONAL },
      { id: 'more_hours', name: '多跑2小时', work: { ...BASE_WORK, dailyHours: 12 }, personal: BASE_PERSONAL },
      { id: 'more_orders', name: '多接5单', work: { ...BASE_WORK, dailyOrders: 40 }, personal: BASE_PERSONAL },
      { id: 'with_insurance', name: '缴齐社保', work: BASE_WORK, personal: { ...BASE_PERSONAL, hasSocialInsurance: true } },
    ]

    for (const c of uiCases) {
      const old = oldEngine.runScenario(c.id, c.name, c.work, BASE_COSTS, c.personal)
      const res = newService.runScenario({ ...c, costs: BASE_COSTS })
      expect(res.ok).toBe(true)
      if (!res.ok) continue
      expect({ id: res.value.id, netMonthly: res.value.netMonthly, rightsScore: res.value.rightsScore }).toEqual({
        id: old.id,
        netMonthly: old.netMonthly,
        rightsScore: old.rightsScore,
      })
    }
  })
})