#!/usr/bin/env node
/**
 * no-money MCP Server
 *
 * 把项目的测算能力暴露成标准 MCP（Model Context Protocol）工具，
 * 任何支持 MCP 的宿主（Claude Desktop / Cursor / Zed / VS Code Copilot 等）
 * 都能直接调用：问一句「广州跑外卖一个月到手多少」，模型就能算出准确数字，
 * 而不是凭训练数据瞎编。
 *
 * 为什么用 MCP 而不是自定义插件协议：
 * MCP 是 Linux Foundation 下、已被主流宿主广泛采纳的开放协议，
 * 基于 JSON-RPC 2.0，工具定义自带 JSON Schema 校验。
 * 自己发明一套协议只会让集成成本变高，用户还得为每个宿主写适配。
 *
 * 传输：stdio（MCP 标准做法，无需端口、无需鉴权、随宿主进程生命周期启停）
 *
 * 使用方法（Claude Desktop 配置示例）：
 *   {
 *     "mcpServers": {
 *       "no-money": {
 *         "command": "node",
 *         "args": ["/path/to/no-money/dist-mcp/index.js"]
 *       }
 *     }
 *   }
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/server'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import * as z from 'zod/v4'
import { calculate, type CalculateResult, type RuleLoader } from '../src/kernel/calculate.js'
import type { CityRule } from '../src/types/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const rulesDir = join(ROOT, 'public', 'rules')

/** Node 侧规则加载：读本地 JSON，不走网络 */
const nodeRuleLoader: RuleLoader = async (city: string) => {
  const file = join(rulesDir, `${city}.json`)
  if (!existsSync(file)) {
    const available = readdirSync(rulesDir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''))
    throw new Error(`未收录城市「${city}」。可用城市：${available.slice(0, 10).join(', ')} 等 ${available.length} 个`)
  }
  return JSON.parse(readFileSync(file, 'utf8')) as CityRule
}

/** 把计算结果转成模型易读的 Markdown */
function resultToText(r: CalculateResult): string {
  const money = (n: number) => `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const conf =
    r.dataConfidence === 'official' ? '已核实官方来源' : r.dataConfidence === 'partial' ? '部分字段待核实' : '未核实（仅作假设测算）'

  const lines = [
    `## ${r.cityName} · ${r.scenarioName}`,
    '',
    `- **月净收入**：${money(r.netMonthly)}`,
    `- **年净收入**：${money(r.netAnnual)}`,
    `- **有效时薪**：${money(r.netHourly)}/小时`,
    `- **月总收入**：${money(r.grossMonthly)}`,
    `- **月总成本**：${money(r.totalCost)}`,
    `- **个税（月均）**：${money(r.taxMonthly)}`,
    `- **社保（月）**：${money(r.socialInsuranceMonthly)}`,
    `- **权益评分**：${r.rightsScore}/100（${r.rightsLevel}）`,
    `- **数据置信度**：${conf}`,
  ]

  if (r.unverifiedFields.length) {
    lines.push('', `> ⚠️ 以下字段尚未回溯官方来源：${r.unverifiedFields.join('、')}。结论应视为假设测算。`)
  }
  if (r.rightsFlags.length) {
    lines.push('', '**风险提示**：')
    for (const f of r.rightsFlags) lines.push(`- ${f}`)
  }
  lines.push('', '---', '说明：这是基于年度汇算口径的测算，不是税务或法律意见。')
  return lines.join('\n')
}

// 版本从 package.json 读，与 API/CLI/Web 保持一致
const PKG_VERSION = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }).version

const server = new McpServer({
  name: 'no-money',
  version: PKG_VERSION,
})

// ---------- Tool 1: 单城市测算 ----------
server.registerTool(
  'calculate_income',
  {
    title: '测算灵活就业净收入',
    description:
      '计算中国灵活就业者（外卖骑手、网约车司机等）在指定城市的月净收入、有效时薪、个税与权益评分。' +
      '覆盖 34 座城市。返回结果会标注哪些字段尚未核实官方来源——这些数字只能当作假设测算。',
    inputSchema: z.object({
      city: z
        .string()
        .min(1)
        .describe('城市 id（拼音，如 guangzhou / shenzhen / beijing）。可用 list_cities 查询全部。'),
      dailyHours: z.number().min(1).max(18).optional().describe('日均工作时长（小时），默认 10'),
      dailyOrders: z.number().min(0).max(100).optional().describe('日均接单量，默认 35'),
      workDaysMonth: z.number().min(0).max(31).optional().describe('每月工作天数，默认 26'),
      avgDistance: z.number().min(0).max(50).optional().describe('平均每单配送距离（公里），默认 2.5'),
      enrolled: z.boolean().optional().describe('是否已参加社保（养老+医疗），默认否'),
    }),
  },
  async (args) => {
    try {
      const result = await calculate(
        {
          city: args.city,
          work: {
            dailyHours: args.dailyHours,
            dailyOrders: args.dailyOrders,
            workDaysMonth: args.workDaysMonth,
            avgDistance: args.avgDistance,
          },
          personal: args.enrolled === undefined ? undefined : { hasSocialInsurance: args.enrolled },
        },
        nodeRuleLoader,
      )
      return { content: [{ type: 'text' as const, text: resultToText(result) }] }
    } catch (e) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: `测算失败：${(e as Error).message}` }],
      }
    }
  },
)

