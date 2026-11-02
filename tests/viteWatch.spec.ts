import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const config = readFileSync('vite.config.ts', 'utf8')

describe('开发服务器监听范围', () => {
  it('必须忽略 Rust 构建产物，否则桌面构建后 dev 服务器会因 EBUSY 退出', () => {
    const server = config.match(/server:\s*\{[\s\S]*?\n {2}\},/)
    expect(server, 'vite.config.ts 必须定义 server 段').not.toBeNull()
    expect(server![0], '需配置 server.watch.ignored').toMatch(/watch:\s*\{[\s\S]*ignored/)
    expect(server![0], 'src-tauri 构建产物必须被排除').toContain('src-tauri')
  })
})
