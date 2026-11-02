import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const src = readFileSync('src/components/ChatAssistant.vue', 'utf8')

describe('AI 助手面板响应式边界', () => {
  it('固定宽度面板必须在窄屏收窄，避免左边缘越出视口', () => {
    const block = src.match(/\.chat-panel\s*\{[\s\S]*?\n\}/)
    expect(block, '.chat-panel 样式必须存在').not.toBeNull()
    expect(block![0], '360px 固定宽在 320px 视口会越界').toMatch(
      /width:\s*min\(360px,\s*calc\(100vw - 32px\)\)/,
    )
  })
})
