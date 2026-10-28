// @vitest-environment happy-dom
/**
 * 维权页签生命周期回归。
 *
 * 修复前：三个 n-tab-pane 用默认 display-directive="if"，切走即卸载；
 * 补偿面板重新挂载会把 store.compensation 置空，于是「算补偿 → 看指南 → 写文书」
 * 这条主链在中间切一次页签就断掉（文书金额全空）。
 * 这里直接断言页签配置，防止有人把 display-directive 改回去。
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const view = readFileSync('src/views/RightsView.vue', 'utf8')

describe('维权页签：跨页签状态不得被卸载清空', () => {
  it('n-tabs 必须使用 show:lazy（首挂后常驻），不得使用默认 if', () => {
    expect(view).toMatch(/display-directive="show:lazy"/)
    expect(view).not.toMatch(/display-directive="if"/)
  })

  it('补偿/指南/文书三个面板都挂了 display-directive 的父级 tabs', () => {
    for (const tab of ['compensation', 'guide', 'document']) {
      expect(view, `缺少页签 ${tab}`).toContain(`name="${tab}"`)
    }
  })
})
