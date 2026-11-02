import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const layout = readFileSync('src/layouts/MainLayout.vue', 'utf8')

describe('全局提示不得遮挡正文', () => {
  it('.global-alert 必须处于正常文档流，不能 fixed 浮在页面内容上', () => {
    const block = layout.match(/\.global-alert\s*\{[\s\S]*?\n\}/)
    expect(block, '.global-alert 样式必须存在').not.toBeNull()
    expect(block![0], '固定定位会让提示覆盖首屏内容').not.toMatch(/position:\s*fixed/)
  })

  it('规则版本提示使用信息语义色，而不是报错红色', () => {
    expect(layout, '规则提示应带 info 类').toMatch(/class="global-alert info"\s+role="status"/)
    expect(layout, 'info 提示必须有独立配色').toMatch(/\.global-alert\.info\s*\{[\s\S]*?--color-alert-bg-info/)
  })
})
