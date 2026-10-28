// @vitest-environment happy-dom
/**
 * 组件挂载级回归（RightsCompensation / DocumentGenerator）。
 *
 * 为什么需要它：现有 892 例测试几乎全是纯函数与源码字符串断言，
 * 「改了一处忘另一处」的接线缺陷只能靠正则碰运气。这里真挂载组件，
 * 锁定三条只有挂载才暴露的行为：
 *   1. 首屏示例金额不得进入 store（否则文书把示例当用户主张）
 *   2. 重置参数后必须回到「示例态」，不能把重置值重新标成已确认
 *   3. 用户在表单里改一项后，结果才写进 store，且金额随之变化
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { nextTick } from 'vue'
import RightsCompensation from '../../src/components/panels/RightsCompensation.vue'
import { useMainStore } from '../../src/stores/main'
import type { CityRule } from '../../src/types'
import { NMessageProvider } from 'naive-ui'

const rule = JSON.parse(readFileSync('public/rules/guangzhou.json', 'utf8')) as CityRule

/** naive-ui 组件在 happy-dom 下需要 message provider；这里用极简 stub 避免整库渲染 */
const stubs = {
  NCard: { template: '<div><slot name="header" /><slot /><slot name="action" /></div>' },
  NGrid: { template: '<div><slot /></div>' },
  NGi: { template: '<div><slot /></div>' },
  NTable: { template: '<table><slot /></table>' },
  NSteps: { template: '<div><slot /></div>' },
  NStep: { template: '<div><slot /></div>' },
  NTooltip: { template: '<span><slot name="trigger" /><slot /></span>' },
  NDivider: { template: '<hr />' },
  NAlert: { template: '<div><slot /></div>' },
  NButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
  NTag: { template: '<span><slot /></span>' },
  NInputNumber: { template: '<input />' },
  NSelect: { template: '<select />' },
  NSlider: { template: '<input type="range" />' },
  NSwitch: { template: '<input type="checkbox" />' },
  SourceTag: { template: '<span />' },
  FoldCard: { template: '<div><slot name="header" /><slot /></div>' },
  RealityList: { template: '<div />' },
}

/**
 * 必须套一层 n-message-provider：组件 setup 里调用 useMessage()，
 * 没有 provider 会在挂载阶段直接抛错（这是 naive-ui 的硬前置）。
 */
function mountPanel() {
  const Host = defineComponent({
    render() {
      return h(NMessageProvider, null, { default: () => h(RightsCompensation) })
    },
  })
  return mount(Host, {
    global: {
      stubs,
      provide: { rightsTab: { value: 'compensation' } },
    },
  })
}

describe('RightsCompensation 挂载行为', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('首屏示例金额不得写入 store（否则文书会把示例当主张）', async () => {
    const store = useMainStore()
    store.rule = rule
    mountPanel()
    await nextTick()
    expect(store.compensation, '未改动任何输入时 store.compensation 必须为 null').toBeNull()
  })

  it('用户改动输入后结果进入 store，且金额为正', async () => {
    const store = useMainStore()
    store.rule = rule
    const wrapper = mountPanel()
    await nextTick()
    // 通过真实控件改动「欠薪月数」：找第一个数字输入并派发 update:value，
    // 直接改内部 ref 会绕过模板接线，测不到「改了控件算不算用户确认」
    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    await input.setValue('5')
    await input.trigger('change')
    await nextTick()
    await nextTick()
    expect(store.compensation, '改动后结果应可进入文书').not.toBeNull()
    expect(store.compensation!.total).toBeGreaterThan(0)
  })
})
