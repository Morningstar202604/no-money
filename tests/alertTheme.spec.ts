import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8')

describe('告警主题可读性', () => {
  it('四类告警的正文必须用 Naive UI 的 contentTextColor 覆盖为语义 token', () => {
    const app = read('src/App.vue')
    const match = app.match(/Alert:\s*\{[\s\S]*?\n {2}\},/)
    expect(match, 'App.vue 必须定义 Alert 主题覆盖').not.toBeNull()
    const lines = match![0].split('\n')
    for (const cap of ['Info', 'Success', 'Warning', 'Error']) {
      const line = lines.find(l => l.trim().startsWith(`contentTextColor${cap}:`))
      expect(line, `告警缺少 contentTextColor${cap}，正文会回退为深色主题的浅色文字`).toBeTruthy()
      expect(line, `contentTextColor${cap} 必须引用 CSS 变量`).toContain('var(--color-alert-text-')
      const bg = lines.find(l => l.trim() === `color${cap}: 'var(--color-alert-bg-${cap.toLowerCase()})',`)
      expect(bg, `color${cap} 必须使用主题相关的告警背景 token`).toBeTruthy()
    }
  })
})
