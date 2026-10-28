/**
 * 数据质量门禁（Data Provenance Gate）
 *
 * 背景：规则文件里仍有大量 confidence=unverified 的占位值（如美团单价 5 元/单是
 * 占位口径），但它们照样参与净收入、"最优方案"、权益评级。用户没有任何办法从
 * 「最优「多跑2小时」」这句话里看出后面站的是占位假设。
 *
 * 这组断言把门禁固定下来：结果必须自带 dataQuality 标记，未核实的依赖字段必须
 * 被列出；且该标记只统计「真的进入本场景数字」的字段——未参保场景不该因为
 * 医保基数是占位值就被判为 provisional。
 */

import { describe, it, expect } from 'vitest'
import { loadAllRules, loadRuleFile } from './helpers/rules'
import { ScenarioService } from '../src/application/scenario/ScenarioService'
import type { WorkParams, CostParams, PersonalParams } from '../src/types'

const rules = loadAllRules()

const GZ = rules.guangzhou
const svc = new ScenarioService(GZ)

const work: WorkParams = {
  city: 'guangzhou', dailyHours: 10, dailyOrders: 35, avgDistance: 2.5,
  workDaysMonth: 26, rainDaysMonth: 3, holidayDaysMonth: 2,
}
const costs: CostParams = {
  vehicleType: 'electric', fuelCostMonth: 0, electricityCostMonth: 300, maintenanceMonth: 200,
  insuranceMonth: 100, phoneCostMonth: 100, foodCostMonth: 800, trafficFineMonth: 50,
  vehicleDepreciationMonth: 300, otherCostMonth: 100,
}
const personal = (over: Partial<PersonalParams> = {}): PersonalParams => ({
  currentAge: 25, expectedRetireAge: 60, hasSocialInsurance: false, specialDeductionMonth: 0, ...over,
})

describe('数据质量标记', () => {
  it('每个场景结果都带 dataQuality，且官方/未核实字段不重叠', () => {
    const r = svc.runScenario({ id: 'q', name: 'q', work, costs, personal: personal() })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const q = r.value.dataQuality
    expect(q).toBeTruthy()
    expect(Array.isArray(q.unverifiedFields)).toBe(true)
    expect(Array.isArray(q.officialFields)).toBe(true)
    const overlap = q.unverifiedFields.filter(f => q.officialFields.includes(f))
    expect(overlap, '同一字段不能同时是官方与未核实').toEqual([])
  })

  it('广州收入为占位值时，未参保结果必须标记 provisional 并列出计价字段', () => {
    expect(GZ.sources.income.confidence, '前提：广州收入参数当前为占位值').toBe('unverified')
    const r = svc.runScenario({ id: 'q', name: 'q', work, costs, personal: personal() })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.dataQuality.provisional).toBe(true)
    expect(r.value.dataQuality.unverifiedFields).toContain('计价单价/补贴')
  })

  it('未参保场景不因医保/养老基数是占位值而被判 provisional（那些字段不进本场景数字）', () => {
    const r = svc.runScenario({ id: 'q', name: 'q', work, costs, personal: personal({ hasSocialInsurance: false }) })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.dataQuality.unverifiedFields).not.toContain('医保缴费基数')
    expect(r.value.dataQuality.unverifiedFields).not.toContain('养老缴费基数')
  })

  it('参保场景把养老/医保基数纳入依赖（不论其置信度高低都要出现）', () => {
    const r = svc.runScenario({ id: 'q', name: 'q', work, costs, personal: personal({ hasSocialInsurance: true }) })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const q = r.value.dataQuality
    const listed = [...q.unverifiedFields, ...q.officialFields]
    const pensionKnown = GZ.sources.pension?.confidence === 'official'
    expect(listed, '参保场景的依赖清单必须包含养老/医保基数').toContain('养老缴费基数')
    // 广州养老基数为 official 时，它应落在 official 一侧而不是被笼统当成未核实
    if (pensionKnown) {
      expect(q.officialFields).toContain('养老缴费基数')
      expect(q.unverifiedFields).not.toContain('养老缴费基数')
    }
  })

  it('最低工资置信度进入依赖：评级锚点不可信时必须体现在标记里', () => {
    const r = svc.runScenario({ id: 'q', name: 'q', work, costs, personal: personal() })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const q = r.value.dataQuality
    const listed = [...q.unverifiedFields, ...q.officialFields]
    expect(listed, '最低工资是评级锚点，必须出现在依赖清单').toContain('最低工资')
  })

  it('全城市扫描：未核实字段必须被如实列出，且不出现重复项', () => {
    for (const [city, rule] of Object.entries(rules)) {
      const s = new ScenarioService(rule)
      const r = s.runScenario({ id: 'q', name: 'q', work: { ...work, city }, costs, personal: personal() })
      expect(r.ok, `${city} 应能完成测算`).toBe(true)
      if (!r.ok) continue
      const q = r.value.dataQuality
      expect(new Set(q.unverifiedFields).size, `${city} 未核实字段重复`).toBe(q.unverifiedFields.length)
      // provisional 与「是否有未核实依赖」必须一致，不能有一边说了另一边不说
      expect(q.provisional, `${city} provisional 与其依赖清单不一致`).toBe(q.unverifiedFields.length > 0)
    }
  })
})

