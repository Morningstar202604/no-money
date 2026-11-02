import { readFileSync, readdirSync } from 'node:fs'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMainStore } from '../src/stores/main'
import { parseCityRule } from '../src/utils/cityRule'

const rule = JSON.parse(readFileSync('public/rules/guangzhou.json', 'utf8'))

function fetchRule(value: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(value))))
}

describe('城市规则运行时校验与时效提示', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.useFakeTimers(); vi.setSystemTime(new Date('2028-01-01T00:00:00Z')) })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('全部 34 城原始规则均可加载', async () => {
    const files = readdirSync('public/rules').filter(f => f.endsWith('.json'))
    expect(files).toHaveLength(34)
    const store = useMainStore()
    for (const file of files) {
      const data = JSON.parse(readFileSync(`public/rules/${file}`, 'utf8'))
      fetchRule(data)
      await store.loadRule(data.city)
      expect(store.loadError, file).toBeNull()
      expect(store.rule?.city, file).toBe(data.city)
    }
  })

  it.each([
    ['空值', null],
    ['缺少 benefit', { ...rule, benefit: undefined }],
    ['错误数值类型', { ...rule, minimumWage: { ...rule.minimumWage, monthly: '2680' } }],
    ['税表为空', { ...rule, tax: { ...rule.tax, laborRemuneration: { ...rule.tax.laborRemuneration, taxTable: [] } } }],
    ['来源置信度无效', { ...rule, sources: { ...rule.sources, income: { ...rule.sources.income, confidence: 'official-ish' } } }],
    ['上下限颠倒', { ...rule, benefit: { ...rule.benefit, pension: { ...rule.benefit.pension, baseMin: 999999 } } }],
    ['税率表不连续', { ...rule, tax: { ...rule.tax, laborRemuneration: { ...rule.tax.laborRemuneration, taxTable: [{ min: 5, max: 10, rate: 0.1, deduction: 0 }] } } }],
    ['错误的整体核验状态', { ...rule, verified: true }],
  ])('拒绝结构错误的规则：%s', async (_, data) => {
    fetchRule(data)
    const store = useMainStore()
    await store.loadRule('guangzhou')
    expect(store.rule).toBeNull()
    expect(store.loadError).toContain('规则')
  })

  it.each([
    ['劳务费用扣除率', (value: number) => ({ ...rule, tax: { ...rule.tax, laborRemuneration: { ...rule.tax.laborRemuneration, expenseDeductionRate: value } } })],
    ['医保档次费率', (value: number) => ({ ...rule, benefit: { ...rule.benefit, medicalTiers: [{ id: 'tier', name: '档次', rate: value, note: '说明' }] } })],
    ['养老金个人账户费率', (value: number) => ({ ...rule, retirement: { ...rule.retirement, personalAccountRate: value } })],
    ['养老金年收益率', (value: number) => ({ ...rule, retirement: { ...rule.retirement, assumedAnnualReturn: value } })],
    ['增值税率', (value: number) => ({ ...rule, soleProprietorship: { ...rule.soleProprietorship, vatRate: value } })],
    ['行业所得率', (value: number) => ({ ...rule, soleProprietorship: { ...rule.soleProprietorship, itrIncomeRate: value } })],
  ])('校验比例字段 %s 的范围', (_, makeRule) => {
    expect(() => parseCityRule(makeRule(0))).not.toThrow()
    expect(() => parseCityRule(makeRule(1))).not.toThrow()
    expect(() => parseCityRule(makeRule(2))).toThrow('城市规则')
    expect(() => parseCityRule(makeRule(-0.01))).toThrow('城市规则')
  })

  it.each([
    ['劳务报酬税表', 'labor'],
    ['经营所得税表', 'biz'],
  ] as const)('拒绝%s首档速算扣除数非零', (_, kind) => {
    const data = kind === 'labor'
      ? { ...rule, tax: { ...rule.tax, laborRemuneration: { ...rule.tax.laborRemuneration, taxTable: rule.tax.laborRemuneration.taxTable.map((item: { deduction: number }, index: number) => index === 0 ? { ...item, deduction: 100 } : item) } } }
      : { ...rule, soleProprietorship: { ...rule.soleProprietorship, bizTaxTable: rule.soleProprietorship.bizTaxTable.map((item: { deduction: number }, index: number) => index === 0 ? { ...item, deduction: 100 } : item) } }
    expect(() => parseCityRule(data)).toThrow('城市规则')
  })

  it.each([
    ['劳务报酬税表', 'labor'],
    ['经营所得税表', 'biz'],
  ] as const)('拒绝%s边界税额不连续（速算扣除数异常大）', (_, kind) => {
    const data = kind === 'labor'
      ? { ...rule, tax: { ...rule.tax, laborRemuneration: { ...rule.tax.laborRemuneration, taxTable: rule.tax.laborRemuneration.taxTable.map((item: { deduction: number }, index: number) => index === 1 ? { ...item, deduction: 999999 } : item) } } }
      : { ...rule, soleProprietorship: { ...rule.soleProprietorship, bizTaxTable: rule.soleProprietorship.bizTaxTable.map((item: { deduction: number }, index: number) => index === 1 ? { ...item, deduction: 999999 } : item) } }
    expect(() => parseCityRule(data)).toThrow('城市规则')
  })

  it.each([
    ['单档税率为 0', [{ min: 0, max: 100000, rate: 0, deduction: 0 }]],
    ['单档扣除数非零', [{ min: 0, max: 100000, rate: 0.1, deduction: 100 }]],
    ['首档扣除数非零但整体平移连续', [{ min: 0, max: 100, rate: 0.05, deduction: 5 }, { min: 100, max: 200, rate: 0.1, deduction: 10 }]],
  ])('拒绝规避连续性检查的税表：%s', (_, taxTable) => {
    const data = { ...rule, tax: { ...rule.tax, laborRemuneration: { ...rule.tax.laborRemuneration, taxTable } } }
    expect(() => parseCityRule(data)).toThrow('城市规则')
  })

  it('合法税表的边界税额保持连续', () => {
    expect(() => parseCityRule(rule)).not.toThrow()
    for (const table of [rule.tax.laborRemuneration.taxTable, rule.soleProprietorship.bizTaxTable]) {
      expect(table[0].deduction).toBe(0)
      for (let i = 1; i < table.length; i++) {
        expect(table[i].min * table[i].rate - table[i].deduction).toBeCloseTo(table[i - 1].max * table[i - 1].rate - table[i - 1].deduction, 6)
      }
    }
  })

  it('过往年份提示仅说明版本与核对时间，不宣称政策仍有效', async () => {
    fetchRule(rule)
    const store = useMainStore()
    await store.loadRule('guangzhou')
    expect(store.ruleTimeNotice).toContain('2026')
    expect(store.ruleTimeNotice).toContain('核实')
    expect(store.ruleTimeNotice).not.toContain('仍有效')
  })
})
