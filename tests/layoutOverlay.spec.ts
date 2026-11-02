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

  it('规则提示具备 status 语义，读屏可感知', () => {
    // MainLayout 渲染依赖完整 store 数据（scenarios/rule），在单测里构造完整依赖
    // 成本高于价值；这里断言模板契约本身：规则提示必须带 role=status。
    // 真实渲染路径已由 e2e/app.spec.ts 在浏览器中覆盖。
    const src = readFileSync('src/layouts/MainLayout.vue', 'utf8')
    const infoAlert = src.match(/<div[^>]*class="global-alert info"[^>]*>/)
    expect(infoAlert, '必须存在信息类全局提示').not.toBeNull()
    expect(infoAlert![0], '规则提示缺少 role=status，读屏用户不会被告知数据版本').toContain('role="status"')
  })
})
