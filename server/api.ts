#!/usr/bin/env node
/**
 * no-money HTTP API
 *
 * 为什么需要后端：
 * Web / 桌面 / CLI 各自独立，但企业或深度用户需要把自己的流水批量算、
 * 或让内部系统调用。HTTP API 提供这个出口，且**只读**——不存任何用户数据，
 * 服务端无状态，请求结束即遗忘，从架构上避免数据泄露。
 *
 * 技术选型：Node 原生 http，不引入 express/fastify。
 * 理由：本服务只有 6 个路由、零中间件、无鉴权需求（只读计算），
 * 引入一个 web 框架会带来 100+ 依赖和持续的安全补丁负担，收益为负。
 * Node 18+ 的原生 http 足够稳，且零供应链风险。
 *
 * 端点设计遵循 REST + JSON:API 风格：
 *   GET  /health              健康检查（探活用）
 *   GET  /openapi.json        OpenAPI 3.1 规范（供 AI/客户端自动发现）
 *   GET  /api/cities          城市列表
 *   GET  /api/cities/:id      单城市元数据与数据来源
 *   POST /api/calculate       单次测算
 *   POST /api/compare         多城市对比
 *
 * 安全：
 * - 只监听 127.0.0.1（默认），不暴露公网
 * - 请求体上限 64KB，防内存耗尽
 * - 严格 CORS 白名单（默认关闭跨域）
 * - 所有输入经内核校验，不信任任何客户端字段
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { calculate, type CalculateResult, type RuleLoader } from '../src/kernel/calculate.js'
import type { CityRule } from '../src/types/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const rulesDir = join(ROOT, 'public', 'rules')

// 版本从 package.json 读，不硬编码：此前写死 '2.4.0'，
// 项目到 3.1.2 时 /health 还在对外报旧版本。
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }
const APP_VERSION = PKG.version

const PORT = Number(process.env.PORT ?? 8787)
const HOST = process.env.HOST ?? '127.0.0.1'
const MAX_BODY = 64 * 1024

const ruleLoader: RuleLoader = async (city: string) => {
  const file = join(rulesDir, `${city}.json`)
  if (!existsSync(file)) throw new Error(`未收录城市：${city}`)
  return JSON.parse(readFileSync(file, 'utf8')) as CityRule
}

function listCities() {
  return readdirSync(rulesDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const rule = JSON.parse(readFileSync(join(rulesDir, f), 'utf8')) as CityRule
      return { id: rule.city, name: rule.cityName, year: rule.year, verified: rule.verified }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

// ---------- 简单令牌桶限流 ----------
/**
 * 为什么需要：这个服务虽然默认只监听 127.0.0.1，但用户可能用 HOST=0.0.0.0
 * 暴露到局域网或容器里。没有限流时，一个循环请求就能把 CPU 打满——
 * 每次请求都要加载并校验一个城市的规则 JSON。
 *
 * 用固定窗口而非滑动窗口：实现只要十几行、无外部依赖、对"防滥用"这个目标足够。
 * 引入 redis 或 express-rate-limit 会给一个只读小服务背上运维负担。
 */
interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()
const RATE_LIMIT = Number(process.env.RATE_LIMIT ?? 120) // 每分钟每 IP 请求数
const RATE_WINDOW = 60_000

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const bucket = buckets.get(ip)
  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return false
  }
  bucket.count++
  return bucket.count > RATE_LIMIT
}

// 定期清理过期桶，避免长期运行时 Map 无限增长
setInterval(() => {
  const now = Date.now()
  for (const [ip, b] of buckets) {
    if (now > b.resetAt) buckets.delete(ip)
  }
}, 5 * 60_000).unref()

// ---------- HTTP 工具 ----------
function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    // 只读 API 不需要缓存，但允许客户端缓存 60 秒减少重复计算
    'Cache-Control': 'public, max-age=60',
  })
  res.end(payload)
}

function sendError(res: ServerResponse, status: number, message: string, hint?: string): void {
  sendJson(res, status, { error: { status, message, ...(hint ? { hint } : {}) } })
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error(`请求体超过 ${MAX_BODY} 字节上限`))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw.trim()) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('请求体不是合法 JSON'))
      }
    })
    req.on('error', reject)
  })
}

// ---------- OpenAPI 规范 ----------
const OPENAPI = {
  openapi: '3.1.0',
  info: {
    title: 'No Money API',
    version: APP_VERSION,
    description:
      '中国灵活就业者收入 / 个税 / 社保 / 权益测算 API。只读服务，不存储任何用户数据。' +
      '所有结果会标注数据置信度——未核实字段的结论只能视为假设测算。',
    license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
  },
  servers: [{ url: `http://${HOST}:${PORT}`, description: '本地实例' }],
  paths: {
    '/health': {
      get: {
        summary: '健康检查',
        responses: { '200': { description: '服务正常', content: { 'application/json': { schema: { type: 'object' } } } } },
      },
    },
    '/api/cities': {
      get: {
        summary: '城市列表',
        description: '返回全部已收录城市及其规则版本与核验状态',
        responses: { '200': { description: '城市数组', content: { 'application/json': { schema: { type: 'array' } } } } },
      },
    },
    '/api/calculate': {
      post: {
        summary: '单次测算',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['city'],
                properties: {
                  city: { type: 'string', description: '城市 id，如 guangzhou' },
                  dailyHours: { type: 'number', minimum: 1, maximum: 18 },
                  dailyOrders: { type: 'number', minimum: 0, maximum: 100 },
                  workDaysMonth: { type: 'number', minimum: 0, maximum: 31 },
                  avgDistance: { type: 'number', minimum: 0, maximum: 50 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: '测算结果', content: { 'application/json': { schema: { type: 'object' } } } },
          '400': { description: '参数错误' },
          '404': { description: '城市未收录' },
        },
      },
    },
    '/api/compare': {
      post: {
        summary: '多城市对比',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['cities'],
                properties: {
                  cities: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 10 },
                  dailyHours: { type: 'number' },
                  dailyOrders: { type: 'number' },
                },
              },
            },
          },
        },
        responses: { '200': { description: '对比结果' }, '400': { description: '参数错误' } },
      },
    },
  },
} as const

