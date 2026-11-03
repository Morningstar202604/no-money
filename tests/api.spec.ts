// HTTP API 契约测试
//
// 这些测试启动真实 HTTP 服务并发真实请求，不是 mock。
// 理由：API 的价值就在于「外部能连上并拿到正确 JSON」，
// 用 mock 测出来的绿色对用户没有任何意义。
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 18787
const BASE = `http://127.0.0.1:${PORT}`

let proc: ChildProcess

beforeAll(async () => {
  proc = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server/api.ts'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  // 等端口就绪（最多 20 秒）
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/health`)
      if (res.ok) return
    } catch {
      /* 还没起来 */
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('API 未在 20 秒内就绪')
}, 30000)

afterAll(() => {
  proc?.kill()
})

describe('HTTP API', () => {
  it('GET /health 返回 ok 与城市数', async () => {
    const res = await fetch(`${BASE}/health`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.cities).toBe(34)
  })

  it('GET /openapi.json 是合法 OpenAPI 3.1 文档', async () => {
    const res = await fetch(`${BASE}/openapi.json`)
    const spec = await res.json()
    expect(spec.openapi).toBe('3.1.0')
    expect(Object.keys(spec.paths)).toContain('/api/calculate')
  })

  it('GET /api/cities 返回 34 个城市', async () => {
    const res = await fetch(`${BASE}/api/cities`)
    const cities = await res.json()
    expect(cities).toHaveLength(34)
    expect(cities[0]).toHaveProperty('id')
    expect(cities[0]).toHaveProperty('name')
  })

  it('POST /api/calculate 返回与内核一致的数字', async () => {
    const res = await fetch(`${BASE}/api/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: 'guangzhou' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cityName).toBe('广州')
    // 与 kernel.spec.ts 中的快照值必须相同
    expect(body.netMonthly).toBe(6843.7)
  })

  it('POST /api/calculate 缺少 city 时返回 400 并给出示例', async () => {
    const res = await fetch(`${BASE}/api/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toContain('city')
  })

  it('未收录城市返回 404 而不是 500', async () => {
    const res = await fetch(`${BASE}/api/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: 'atlantis' }),
    })
    expect(res.status).toBe(404)
  })

  it('非法 JSON 返回 400 而不是崩溃', async () => {
    const res = await fetch(`${BASE}/api/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    })
    expect(res.status).toBe(400)
  })

  it('POST /api/compare 返回多个城市且按输入顺序', async () => {
    const res = await fetch(`${BASE}/api/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cities: ['guangzhou', 'shenzhen'] }),
    })
    const body = await res.json()
    expect(body.map((r: { city: string }) => r.city)).toEqual(['guangzhou', 'shenzhen'])
  })

  it('compare 少于 2 个城市返回 400', async () => {
    const res = await fetch(`${BASE}/api/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cities: ['guangzhou'] }),
    })
    expect(res.status).toBe(400)
  })

  it('未知端点返回 404 并指向 OpenAPI', async () => {
    const res = await fetch(`${BASE}/api/nonexistent`)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.hint).toContain('openapi.json')
  })

  it('限流生效：超过配额后返回 429', async () => {
    // 用独立实例（低配额）避免影响其它用例
    const limitedPort = 18788
    const limited = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server/api.ts'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(limitedPort), RATE_LIMIT: '5' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    try {
      const base = `http://127.0.0.1:${limitedPort}`
      const deadline = Date.now() + 20000
      while (Date.now() < deadline) {
        try {
          if ((await fetch(`${base}/health`)).ok) break
        } catch { /* 未就绪 */ }
        await new Promise((r) => setTimeout(r, 200))
      }

      // 前 5 次应通过
      for (let i = 0; i < 5; i++) {
        const res = await fetch(`${base}/api/cities`)
        expect(res.status).toBe(200)
      }
      // 第 6 次应被限流
      const blocked = await fetch(`${base}/api/cities`)
      expect(blocked.status).toBe(429)
      expect(blocked.headers.get('Retry-After')).toBeTruthy()

      // 健康检查不受限流影响（容器探针依赖它）
      const health = await fetch(`${base}/health`)
      expect(health.status).toBe(200)
    } finally {
      limited.kill()
    }
  }, 40000)

  it('超大请求体被拒绝，不拖垮进程', async () => {
    const huge = JSON.stringify({ city: 'guangzhou', pad: 'x'.repeat(100_000) })
    const res = await fetch(`${BASE}/api/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: huge,
    }).catch(() => null)
    // 服务端会直接断开连接，客户端可能拿到 400 或连接错误，两者都说明防护生效
    if (res) expect([400, 413]).toContain(res.status)

    // 进程必须仍然存活
    const health = await fetch(`${BASE}/health`)
    expect(health.status).toBe(200)
  })
})
