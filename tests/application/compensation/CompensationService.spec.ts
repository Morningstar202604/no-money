/**
 * CompensationService 回归测试。
 *
 * 背景：该服务从 RightsCompensation.vue 提取后一直未接线、零测试，与组件内联
 * 副本并行漂移；1–4 级伤残待遇在两份副本中同时缺失（一次性伤残补助金与按月
 * 津贴分支都不落，四级少算 21 个月本人工资 + 全部津贴）。现已修复并把组件接线
 * 到本服务，测试锁定以下契约防止再次漂移。
 */

import { describe, it, expect } from 'vitest'
import { CompensationService } from '../../../src/application/compensation/CompensationService'
import type { CityRule } from '../../../src/types'
import { readFileSync } from 'node:fs'

const rule = JSON.parse(readFileSync('public/rules/guangzhou.json', 'utf8')) as CityRule
const service = new CompensationService()

const serviceRule = {
  benefit: { pension: { baseMin: rule.benefit.pension.baseMin, baseMax: rule.benefit.pension.baseMax } },
  minimumWage: { nonFullTimeHourly: rule.minimumWage.nonFullTimeHourly },
  city: 'guangzhou',
}

function unwrap<T>(r: { ok: true; value: T } | { ok: false }): T {
  if (!r.ok) throw new Error(`计算失败: ${JSON.stringify(r)}`)
  return r.value
}

describe('工伤场景：伤残等级决定待遇项目', () => {
  const baseForm = {
    medical: 5000, leaveMonths: 3, income: 8000, hasInsurance: true, mealPerDay: 0, nursingPerDay: 0,
  }
  const floor = rule.benefit.pension.baseMin

  it('4 级：一次性伤残补助金 21 个月 + 按月伤残津贴 75%，不享受一次性医疗/就业补助金', () => {
    const r = unwrap(service.calculate({ scene: 'injury', form: { injury: { ...baseForm, level: 4 } }, rule: serviceRule }))
    const subsidy = r.items.find(i => i.name.includes('一次性伤残补助金'))
    expect(subsidy, '4级必须有一次性的21个月伤残补助金').toBeTruthy()
    expect(subsidy!.amount).toBe(Math.min(Math.max(8000, floor), rule.benefit.pension.baseMax) * 21)

    const allowance = r.items.find(i => i.name.includes('按月伤残津贴'))
    expect(allowance, '4级必须有按月伤残津贴（此前整个分支缺失）').toBeTruthy()
    expect(allowance!.amount).toBe(Math.round(Math.min(Math.max(8000, floor), rule.benefit.pension.baseMax) * 0.75))
    expect(allowance!.kind).toBe('conditional')

    expect(r.items.some(i => i.name.includes('工伤医疗补助金')), '医疗补助金是5-10级退出结算，1-4级不适用').toBe(false)
    expect(r.items.some(i => i.name.includes('就业补助金')), '就业补助金是5-10级退出结算，1-4级不适用').toBe(false)
  })

  it('1–4 级津贴比例分别为 90/85/80/75%', () => {
    for (const [level, pct] of [[1, 0.9], [2, 0.85], [3, 0.8], [4, 0.75]] as const) {
      const r = unwrap(service.calculate({ scene: 'injury', form: { injury: { ...baseForm, level } }, rule: serviceRule }))
      const allowance = r.items.find(i => i.name.includes('按月伤残津贴'))
      expect(allowance, `${level}级津贴缺失`).toBeTruthy()
      expect(allowance!.amount).toBe(Math.round(8000 * pct))
    }
  })

  it('10 级：7 个月补助金 + 医疗/就业补助金条件项（5–10 级行为不变）', () => {
    const r = unwrap(service.calculate({ scene: 'injury', form: { injury: { ...baseForm, level: 10 } }, rule: serviceRule }))
    const subsidy = r.items.find(i => i.name.includes('一次性伤残补助金'))
    expect(subsidy!.amount).toBe(Math.min(Math.max(8000, floor), rule.benefit.pension.baseMax) * 7)
    expect(r.items.some(i => i.name.includes('工伤医疗补助金'))).toBe(true)
    expect(r.items.some(i => i.name.includes('就业补助金'))).toBe(true)
    expect(r.items.some(i => i.name.includes('按月伤残津贴'))).toBe(false)
  })

  it('非广东城市：不套用广东的医疗/就业补助金月数，改为提示按本省标准核定', () => {
    const r = unwrap(service.calculate({
      scene: 'injury',
      form: { injury: { ...baseForm, level: 10 } },
      rule: { ...serviceRule, city: 'beijing' },
    }))
    // 全国统一的一次性伤残补助金照发
    expect(r.items.some(i => i.name.includes('一次性伤残补助金'))).toBe(true)
    // 省级口径的两项不给数字（避免跨省错算）
    expect(r.items.some(i => i.name.includes('工伤医疗补助金') && i.amount > 0)).toBe(false)
    expect(r.items.some(i => i.name.includes('就业补助金') && i.amount > 0)).toBe(false)
    const note = r.items.find(i => i.name.includes('需按你所在省标准核定'))
    expect(note, '非广东必须给出可执行的替代指引').toBeTruthy()
    expect(note!.kind).toBe('info')
  })

  it('0 级（未鉴定）：只有提示，无补助金', () => {
    const r = unwrap(service.calculate({ scene: 'injury', form: { injury: { ...baseForm, level: 0 } }, rule: serviceRule }))
    expect(r.items.some(i => i.name.includes('一次性伤残补助金'))).toBe(false)
    expect(r.items.some(i => i.name.includes('劳动能力鉴定'))).toBe(true)
  })

  it('本人工资按养老基数上下限封顶保底（第64条）', () => {
    const r = unwrap(service.calculate({
      scene: 'injury',
      form: { injury: { ...baseForm, level: 10, income: 100 } },
      rule: serviceRule,
    }))
    const leave = r.items.find(i => i.name.includes('停工留薪期'))!
    expect(leave.amount).toBe(floor * 3)
  })
})

