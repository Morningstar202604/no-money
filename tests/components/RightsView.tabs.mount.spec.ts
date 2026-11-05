// @vitest-environment happy-dom
/**
 * 维权页签与补偿结果的生命周期
 *
 * 澄清一件事（原注释曾写错，已更正）：
 * store.compensation 只在「切换城市」与「重置参数」时清空。
 * 维权页的面板重新挂载不会清它——calc() 只由规则变更与用户输入触发，
 * 不在 onMounted 里跑。所以这里测的不是"切页签会不会丢金额"（不会），
 * 而是"跨页签、跨视图切换时金额是否被正确保留"。
 *
 * 后者才是用户真正遇到的：算完补偿 → 去总览看收入 → 回来写文书。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { NMessageProvider } from 'naive-ui'
import RightsView from '../../src/views/RightsView.vue'
import { useMainStore } from '../../src/stores/main'

/** 复用同一个 pinia 才能模拟"同一会话内离开再回来"；每次新建等于重开会话 */
function mountView(existingPinia?: ReturnType<typeof createPinia>) {
  const pinia = existingPinia ?? createPinia()
  setActivePinia(pinia)
  const Wrapper = defineComponent({
    setup() {
      return () => h(NMessageProvider, null, { default: () => h(RightsView) })
    },
  })
  return {
    wrapper: mount(Wrapper, { global: { plugins: [pinia] }, attachTo: document.body }),
    store: useMainStore(),
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('维权页签结构', () => {
  it('三个页签都渲染出来', async () => {
    const { wrapper } = mountView()
    await nextTick()
    await nextTick()

    const html = wrapper.html()
    for (const label of ['补偿计算', '维权指南', '文书生成']) {
      expect(html, `缺少页签「${label}」`).toContain(label)
    }

    wrapper.unmount()
  })

  it('页签数量为 3，顺序是 补偿 → 指南 → 文书（主链路顺序）', async () => {
    const { wrapper } = mountView()
    await nextTick()
    await nextTick()
    await new Promise((r) => setTimeout(r, 150))

    const tabs = wrapper.findAll('.n-tabs-tab')
    expect(tabs.length).toBe(3)
    expect(tabs[0].text()).toContain('补偿计算')
    expect(tabs[1].text()).toContain('维权指南')
    expect(tabs[2].text()).toContain('文书生成')

    wrapper.unmount()
  })
})

describe('补偿结果的生命周期', () => {
  it('补偿结果写入后，切换页签不会丢失', async () => {
    const { wrapper, store } = mountView()
    await nextTick()
    await nextTick()
    await new Promise((r) => setTimeout(r, 150))

    store.setCompensation({ scene: 'wage', total: 12000, conditionalTotal: 46000, items: [] } as never)
    expect(store.compensation).toBeTruthy()

    const tabs = wrapper.findAll('.n-tabs-tab')
    for (let i = 0; i < 3; i++) {
      await tabs[i].trigger('click')
      await nextTick()
      await new Promise((r) => setTimeout(r, 100))
      expect(store.compensation, `切到第 ${i + 1} 个页签后结果丢失`).toBeTruthy()
    }

    wrapper.unmount()
  })

  it('视图卸载后重新挂载，补偿结果仍在（同一会话内）', async () => {
    // 手动持有 pinia：这是"同一会话"的唯一凭据。
    // 用 store.$pinia 取回不可靠（实现的返回形态与测试期望不一致）。
    const pinia = createPinia()
    setActivePinia(pinia)

    const first = mountView(pinia)
    await nextTick()
    await new Promise((r) => setTimeout(r, 150))

    first.store.setCompensation({ scene: 'wage', total: 15000, conditionalTotal: 0, items: [] } as never)
    expect(first.store.compensation).toBeTruthy()
    first.wrapper.unmount()

    // 离开权益页再回来：复用同一个 pinia
    const second = mountView(pinia)
    await nextTick()
    await new Promise((r) => setTimeout(r, 200))

    expect(second.store.compensation, '离开再回来，补偿结果丢失').toBeTruthy()
    second.wrapper.unmount()
  })
})
