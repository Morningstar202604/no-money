// @vitest-environment happy-dom
/**
 * 向导的真实交互：城市 → 身份 → 要办的事 → 3–7 条清单。
 * 这里挂载真实组件，不读源码文本；文案与按钮顺序都按用户路径断言。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RightsWizard from '../src/components/RightsWizard.vue'
import { useRightsChecklistStore } from '../src/stores/rightsChecklist'

function mountWizard() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(RightsWizard, { global: { plugins: [pinia] }, attachTo: document.body })
}

function clickButton(wrapper: ReturnType<typeof mountWizard>, label: string) {
  const btn = wrapper.findAll('button').find((b) => b.text().includes(label))
  expect(btn, `找不到按钮「${label}」`).toBeTruthy()
  return btn!.trigger('click')
}

beforeEach(() => {
  localStorage.clear()
})

describe('三步办事向导', () => {
  it('首步只问城市，并明确不注册、不填敏感信息', async () => {
    const wrapper = mountWizard()
    await wrapper.vm.$nextTick()
    const text = wrapper.text()
    expect(text).toContain('3 步向导')
    expect(text).toContain('不注册')
    expect(text).toContain('你在哪个城市工作 / 参保')
    expect(text).toContain('不填身份证、不填工资')
    wrapper.unmount()
  })

  it('城市 → 身份 → 情境 → 生成 3–7 条', async () => {
    const wrapper = mountWizard()
    await wrapper.vm.$nextTick()

    await clickButton(wrapper, '下一步')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('企业职工')

    await clickButton(wrapper, '下一步')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('刚入职，先办什么')

    await clickButton(wrapper, '生成我的清单')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('你的清单')
    expect(wrapper.findAll('.right-card').length).toBeGreaterThanOrEqual(3)
    expect(wrapper.findAll('.right-card').length).toBeLessThanOrEqual(7)
    expect(wrapper.text()).toContain('官方入口')
    wrapper.unmount()
  })

  it('常见情况一键直达，不用再走三步', async () => {
    const wrapper = mountWizard()
    await wrapper.vm.$nextTick()

    await clickButton(wrapper, '刚入职')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('你的清单')
    expect(wrapper.text()).toContain('第 1 件 · 先办这个')
    expect(wrapper.findAll('.right-card').length).toBeGreaterThanOrEqual(3)
    expect(wrapper.findAll('.right-card').length).toBeLessThanOrEqual(7)
    wrapper.unmount()
  })

  it('顶部有 7 类模板，点工伤直接出倒计时清单并可批量加入', async () => {
    const wrapper = mountWizard()
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.rw-quick-card')).toHaveLength(7)

    await clickButton(wrapper, '工伤')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.rw-template').text()).toContain('工伤 30 天倒计时')
    expect(wrapper.text()).toContain('单位 30 日')
    expect(wrapper.findAll('.right-card').length).toBeGreaterThanOrEqual(3)

    await clickButton(wrapper, '全部加入我的清单')
    const checklist = useRightsChecklistStore()
    expect(checklist.trackedCount).toBeGreaterThanOrEqual(3)
    expect(wrapper.text()).toContain('已加入我的清单')
    wrapper.unmount()
  })

  it('清单末尾给出算一算、问 AI、查政策三个下一步', async () => {
    const wrapper = mountWizard()
    await wrapper.vm.$nextTick()
    await clickButton(wrapper, '刚入职')
    await wrapper.vm.$nextTick()

    await clickButton(wrapper, '算一算到手多少')
    await clickButton(wrapper, '问 AI 材料/流程')
    await clickButton(wrapper, '查政策原文')

    expect(wrapper.emitted('calc')).toHaveLength(1)
    expect(wrapper.emitted('ask-ai')).toHaveLength(1)
    expect(wrapper.emitted('policy')).toHaveLength(1)
    const prompt = wrapper.emitted('ask-ai')![0][0] as string
    expect(prompt).toContain('广州')
    expect(prompt).toContain('我的清单第 1 件')
    expect(prompt).toContain('不要编')
    wrapper.unmount()
  })

  it('重新选能回到第一步，不把上次城市/身份锁死', async () => {
    const wrapper = mountWizard()
    await wrapper.vm.$nextTick()
    await clickButton(wrapper, '下一步')
    await wrapper.vm.$nextTick()
    await clickButton(wrapper, '下一步')
    await wrapper.vm.$nextTick()
    await clickButton(wrapper, '生成我的清单')
    await wrapper.vm.$nextTick()
    await clickButton(wrapper, '重新选')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('你在哪个城市工作 / 参保')
    wrapper.unmount()
  })
})