// ---------- Tool 2: 多城市对比 ----------
server.registerTool(
  'compare_cities',
  {
    title: '多城市收入对比',
    description:
      '一次计算多个城市的净收入并横向对比，用于评估「去哪个城市跑更划算」。' +
      '注意：各城市计价单价多为未核实占位值，跨城对比只能看相对量级，不能当作真实收入差异。',
    inputSchema: z.object({
      cities: z.array(z.string().min(1)).min(2).max(10).describe('要对比的城市 id 数组，2-10 个'),
      dailyHours: z.number().min(1).max(18).optional().describe('日均工作时长（小时），默认 10'),
      dailyOrders: z.number().min(0).max(100).optional().describe('日均接单量，默认 35'),
    }),
  },
  async (args) => {
    try {
      const rows: CalculateResult[] = []
      for (const city of args.cities) {
        rows.push(
          await calculate(
            {
              city,
              work: { dailyHours: args.dailyHours, dailyOrders: args.dailyOrders },
            },
            nodeRuleLoader,
          ),
        )
      }

      const money = (n: number) => `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      const lines = [
        '## 多城市收入对比',
        '',
        '| 城市 | 月净收入 | 有效时薪 | 权益评分 | 数据置信度 |',
        '|---|---:|---:|---:|---|',
        ...rows.map(
          (r) =>
            `| ${r.cityName} | ${money(r.netMonthly)} | ${money(r.netHourly)} | ${r.rightsScore} | ${
              r.dataConfidence === 'official' ? '已核实' : r.dataConfidence === 'partial' ? '部分核实' : '未核实'
            } |`,
        ),
        '',
        '> 跨城对比仅供参考：计价单价为平台商业规则，各城市规则文件中的值多为占位假设。',
      ]
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    } catch (e) {
      return { isError: true, content: [{ type: 'text' as const, text: `对比失败：${(e as Error).message}` }] }
    }
  },
)

// ---------- Tool 3: 列出城市 ----------
server.registerTool(
  'list_cities',
  {
    title: '列出可测算城市',
    description: '列出全部已收录的城市及其规则版本、核验状态。用于确认城市 id。',
    inputSchema: z.object({}),
  },
  async () => {
    const cities = readdirSync(rulesDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const rule = JSON.parse(readFileSync(join(rulesDir, f), 'utf8')) as CityRule
        return {
          id: rule.city,
          name: rule.cityName,
          year: rule.year,
          verified: rule.verified,
        }
      })
      .sort((a, b) => a.id.localeCompare(b.id))

    const lines = [
      `## 已收录 ${cities.length} 座城市`,
      '',
      '| id | 城市 | 规则版本 | 核验状态 |',
      '|---|---|---|---|',
      ...cities.map((c) => `| \`${c.id}\` | ${c.name} | ${c.year} | ${c.verified ? '已核验' : '部分待核实'} |`),
    ]
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
  },
)

// ---------- Tool 4: 数据溯源 ----------
server.registerTool(
  'get_data_provenance',
  {
    title: '查询城市数据的来源与置信度',
    description:
      '返回指定城市每个政策参数（社保基数、最低工资、税率等）的置信度等级与来源说明。' +
      '用于判断一个测算结果有多可信。',
    inputSchema: z.object({
      city: z.string().min(1).describe('城市 id'),
    }),
  },
  async (args) => {
    try {
      const rule = await nodeRuleLoader(args.city)
      const rows = Object.entries(rule.sources ?? {}).map(([key, src]) => {
        const s = src as { confidence?: string; title?: string; docNo?: string; url?: string; retrievedAt?: string }
        return {
          field: key,
          confidence: s?.confidence ?? 'unknown',
          title: s?.title ?? '',
          docNo: s?.docNo ?? '',
          url: s?.url ?? '',
          retrievedAt: s?.retrievedAt ?? '',
        }
      })

      const lines = [
        `## ${rule.cityName} · ${rule.year} 版规则来源`,
        '',
        `规则最近核对日期：${rule.lastCheckedAt}`,
        '',
        '| 字段 | 置信度 | 来源 | 文号 |',
        '|---|---|---|---|',
        ...rows.map(
          (r) =>
            `| ${r.field} | ${r.confidence === 'official' ? '✅ 官方' : r.confidence === 'derived' ? '🔶 推算' : '⚠️ 未核实'} | ${
              r.title || '—'
            } | ${r.docNo || '—'} |`,
        ),
      ]
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    } catch (e) {
      return { isError: true, content: [{ type: 'text' as const, text: `查询失败：${(e as Error).message}` }] }
    }
  },
)

// ---------- 启动 ----------
const transport = new StdioServerTransport()
await server.connect(transport)

// stdio 模式下不能往 stdout 打印任何非协议内容，否则会破坏 JSON-RPC 流
process.stderr.write('[no-money] MCP server ready on stdio\n')
