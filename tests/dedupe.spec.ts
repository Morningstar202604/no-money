/**
 * 0.0.42 去重回归：这些重复此前都能「各自跑通」，只有跨模块断言才能发现。
 */
import { describe, it, expect } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { existsSync, readFileSync } from 'node:fs'
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

describe('0.0.43 删除旧引擎与小单元去重', () => {
  it('旧 src/engine 目录已删除，生产不再引用旧引擎', () => {
    expect(existsSync('src/engine')).toBe(false)
    const offenders: string[] = []
    for (const file of [
      'src/components/panels/TaxOptimizer.vue',
      'src/components/panels/RetirementPlanner.vue',
      'src/utils/pensionSeries.ts',
    ]) {
      const src = readFileSync(file, 'utf8')
      if (/engine\//.test(src)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })

  it('TaxOptimizer / RetirementPlanner 走 domain，不在页面里重算公式', () => {
    const tax = readFileSync('src/components/panels/TaxOptimizer.vue', 'utf8')
    const retire = readFileSync('src/components/panels/RetirementPlanner.vue', 'utf8')
    expect(tax).toMatch(/calcLaborAnnual/)
    expect(tax).toMatch(/calcSoleProprietorship/)
    expect(tax).toMatch(/adaptLaborRule/)
    expect(retire).toMatch(/projectRetirement/)
    expect(retire).toMatch(/adaptRetirementRule/)
  })

  it('/policy、/admin、/audit 共用同一套 34 城加载状态机', () => {
    for (const file of ['src/views/PolicyView.vue', 'src/views/AdminView.vue', 'src/views/AuditView.vue']) {
      const src = readFileSync(file, 'utf8')
      expect(src, `${file} 必须使用 useCityRules`).toMatch(/useCityRules/)
      expect(src, `${file} 不得再自建 loadCityRules 状态`).not.toMatch(/freshnessRequested|const freshnessLoading = ref/)
    }
  })

  it('Admin/Audit 的 12 张指标卡共用 DataMetricGrid，不再各写一份 markup', () => {
    for (const file of ['src/views/AdminView.vue', 'src/views/AuditView.vue']) {
      const src = readFileSync(file, 'utf8')
      expect(src).toMatch(/DataMetricGrid/)
      expect(src).not.toMatch(/class="metric-row"/)
    }
  })

  it('EmployeeView 的两种工资条模式共用一个参保城市字段', () => {
    const src = readFileSync('src/views/EmployeeView.vue', 'utf8')
    expect((src.match(/<span class="ep-label">参保城市<\/span>/g) ?? []).length).toBe(1)
  })

  it('TaxOptimizer 的应纳税所得额取自 domain，不再手写 20% 费用减除', () => {
    const tax = readFileSync('src/components/panels/TaxOptimizer.vue', 'utf8')
    expect(tax).toMatch(/taxableIncome/)
    expect(tax).toMatch(/expenseDeduction/)
    expect(tax).not.toMatch(/labor\.value \* 0\.8/)
    expect(tax).not.toMatch(/itrIncomeRate \?\? 0\) - \(soleRule\.value\?\.itrDeductionMonthly/)
  })

  it('置信度标签/色阶只有一套映射', () => {
    const policy = readFileSync('src/views/PolicyView.vue', 'utf8')
    const audit = readFileSync('src/views/AuditView.vue', 'utf8')
    expect(policy).toMatch(/confidenceType\(/)
    expect(policy).toMatch(/confidenceLabel\(/)
    expect(audit).toMatch(/confidenceTone\(/)
    expect(audit).toMatch(/confidenceLabel\(/)
    expect(policy).not.toMatch(/confidence === 'official' \? 'success'/)
    expect(policy).not.toMatch(/confidence === 'unverified' \? '登记于'/)
    expect(audit).not.toMatch(/conf === 'official' \? 'ok'/)
    const sourceTag = readFileSync('src/components/SourceTag.vue', 'utf8')
    expect(sourceTag).toMatch(/retrievedDateVerb\(/)
    expect(sourceTag).not.toMatch(/confidence === 'unverified' \? '登记于'/)
  })

  it('退休曲线基准来自 domain，不再向旧 BenefitEngine 传实例', () => {
    const src = readFileSync('src/utils/pensionSeries.ts', 'utf8')
    expect(src).toMatch(/projectRetirement/)
    expect(src).not.toMatch(/BenefitEngine/)
  })
})
