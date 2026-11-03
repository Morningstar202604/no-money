// 计算内核测试
//
// 内核是 CLI / MCP / HTTP API / Web 四个入口的公共底座。
// 一旦它和 Web 端算出的数不一致，就会出现「同一输入四个答案」的灾难。
// 这里用固定快照把数字钉死：任何一处改了公式，这条测试立刻红。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { calculate, collectUnverifiedFields, DEFAULT_WORK, DEFAULT_COSTS } from '../src/kernel/calculate'
import type { CityRule } from '../src/types'

const loadRule = async (city: string) =>
  JSON.parse(readFileSync(`public/rules/${city}.json`, 'utf8')) as CityRule

describe('计算内核', () => {
  it('广州默认参数的净收入与 Web 端一致', async () => {
    const r = await calculate({ city: 'guangzhou' }, loadRule)
    // 这个值来自 Web 端「当前方案」卡片，必须完全一致
    expect(r.netMonthly).toBe(6843.7)
    expect(r.cityName).toBe('广州')
  })

  it('只加工时、不加单量时净收入下降（疲劳折减高于产出）', async () => {
    // 这不是 bug：单量不变意味着每小时产出下降，模型据实把疲劳计入
    const base = await calculate({ city: 'guangzhou' }, loadRule)
    const longer = await calculate({ city: 'guangzhou', work: { dailyHours: 12 } }, loadRule)
    expect(longer.netMonthly).toBeLessThan(base.netMonthly)
  })

  it('工时与单量同步增加时净收入上升', async () => {
    const base = await calculate({ city: 'guangzhou' }, loadRule)
    const both = await calculate(
      { city: 'guangzhou', work: { dailyHours: 12, dailyOrders: 42 } },
      loadRule,
    )
    expect(both.netMonthly).toBeGreaterThan(base.netMonthly)
  })

  it('单量增加会提高净收入', async () => {
    const base = await calculate({ city: 'guangzhou' }, loadRule)
    const more = await calculate({ city: 'guangzhou', work: { dailyOrders: 45 } }, loadRule)
    expect(more.netMonthly).toBeGreaterThan(base.netMonthly)
  })

  it('净收入必须小于总收入（成本与税为正值时）', async () => {
    const r = await calculate({ city: 'guangzhou' }, loadRule)
    expect(r.netMonthly).toBeLessThan(r.grossMonthly)
  })

  it('净收入必须为正数', async () => {
    const r = await calculate({ city: 'guangzhou' }, loadRule)
    expect(r.netMonthly).toBeGreaterThan(0)
    expect(Number.isFinite(r.netAnnual)).toBe(true)
  })

  it('未收录城市抛出明确错误，而不是返回 undefined', async () => {
    // loader 自身会因文件不存在抛 ENOENT，这是预期行为；
    // 关键是不能静默返回一个 0 或 undefined 让调用方误以为算出了结果
    await expect(calculate({ city: 'atlantis' }, loadRule)).rejects.toThrow()
  })

  it('未核实字段被如实列出，而不是静默当作官方数据', async () => {
    const rule = await loadRule('guangzhou')
    const fields = collectUnverifiedFields(rule)
    // 计价单价一定是未核实的：平台定价是商业规则，没有官方发布渠道
    expect(fields).toContain('计价单价/补贴')
  })

  it('34 座城市全部可计算且结果有限', async () => {
    const { readdirSync } = await import('node:fs')
    const cities = readdirSync('public/rules')
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''))

    expect(cities.length).toBe(34)

    for (const city of cities) {
      const r = await calculate({ city }, loadRule)
      expect(Number.isFinite(r.netMonthly), `${city} 净收入非有限数`).toBe(true)
      expect(r.netMonthly, `${city} 净收入为负`).toBeGreaterThan(0)
      expect(r.rightsScore).toBeGreaterThanOrEqual(0)
      expect(r.rightsScore).toBeLessThanOrEqual(100)
    }
  }, 30000)

  it('显式传入 undefined 不会覆盖默认值', async () => {
    const r = await calculate({ city: 'guangzhou', work: { dailyHours: undefined } }, loadRule)
    const base = await calculate({ city: 'guangzhou' }, loadRule)
    expect(r.netMonthly).toBe(base.netMonthly)
  })

  it('成本明细只含数值项，不含枚举字段', async () => {
    const r = await calculate({ city: 'guangzhou' }, loadRule)
    for (const [k, v] of Object.entries(r.costBreakdown)) {
      expect(typeof v, `成本明细项 ${k} 不是数值`).toBe('number')
    }
    expect(r.costBreakdown).not.toHaveProperty('vehicleType')
  })

  it('工时超过 20 小时被拒绝（物理不可能）', async () => {
    await expect(calculate({ city: 'guangzhou', work: { dailyHours: 24 } }, loadRule)).rejects.toThrow(/不得超过 20/)
  })

  it('日单量超过 200 被拒绝（防把月单量填成日单量）', async () => {
    await expect(calculate({ city: 'guangzhou', work: { dailyOrders: 900 } }, loadRule)).rejects.toThrow(/不得超过 200/)
  })

  it('工时 0 被拒绝而不是返回 0 或 NaN', async () => {
    await expect(calculate({ city: 'guangzhou', work: { dailyHours: 0 } }, loadRule)).rejects.toThrow()
  })

  it('工作 0 天时净收入为负且有限（只有成本没有收入）', async () => {
    const r = await calculate({ city: 'guangzhou', work: { workDaysMonth: 0, dailyOrders: 0 } }, loadRule)
    expect(r.netMonthly).toBeLessThan(0)
    expect(Number.isFinite(r.netMonthly)).toBe(true)
  })

  it('默认参数是稳定常量，不被调用副作用污染', async () => {
    const before = JSON.stringify(DEFAULT_WORK) + JSON.stringify(DEFAULT_COSTS)
    await calculate({ city: 'guangzhou', work: { dailyHours: 14 }, costs: { foodCostMonth: 3000 } }, loadRule)
    const after = JSON.stringify(DEFAULT_WORK) + JSON.stringify(DEFAULT_COSTS)
    expect(after).toBe(before)
  })
})