describe('加班费场景：基数下限校验（此前最低工资参数被静默丢弃）', () => {
  const baseForm = { hourlyBase: 30, weekdayHours: 40, weekendHours: 16, holidayHours: 0, months: 3 }

  it('时薪低于本城非全日制最低小时工资时给出提示', () => {
    const r = unwrap(service.calculate({ scene: 'overwork', form: { overwork: { ...baseForm, hourlyBase: 10 } }, rule: serviceRule }))
    expect(r.items.some(i => i.name.includes('加班费基数低于最低小时工资'))).toBe(true)
  })

  it('时薪合规时无该提示，金额不受影响', () => {
    const r = unwrap(service.calculate({ scene: 'overwork', form: { overwork: baseForm }, rule: serviceRule }))
    expect(r.items.some(i => i.name.includes('加班费基数低于最低小时工资'))).toBe(false)
    const weekday = r.items.find(i => i.name.includes('工作日延时'))!
    expect(weekday.amount).toBe(40 * 1.5 * 30 * 3)
  })
})

describe('欠薪场景', () => {
  it('本金 + 条件项分列，合计只含可直接主张项', () => {
    const r = unwrap(service.calculate({
      scene: 'wage',
      form: { wage: { months: 3, monthly: 8000, percent: 50, tenureMonths: 6, hasContract: true, forcedQuit: false } },
      rule: serviceRule,
    }))
    expect(r.total).toBe(12000)
    expect(r.conditionalTotal).toBe(6000)
    expect(r.scene).toBe('欠薪/克扣报酬')
  })
})

describe('示例值不得进入文书（诚信护栏）', () => {
  it('服务本身只负责计算，不写任何存储；示例/确认的区分由调用方控制', () => {
    // 契约：CompensationService.calculate 是纯函数式调用，不触碰 localStorage/store。
    // RightsCompensation 在 userTouched=false 时调用 store.setCompensation(null)，
    // 因此文书页 comp 为 null、claimItems 为空——示例金额不会进入仲裁请求。
    const before = globalThis.localStorage?.getItem?.('nomoney_params_v1') ?? null
    unwrap(service.calculate({
      scene: 'dismiss',
      form: { dismiss: { years: 2, monthly: 8000, type: 'wrongful', pregnancyMonths: 0 } },
      rule: serviceRule,
    }))
    const after = globalThis.localStorage?.getItem?.('nomoney_params_v1') ?? null
    expect(after).toBe(before)
  })
})
