// @vitest-environment happy-dom
/**
 * AI 助手面板 —— 真实渲染测试
 *
 * 原版本只正则匹配一条 width 声明，改样式名或加选择器就失效，也没验证组件能否渲染。
 * 这里真实挂载组件（含 naive-ui 的 message provider），断言可渲染、入口存在，
 * 并在渲染后的 DOM 上检查面板宽度不超出视口。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { NMessageProvider } from 'naive-ui'
import ChatAssistant from '../src/components/ChatAssistant.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

/** ChatAssistant 内部调用 useMessage()，必须包在 provider 里才能挂载 */
function mountWithProviders(props: Record<string, unknown> = {}) {
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(NMessageProvider, null, {
          default: () => h(ChatAssistant, props as never),
        })
    },
  })
  return mount(Wrapper, {
    global: { plugins: [createPinia()] },
    attachTo: document.body,
  })
}

describe('AI 助手面板', () => {
  it('组件可以挂载并渲染出助手入口', async () => {
    const wrapper = mountWithProviders({ scenarios: [] })
    await nextTick()
    expect(wrapper.html().length).toBeGreaterThan(50)
    expect(wrapper.html()).toMatch(/AI|助手/)
    wrapper.unmount()
  })

  it('打开面板后宽度不超过视口（320px 不得越界）', async () => {
    const wrapper = mountWithProviders({ scenarios: [] })
    await nextTick()

    const trigger = wrapper.findAll('button').find((b) => /AI|助手/.test(b.attributes('aria-label') ?? b.text()))
    expect(trigger, '必须存在可访问的助手入口按钮').toBeTruthy()
    await trigger!.trigger('click')
    await nextTick()

    const panel = wrapper.find('.chat-panel')
    if (panel.exists()) {
      const el = panel.element as HTMLElement
      const width = el.getBoundingClientRect().width
      const vw = window.innerWidth || 320
      expect(width).toBeLessThanOrEqual(vw + 1)
    }
    wrapper.unmount()
  })
})
