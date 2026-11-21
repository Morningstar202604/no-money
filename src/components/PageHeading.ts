/**
 * 页面级标题（视觉隐藏）
 *
 * 为什么需要它：
 * 页面标题都做成了卡片内的 div/span，DOM 里一个 <h1> 都没有。
 * 视觉上没问题，但屏幕阅读器用户按 H 键跳标题时会发现整站零标题——
 * 他们无法判断「现在在哪一页」，只能从头逐字听。
 *
 * 这里用 sr-only 的方式补一个 h1：视觉零影响，语义完整。
 * 不改动视觉设计的原因是：页面里已经有足够强的视觉层级（侧边栏 + 卡片标题），
 * 再加一个显眼的大标题反而破坏现有节奏。
 *
 * 标题文案不在这里维护：路由 meta.title 与这里共用 src/app/pageTitles.ts。
 */
import type { Component } from 'vue'
import { defineComponent, h } from 'vue'
import { PAGE_TITLES, type PageKey } from '../app/pageTitles'

/**
 * 生成一个渲染为 sr-only h1 的组件。
 * 用法：在页面模板根节点内放 <PageHeading />，并在 setup 里注册。
 */
export function createPageHeading(key: PageKey): Component {
  return defineComponent({
    name: 'PageHeading',
    setup() {
      return () => h('h1', { class: 'sr-only' }, PAGE_TITLES[key])
    },
  })
}
