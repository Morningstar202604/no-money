/**
 * 0.0.42 去重回归：这些重复此前都能「各自跑通」，只有跨模块断言才能发现。
 */
import { describe, it, expect } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { useMainStore } from '../src/stores/main'
import { calculate, DEFAULT_WORK, DEFAULT_COSTS } from '../src/kernel/calculate'
import { DEFAULT_WORK as SHARED_WORK, DEFAULT_COSTS as SHARED_COSTS } from '../src/domain/shared/defaults'
import { countSourceConfidence } from '../src/utils/sourceFreshness'
import { cityRuleLoadNotice } from '../src/data/cityRules'
import { listRuleCities, createNodeRuleLoader } from '../src/kernel/nodeRules'
import type { CityRule } from '../src/types'

const loadRule = async (city: string) =>
  JSON.parse(readFileSync(`public/rules/${city}.json`, 'utf8')) as CityRule

describe('0.0.42 去重', () => {
  it('Web 与内核的默认参数是同一份对象，不是两份碰巧相等的字面量', () => {
    expect(DEFAULT_WORK).toBe(SHARED_WORK)
    expect(DEFAULT_COSTS).toBe(SHARED_COSTS)
  })

  it('内核默认成本逐项使用 Web 口径，而不是另一套总额相同的默认值', async () => {
    const r = await calculate({ city: 'guangzhou' }, loadRule)
    expect(r.costBreakdown.maintenanceMonth).toBe(200)
    expect(r.costBreakdown.foodCostMonth).toBe(800)
    expect(r.costBreakdown.insuranceMonth).toBe(100)
    expect(r.costBreakdown.trafficFineMonth).toBe(50)
    expect(r.costBreakdown.vehicleDepreciationMonth).toBe(300)
    expect(r.costBreakdown.otherCostMonth).toBe(100)
    // 净收入快照仍与 Web 端一致；统一默认值不能悄悄改掉用户看到的结论
    expect(r.netMonthly).toBe(6843.7)
  })

  it('未知置信度必须算作 unverified，不能漏出分母', () => {
    const counts = countSourceConfidence({
      official: { confidence: 'official' },
      derived: { confidence: 'derived' },
      dirty: { confidence: 'something-new' },
      missing: {},
    })
    expect(counts).toEqual({ total: 4, official: 1, derived: 1, unverified: 2 })
  })

  it('34 城加载提示只有一套文案：索引回退与缺失城都要交代', () => {
    expect(cityRuleLoadNotice({
      ids: ['guangzhou'],
      rules: [],
      missing: ['shenzhen'],
      usedRegistryFallback: true,
    })).toContain('回退到内置 34 城注册表')
  })

  it('scenarios 直接复用 comparison.scenarios，不再对同一批输入跑第二遍', () => {
    setActivePinia(createPinia())
    const store = useMainStore()
    store.rule = loadRuleSync('guangzhou')
    const comp = store.comparison
    expect(comp).not.toBeNull()
    expect(store.scenarios).toBe(comp!.scenarios)
  })

  it('CLI/API/MCP 的规则清单与缺失城市文案同源', async () => {
    const cities = listRuleCities('public/rules')
    expect(cities).toHaveLength(34)
    expect(cities.map((c) => c.id)).toEqual([...cities.map((c) => c.id)].sort((a, b) => a.localeCompare(b)))
    await expect(createNodeRuleLoader('public/rules')('not-a-city')).rejects.toThrow('未收录城市')
  })
})

function loadRuleSync(city: string): CityRule {
  return JSON.parse(readFileSync(`public/rules/${city}.json`, 'utf8')) as CityRule
}
