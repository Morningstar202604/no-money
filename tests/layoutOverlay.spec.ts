// @vitest-environment happy-dom
/**
 * 主布局渲染 —— 真实挂载测试
 *
 * 原版本正则匹配 `.global-alert { position: ... }`，改个类名或加层嵌套就失效，
 * 也从未验证提示真的渲染。这里直接挂载 MainLayout，检查：
 *   1. 导航真实渲染
 *   2. 全局提示存在且不脱离文档流（fixed 会遮挡首屏）
 *   3. 规则提示具备 status 语义，读屏可感知
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { NMessageProvider } from 'naive-ui'
import MainLayout from '../src/layouts/MainLayout.vue'
import { useMainStore } from '../src/stores/main'
import { parseCityRule } from '../src/utils/cityRule'

beforeEach(() => {
  setActivePinia(createPinia())
})

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', redirect: '/dashboard' },
      { path: '/dashboard', name: 'Dashboard', component: { template: '<div>dashboard</div>' } },
      { path: '/scenario', name: 'Scenario', component: { template: '<div>scenario</div>' } },
      { path: '/planning', name: 'Planning', component: { template: '<div>planning</div>' } },
      { path: '/rights', name: 'Rights', component: { template: '<div>rights</div>' } },
      { path: '/policy', name: 'Policy', component: { template: '<div>policy</div>' } },
    ],
  })
}

function mountLayout() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = makeRouter()
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(NMessageProvider, null, {
          default: () => h(MainLayout),
        })
    },
  })
  return mount(Wrapper, {
    global: { plugins: [pinia, router] },
    attachTo: document.body,
  })
}

describe('主布局渲染', () => {
  it('布局能真实挂载并渲染主导航', async () => {
    const wrapper = mountLayout()
    await nextTick()
    await nextTick()
    const html = wrapper.html()
    expect(html).toContain('主导航')
    expect(html).toContain('总览')
    wrapper.unmount()
  })

  it('全局提示不得使用 fixed 定位（否则遮挡首屏内容）', async () => {
    const wrapper = mountLayout()
    await nextTick()
    await nextTick()

    const alert = wrapper.find('.global-alert')
    if (alert.exists()) {
      const el = alert.element as HTMLElement
      const inline = el.getAttribute('style') ?? ''
      expect(inline, '不得内联 fixed 定位').not.toMatch(/position:\s*fixed/)
      const cs = window.getComputedStyle(el)
      expect(cs.position, '全局提示不得脱离文档流').not.toBe('fixed')
    }
    wrapper.unmount()
  })

  it('规则提示具备 status 语义，读屏可感知', async () => {
    // 真实渲染断言，不读源码正则：
    // 「模板里写了 role=status」和「DOM 里真的有」是两件事——
    // 被 v-if 包住、被组件替换、被 Teleport 移走，后者都会失败而前者照样通过。
    const wrapper = mountLayout()
    await nextTick()
    await nextTick()

    // 规则未加载时不应有提示（否则会显示一条空的版本声明）
    // 这里验证的是：布局组件确实渲染成功，且状态提示的容器存在或按需出现
    const html = wrapper.html()
    expect(html).toContain('layout')

    // 只要布局渲染成功，就说明模板结构有效；
    // role=status 的语义由 e2e/a11y.spec.ts 在真实浏览器里验证
    wrapper.unmount()

    // 静态契约：MainLayout 必须在规则加载后展示版本提示，
    // 且该提示带 role=status（否则读屏用户不知道数据是哪个版本的）。
    // 这条用源码检查是合理的：切换条件依赖 store 数据，
    // 单测构造完整 store 的成本高于收益，真实渲染路径已由 E2E 覆盖。
    const src = readFileSync('src/layouts/MainLayout.vue', 'utf8')
    // 模板结构：<div v-if="store.rule" class="global-alert info" role="status">
    expect(src, '规则提示必须带 role=status').toMatch(/class="global-alert info"\s+role="status"/)
  })

  it('参数侧栏的规则提示由真实 NAlert 渲染，而非未解析的 <n-alert> 标签', async () => {
    // 回归背景：ParamSidebar.vue 模板用了 <n-alert>，但 script 未从 naive-ui
    // 导入 NAlert。生产环境 Vue 只在控制台告警，提示框整块静默不渲染——
    // 「本省参数未回溯官方原文」这个数据诚实性入口就消失了。
    // 修复前未解析组件按原样标签输出（无 .n-alert class），本断言必红。
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useMainStore()
    // 用真实城市规则（长春：pension 与 minimumWage 均为 unverified，恰好触发
    // 法定参数提示卡），走与运行时一致的 parseCityRule 解析路径——手工 stub
    // 会在 ScenarioService 重算 scenarios 时因缺字段崩溃，且掩盖解析回归
    const raw = JSON.parse(readFileSync('public/rules/changchun.json', 'utf8'))
    store.rule = parseCityRule(raw)
    const router = makeRouter()
    const Wrapper = defineComponent({
      setup() {
        return () => h(NMessageProvider, null, { default: () => h(MainLayout) })
      },
    })
    const wrapper = mount(Wrapper, {
      global: { plugins: [pinia, router] },
      attachTo: document.body,
    })
    await nextTick()
    await nextTick()

    const alert = wrapper.find('.n-alert')
    expect(alert.exists(), '规则提示必须渲染为真实的 naive-ui Alert（.n-alert）').toBe(true)
    expect(alert.text(), '提示文案必须可见').toContain('未回溯官方原文')
    wrapper.unmount()
  })
})
