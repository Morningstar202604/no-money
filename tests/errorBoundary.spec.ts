// @vitest-environment happy-dom
/**
 * 视图级错误边界的行为测试
 *
 * 关键反证思想：如果这个边界形同虚设（比如 onErrorCaptured 没返回 false、
 * 或降级 UI 没渲染），下面的测试会直接失败——而不是"写了但永远绿"。
 *
 * 验证的行为：
 *   1. 子组件渲染抛错 → 边界接管，显示降级卡（不是把错误抛到顶层）
 *   2. 降级卡有可操作出口（重试 / 回总览）
 *   3. 正常子组件不受影响（不误伤）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import ErrorBoundary from '../src/components/ErrorBoundary.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard', name: 'Dashboard', component: { template: '<div>dash</div>' } },
      { path: '/', redirect: '/dashboard' },
    ],
  })
}

/** 挂载后必然抛错的子组件 */
const Boom = defineComponent({
  setup() {
    // 渲染期抛错：错误的典型来源（数据形状不符合预期）
    throw new Error('模拟视图渲染异常')
  },
  render() { return h('div', 'never') },
})

const Good = defineComponent({ render: () => h('div', { class: 'good-child' }, '正常内容') })

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('ErrorBoundary', () => {
  it('子组件渲染抛错 → 显示降级卡而不是把异常抛出', async () => {
    const router = makeRouter()
    const wrapper = mount(defineComponent({
      setup: () => () => h(ErrorBoundary, null, { default: () => h(Boom) }),
    }), { global: { plugins: [router] }, attachTo: document.body })

    await nextTick()
    await nextTick()

    const html = wrapper.html()
    expect(html, '应显示降级标题').toContain('这一页显示出错了')
    expect(html, '应有重试出口').toContain('重试')
    expect(html, '应回总览出口').toContain('回总览')
    // 错误消息只展示首行且截断，不含堆栈
    expect(html).toContain('模拟视图渲染异常')

    wrapper.unmount()
  })

  it('重试按钮存在且可点击（不抛异常）', async () => {
    const router = makeRouter()
    await router.push('/dashboard')
    await router.isReady()
    const wrapper = mount(defineComponent({
      setup: () => () => h(ErrorBoundary, null, { default: () => h(Boom) }),
    }), { global: { plugins: [router] }, attachTo: document.body })
    await nextTick()
    await nextTick()

    const retry = wrapper.findAll('button').find((b) => b.text() === '重试')
    expect(retry).toBeTruthy()
    // 点击不应抛错（重建子树仍会抛错并被再次捕获）
    expect(() => retry!.trigger('click')).not.toThrow()
    await nextTick()

    wrapper.unmount()
  })

  it('正常子组件不误伤：不显示降级卡', async () => {
    const router = makeRouter()
    const wrapper = mount(defineComponent({
      setup: () => () => h(ErrorBoundary, null, { default: () => h(Good) }),
    }), { global: { plugins: [router] }, attachTo: document.body })

    await nextTick()
    await nextTick()

    expect(wrapper.find('.good-child').exists(), '正常内容应原样渲染').toBe(true)
    expect(wrapper.text()).not.toContain('这一页显示出错了')

    wrapper.unmount()
  })
})