// ---------- 路由 ----------
async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const method = req.method ?? 'GET'

  // 健康检查不参与限流：容器探针每分钟可能请求多次，被限流会导致误判为不健康
  if (path !== '/health') {
    const ip = req.socket.remoteAddress ?? 'unknown'
    if (rateLimited(ip)) {
      res.setHeader('Retry-After', '60')
      return sendError(res, 429, `请求过于频繁，上限 ${RATE_LIMIT} 次/分钟`, '稍后重试')
    }
  }

  // 健康检查：不依赖任何外部资源，供容器探针使用
  if (method === 'GET' && path === '/health') {
    return sendJson(res, 200, {
      status: 'ok',
      version: APP_VERSION,
      cities: listCities().length,
      uptime: Math.round(process.uptime()),
    })
  }

  if (method === 'GET' && path === '/openapi.json') {
    return sendJson(res, 200, OPENAPI)
  }

  if (method === 'GET' && path === '/api/cities') {
    return sendJson(res, 200, listCities())
  }

  const cityMatch = path.match(/^\/api\/cities\/([a-z0-9-]+)$/)
  if (method === 'GET' && cityMatch) {
    const id = cityMatch[1]
    try {
      const rule = await ruleLoader(id)
      return sendJson(res, 200, {
        id: rule.city,
        name: rule.cityName,
        year: rule.year,
        lastCheckedAt: rule.lastCheckedAt,
        verified: rule.verified,
        sources: rule.sources,
      })
    } catch {
      return sendError(res, 404, `未收录城市：${id}`, 'GET /api/cities 查看全部可用 id')
    }
  }

  if (method === 'POST' && path === '/api/calculate') {
    let body: Record<string, unknown>
    try {
      body = (await readBody(req)) as Record<string, unknown>
    } catch (e) {
      return sendError(res, 400, (e as Error).message)
    }

    const city = typeof body.city === 'string' ? body.city : ''
    if (!city) return sendError(res, 400, '缺少必需字段 city', '示例：{"city":"guangzhou"}')

    try {
      const result = await calculate(
        {
          city,
          work: {
            dailyHours: numOrUndef(body.dailyHours),
            dailyOrders: numOrUndef(body.dailyOrders),
            workDaysMonth: numOrUndef(body.workDaysMonth),
            avgDistance: numOrUndef(body.avgDistance),
          },
        },
        ruleLoader,
      )
      return sendJson(res, 200, result)
    } catch (e) {
      const msg = (e as Error).message
      return sendError(res, msg.includes('未收录') ? 404 : 400, msg)
    }
  }

  if (method === 'POST' && path === '/api/compare') {
    let body: Record<string, unknown>
    try {
      body = (await readBody(req)) as Record<string, unknown>
    } catch (e) {
      return sendError(res, 400, (e as Error).message)
    }

    const cities = Array.isArray(body.cities) ? body.cities.filter((c): c is string => typeof c === 'string') : []
    if (cities.length < 2) return sendError(res, 400, 'cities 至少需要 2 个城市 id')
    if (cities.length > 10) return sendError(res, 400, 'cities 最多 10 个')

    try {
      const results: CalculateResult[] = []
      for (const city of cities) {
        results.push(
          await calculate(
            {
              city,
              work: { dailyHours: numOrUndef(body.dailyHours), dailyOrders: numOrUndef(body.dailyOrders) },
            },
            ruleLoader,
          ),
        )
      }
      return sendJson(res, 200, results)
    } catch (e) {
      const msg = (e as Error).message
      return sendError(res, msg.includes('未收录') ? 404 : 400, msg)
    }
  }

  return sendError(res, 404, `未知端点：${method} ${path}`, 'GET /openapi.json 查看全部端点')
}

function numOrUndef(v: unknown): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

const server = createServer((req, res) => {
  handle(req, res).catch((e) => {
    process.stderr.write(`[api] 未捕获错误: ${(e as Error).message}\n`)
    if (!res.headersSent) sendError(res, 500, '服务器内部错误')
  })
})

server.listen(PORT, HOST, () => {
  process.stdout.write(`no-money API listening on http://${HOST}:${PORT}\n`)
  process.stdout.write(`  GET  /health\n`)
  process.stdout.write(`  GET  /openapi.json\n`)
  process.stdout.write(`  GET  /api/cities\n`)
  process.stdout.write(`  POST /api/calculate\n`)
  process.stdout.write(`  POST /api/compare\n`)
})

// 优雅退出：容器/进程管理器发 SIGTERM 时先停止接收新连接
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    process.stdout.write(`\n[api] 收到 ${signal}，正在关闭…\n`)
    server.close(() => process.exit(0))
    // 5 秒后强制退出，避免长连接卡住进程
    setTimeout(() => process.exit(1), 5000).unref()
  })
}