describe('本省法定参数覆盖后的数据质量判定', () => {
  it('未核实城市：填入本省基数与最低工资后，对应字段移出「未核实」清单', () => {
    // 石家庄的 pension / minimumWage 都是 unverified（全国量级占位值）
    const sjz = loadRuleFile('shijiazhuang.json')
    const before = new ScenarioService(sjz).runScenario({ id: 'q', name: 'q', work, costs, personal: personal({ hasSocialInsurance: true }) })
    expect(before.ok).toBe(true)
    if (!before.ok) return
    expect(before.value.dataQuality.unverifiedFields).toContain('养老缴费基数')
    expect(before.value.dataQuality.unverifiedFields).toContain('最低工资')

    const after = new ScenarioService(sjz, undefined, { baseMin: 4000, baseMax: 20000, minWageMonthly: 2200 })
      .runScenario({ id: 'q', name: 'q', work, costs, personal: personal({ hasSocialInsurance: true }) })
    expect(after.ok).toBe(true)
    if (!after.ok) return
    expect(after.value.dataQuality.unverifiedFields, '填了本省值就不该再列为未核实').not.toContain('养老缴费基数')
    expect(after.value.dataQuality.unverifiedFields).not.toContain('最低工资')
    expect(after.value.dataQuality.overriddenFields).toContain('养老缴费基数')
    expect(after.value.dataQuality.overriddenFields).toContain('最低工资')
  })
})

describe('计价覆盖的缺口提示', () => {
  it('只填单价时，缺失字段列表里仍包含倍率项', () => {
    const svcPartial = new ScenarioService(GZ, { basePricePerOrder: 6 })
    const r = svcPartial.runScenario({ id: 'q', name: 'q', work, costs, personal: personal() })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const q = r.value.dataQuality
    expect(q.overriddenFields).toContain('计价单价/补贴')
    expect(q.missingOverrideFields, '只填单价不能宣称全部按实测').toBeTruthy()
    expect(q.missingOverrideFields!.length).toBeGreaterThan(0)
    expect(q.missingOverrideFields).toContain('峰时倍率')
  })

  it('填满五项后缺口列表为空', () => {
    const svcFull = new ScenarioService(GZ, {
      basePricePerOrder: 6, distanceRate: 1.5, peakMultiplier: 1.3, rainSurcharge: 1.4, holidayMultiplier: 1.7,
    })
    const r = svcFull.runScenario({ id: 'q', name: 'q', work, costs, personal: personal() })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.dataQuality.missingOverrideFields).toEqual([])
  })
})
