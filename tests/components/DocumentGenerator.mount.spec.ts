// @vitest-environment happy-dom
/**
 * 文书生成器挂载级回归。
 *
 * 只有挂载才能验证的契约：
 *   1. 补偿结果里的金额必须真的出现在仲裁申请书正文里（不是只存在 store）
 *   2. 按月给付项（伤残津贴）必须单独成段，且不出现在一次性合计里
 *   3. 文书城市跟随当前测算城市，不写死广州
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import { NMessageProvider } from 'naive-ui'
import { readFileSync } from 'node:fs'
import DocumentGenerator from '../../src/components/panels/DocumentGenerator.vue'
import { useMainStore } from '../../src/stores/main'
import type { CityRule, CompensationResult } from '../../src/types'

const rule = JSON.parse(readFileSync('public/rules/guangzhou.json', 'utf8')) as CityRule

const stubs = {
  NCard: { template: '<div><slot name="header" /><slot /><slot name="action" /></div>' },
  NGrid: { template: '<div><slot /></div>' },
  NGi: { template: '<div><slot /></div>' },
  NDivider: { template: '<hr />' },
  NAlert: { template: '<div><slot /></div>' },
  NButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
  NInput: { template: '<input />' },
  NSelect: { template: '<select />' },
  NDatePicker: { template: '<input />' },
}

function mountDoc() {
  const Host = defineComponent({
    render: () => h(NMessageProvider, null, { default: () => h(DocumentGenerator) }),
  })
  return mount(Host, { global: { stubs } })
}

const compensation: CompensationResult = {
  scene: '职业伤害/工伤',
  total: 168000,
  conditionalTotal: 0,
  items: [
    { name: '一次性伤残补助金（4级 · 21个月本人工资）', amount: 168000, note: '《工伤保险条例》第35–38条', kind: 'claim' },
    { name: '按月伤残津贴（4级 · 本人工资的75%/月）', amount: 6000, note: '第35、36条：每月发放直至退休', kind: 'conditional', period: 'monthly' },
  ],
  legalRefs: [{ law: '工伤保险条例', article: '35–38', summary: '一次性伤残补助金按月数支付' }],
}

describe('DocumentGenerator 挂载行为', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('补偿金额进入仲裁请求正文，按月项单独成段且不混入一次性合计', async () => {
    const store = useMainStore()
    store.rule = rule
    store.setCompensation(compensation)
    const wrapper = mountDoc()
    await nextTick()
    const text = wrapper.text().replace(/\s+/g, '')
    expect(text).toContain('168,000')
    expect(text).toContain('按月给付合计')
    expect(text).toContain('6,000')
    // 一次性合计必须仍是 168,000，不能被月度津贴污染成 174,000
    expect(text).not.toContain('174,000')
  })

  it('文书抬头使用当前测算城市而不是写死广州', async () => {
    const sz = JSON.parse(readFileSync('public/rules/shenzhen.json', 'utf8')) as CityRule
    const store = useMainStore()
    store.rule = sz
    store.setCompensation(compensation)
    const wrapper = mountDoc()
    await nextTick()
    const text = wrapper.text().replace(/\s+/g, '')
    expect(text).toContain('深圳市劳动人事争议仲裁委员会')
    expect(text).not.toContain('广州市劳动人事争议仲裁委员会')
  })
})
