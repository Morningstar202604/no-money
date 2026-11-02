// @vitest-environment happy-dom
/**
 * 告警主题可读性 —— 真实渲染测试
 *
 * 之前的版本读 App.vue 源码正则匹配 `contentTextColorInfo:`，改个字符串就通过，
 * 但主题 token 是否真的作用到 DOM 上完全没有验证。这里改为真实挂载 NAlert，
 * 断言内容确实渲染、且引用的 CSS 变量真实存在。
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { NAlert } from 'naive-ui'
import { readFileSync } from 'node:fs'

const Host = defineComponent({
  props: { type: { type: String, default: 'info' } },
  setup(props) {
    return () =>
      h(
        NAlert,
        { type: props.type as never, showIcon: true },
        { default: () => '告警正文内容，用于验证可读性' },
      )
  },
})

describe('告警组件渲染', () => {
  for (const type of ['info', 'success', 'warning', 'error'] as const) {
    it(`${type} 告警正文必须真实渲染出来`, async () => {
      const wrapper = mount(Host, { props: { type } })
      await nextTick()
      expect(wrapper.text()).toContain('告警正文内容')
      expect(wrapper.find('.n-alert').exists()).toBe(true)
      wrapper.unmount()
    })
  }
})

describe('告警主题 token 完整性', () => {
  const app = readFileSync('src/App.vue', 'utf8')
  const css = readFileSync('src/styles/variables.css', 'utf8')

  it('App.vue 引用的每一个告警 CSS 变量都必须在 variables.css 中定义', () => {
    const used = [...app.matchAll(/var\((--color-alert-[a-z-]+)\)/g)].map((m) => m[1])
    // 断言不是空集：如果以后有人删掉所有 token 引用，这条会失败而不是静默通过
    expect(used.length).toBeGreaterThan(10)
    for (const token of new Set(used)) {
      expect(css, `App.vue 引用了未定义的 CSS 变量 ${token}`).toContain(`${token}:`)
    }
  })

  it('四类告警都有独立的背景、边框与正文 token', () => {
    for (const cap of ['info', 'success', 'warning', 'error']) {
      const prefix = `--color-alert`
      expect(css, `缺少 ${cap} 背景 token`).toContain(`${prefix}-bg-${cap}:`)
      expect(css, `缺少 ${cap} 边框 token`).toContain(`${prefix}-border-${cap}:`)
      expect(css, `缺少 ${cap} 正文 token`).toContain(`${prefix}-text-${cap}:`)
    }
  })

  it('告警正文色不得与背景色相同（同色即不可读）', () => {
    // 从 variables.css 解析每类告警的 bg 与 text 值，逐对比较
    for (const cap of ['info', 'success', 'warning', 'error']) {
      const bg = css.match(new RegExp(`--color-alert-bg-${cap}:\\s*([^;]+);`))?.[1]?.trim()
      const text = css.match(new RegExp(`--color-alert-text-${cap}:\\s*([^;]+);`))?.[1]?.trim()
      expect(bg, `${cap} 缺少背景定义`).toBeTruthy()
      expect(text, `${cap} 缺少正文色定义`).toBeTruthy()
      expect(text, `${cap} 的正文色与背景色相同，文字将不可读`).not.toBe(bg)
    }
  })
})
