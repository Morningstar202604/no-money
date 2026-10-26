/**
 * 主 store 接线回归测试
 *
 * 背景：comparison 计算曾把每个场景的 personal 覆盖为 personal.value 重算，
 * 导致「缴齐社保」场景在排行榜/图表里被按「未参保」重算，与场景卡片
 * （读 scenarios）数值打架。引擎单测全绿也发现不了——缺陷在 store 接线。
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { useMainStore } from '../../src/stores/main'
import type { CityRule } from '../../src/types'

const rule = JSON.parse(readFileSync('public/rules/guangzhou.json', 'utf8')) as CityRule
const ruleSz = JSON.parse(readFileSync('public/rules/shenzhen.json', 'utf8')) as CityRule

describe('主 store：scenarios 与 comparison 必须对同一场景给出一致数值', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('每个场景在 comparison.scenarios 中的净收入/权益分与 scenarios 一致', () => {
    const store = useMainStore()
    store.rule = rule

    const scenarios = store.scenarios
    const comp = store.comparison
    expect(comp, 'comparison 不应为 null').not.toBeNull()
    expect(comp!.scenarios.length).toBe(scenarios.length)

    for (const s of scenarios) {
      const c = comp!.scenarios.find(x => x.id === s.id)
      expect(c, `对比结果缺少场景 ${s.id}`).toBeTruthy()
      expect(c!.netMonthly, `场景 ${s.id} 月净收入与 scenarios 不一致`).toBeCloseTo(s.netMonthly, 6)
      expect(c!.rightsScore, `场景 ${s.id} 权益分与 scenarios 不一致`).toBe(s.rightsScore)
    }
  })

  it('未参保时提供「缴齐社保」场景，且净收入低于当前方案、权益分更高', () => {
    const store = useMainStore()
    store.rule = rule
    store.personal.hasSocialInsurance = false

    const comp = store.comparison!
    const current = comp.scenarios.find(s => s.id === 'current')!
    const insured = comp.scenarios.find(s => s.id === 'with_insurance')

    expect(insured, '未参保时必须提供「缴齐社保」场景').toBeTruthy()
    expect(insured!.netMonthly).toBeLessThan(current.netMonthly)
    expect(insured!.rightsScore).toBeGreaterThan(current.rightsScore)
  })

  it('已参保时不再提供「缴齐社保」场景', () => {
    const store = useMainStore()
    store.rule = rule
    store.personal.hasSocialInsurance = true

    const comp = store.comparison!
    expect(comp.scenarios.some(s => s.id === 'with_insurance')).toBe(false)
    expect(store.scenarios.some(s => s.id === 'with_insurance')).toBe(false)
  })
})

describe('主 store：规则加载与切城的用户数据安全', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => {
    vi.restoreAllMocks()
    delete (globalThis as { fetch?: unknown }).fetch
  })

  function mockFetchJson(payload: unknown, ctype = 'application/json', status = 200) {
    const fn = vi.fn(async () => new Response(JSON.stringify(payload), { status, headers: { 'content-type': ctype } }))
    ;(globalThis as { fetch?: unknown }).fetch = fn as unknown as typeof fetch
    return fn
  }

  it('同城重载（启动失败后重试）不得清空本城口径的自选基数', async () => {
    mockFetchJson(rule)
    const store = useMainStore()
    store.rule = rule
    store.personal.pensionBase = 10000
    store.personal.medicalBase = 8000

    await store.loadRule('guangzhou')

    expect(store.loadError, '同城重载不应报错').toBeNull()
    expect(store.personal.pensionBase, '基数按本城口径填写，重载后必须保留').toBe(10000)
    expect(store.personal.medicalBase).toBe(8000)
    expect(store.cityNotice, '没有切城就不该出现「已切换」提示').toBeNull()
  })

  it('切城加载失败时，原城市的自定义方案必须存活（先斩后奏清空即丢数据）', async () => {
    const fn = mockFetchJson(rule)
    fn.mockRejectedValueOnce(new Error('网络失败'))
    const store = useMainStore()
    store.rule = rule
    store.addScenario('夜班方案', store.work, store.costs)

    await store.setCity('shenzhen')

    expect(store.loadError, '切城失败应给出错误').toBeTruthy()
    expect(store.customPlans.length, '目标城市加载失败不得清空原有方案').toBe(1)
  })

  it('切城成功才清空自定义方案与补偿结果，并给出提示', async () => {
    mockFetchJson(ruleSz)
    const store = useMainStore()
    store.rule = rule
    store.addScenario('夜班方案', store.work, store.costs)
    store.setCompensation({} as never)

    await store.setCity('shenzhen')

    expect(store.rule?.city).toBe('shenzhen')
    expect(store.customPlans.length, '方案属于上一城市，切换成功后清空').toBe(0)
    expect(store.compensation, '补偿金额含本城基数封顶，切换成功后作废').toBeNull()
    expect(store.cityNotice ?? '', '清空行为必须告知用户').toContain('自定义方案')
  })

  it('content-type 为 octet-stream 的合法 JSON 规则文件也能加载', async () => {
    mockFetchJson(rule, 'application/octet-stream')
    const store = useMainStore()

    await store.loadRule('guangzhou')

    expect(store.rule, 'CDN 以 octet-stream 下发 .json 时不得误报文件不存在').not.toBeNull()
    expect(store.loadError).toBeNull()
  })

  it('SPA 回退的 200 + HTML 仍被拒绝（防「深圳抄广州」的守卫保留）', async () => {
    ;(globalThis as { fetch?: unknown }).fetch = vi.fn(async () =>
      new Response('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } })
    ) as unknown as typeof fetch
    const store = useMainStore()

    await store.loadRule('guangzhou')

    expect(store.rule).toBeNull()
    expect(store.loadError ?? '').toContain('未找到')
  })
})

describe('主 store：跨字段约束不能让测算静默变空', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('当前年龄被调到超过退休年龄时，退休年龄自动跟随（否则服务层拒绝 → 全页显示 0）', () => {
    const store = useMainStore()
    store.rule = rule
    store.personal.expectedRetireAge = 60
    store.personal.currentAge = 65

    // 服务层的校验是 expectedRetireAge > currentAge；store 必须保证这一点，
    // 否则 scenarios 变空数组，页面显示「正常但全是零」
    expect(store.personal.expectedRetireAge).toBeGreaterThan(store.personal.currentAge)
    expect(store.scenarios.length, '年龄矛盾不得让场景整体消失').toBeGreaterThan(0)
    expect(store.comparison?.best, '对比结果不应为 null').toBeTruthy()
  })

  it('极端年龄（80 岁当前年龄）也不产生空测算', () => {
    const store = useMainStore()
    store.rule = rule
    store.personal.currentAge = 80

    expect(store.personal.expectedRetireAge).toBeGreaterThan(80)
    expect(store.scenarios.length).toBeGreaterThan(0)
  })

  it('从存储恢复出矛盾年龄对时，初始化即修正（watch 不会在赋初值时触发）', async () => {
    // 模拟老版本写入/用户手改的 localStorage：currentAge 70 > expectedRetireAge 60
    const storeMap = new Map<string, string>()
    const original = globalThis.localStorage
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => storeMap.get(k) ?? null,
      setItem: (k: string, v: string) => { storeMap.set(k, v) },
      removeItem: (k: string) => { storeMap.delete(k) },
      clear: () => { storeMap.clear() },
      key: () => null,
      get length() { return storeMap.size },
    } as unknown as Storage
    storeMap.set('flexcalc_params_v1', JSON.stringify({
      personal: { currentAge: 70, expectedRetireAge: 60, hasSocialInsurance: false, specialDeductionMonth: 0 },
    }))

    try {
      // 重新载入模块，让 store 在矛盾数据上初始化
      vi.resetModules()
      const { useMainStore: freshStore } = await import('../../src/stores/main')
      setActivePinia(createPinia())
      const store = freshStore()
      store.rule = rule

      expect(store.personal.currentAge).toBe(70)
      expect(store.personal.expectedRetireAge, '恢复矛盾年龄后必须自动修正').toBeGreaterThan(70)
      expect(store.scenarios.length, '初始化即修正，不得让测算为空').toBeGreaterThan(0)
    } finally {
      ;(globalThis as unknown as { localStorage: Storage }).localStorage = original
      vi.resetModules()
    }
  })
})
