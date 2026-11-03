#!/usr/bin/env node
/**
 * no-money CLI
 *
 * 为什么要有 CLI：
 * 1. 批次对比：把 10 个城市一次算完，Web 要切 10 次城市
 * 2. 可脚本化：CI 里做回归断言、把自己的流水算进工资谈判材料
 * 3. 可被 AI agent 调用：MCP server 背后调的就是同一套内核
 *
 * 设计原则：
 * - 复用 src/kernel/calculate.ts，不在 CLI 里重新实现任何公式
 * - 默认输出人类可读表格；--json 输出机器可读，两者字段同源
 * - 退出码：0 成功，1 用法错误，2 计算失败（便于脚本判断）
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { calculate, type CalculateResult, type RuleLoader } from '../src/kernel/calculate.js'
import type { CityRule } from '../src/types/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ---------- 参数解析 ----------
interface CliOptions {
  command: string
  city?: string
  json: boolean
  cities: string[]
  hours?: number
  orders?: number
  days?: number
  distance?: number
  help: boolean
}

const USAGE = `
no-money — 灵活就业收入精算 CLI

用法:
  no-money calc --city <id> [选项]        计算单个城市的净收入
  no-money compare --cities <a,b,c>       横向对比多个城市
  no-money cities                         列出全部可用城市
  no-money check                          自检：核验内核与规则完整性

选项:
  --city <id>        城市 id（如 guangzhou）
  --cities <list>    逗号分隔的城市 id 列表
  --hours <n>        日均工时，默认 10
  --orders <n>       日均接单，默认 35
  --days <n>         月工作天，默认 26
  --distance <n>     平均配送距离(km)，默认 2.5
  --json             输出 JSON（便于脚本处理）
  -h, --help         显示帮助

示例:
  no-money calc --city guangzhou
  no-money calc --city shenzhen --hours 12 --orders 45
  no-money compare --cities guangzhou,shenzhen,dongguan --json
`.trim()

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { command: '', json: false, cities: [], help: false }
  const args = [...argv]

  // 第一个非选项参数是命令
  if (args.length && !args[0].startsWith('-')) {
    opts.command = args.shift()!
  }

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    switch (a) {
      case '--city': opts.city = args[++i]; break
      case '--cities': opts.cities = (args[++i] ?? '').split(',').map(s => s.trim()).filter(Boolean); break
      case '--hours': opts.hours = Number(args[++i]); break
      case '--orders': opts.orders = Number(args[++i]); break
      case '--days': opts.days = Number(args[++i]); break
      case '--distance': opts.distance = Number(args[++i]); break
      case '--json': opts.json = true; break
      case '-h':
      case '--help': opts.help = true; break
      default:
        if (a.startsWith('-')) {
          fail(`未知选项：${a}\n\n${USAGE}`)
        }
    }
  }
  return opts
}

function fail(msg: string): never {
  console.error(msg)
  process.exit(1)
}

// ---------- 规则加载（Node 侧实现） ----------
const rulesDir = join(ROOT, 'public', 'rules')

const nodeRuleLoader: RuleLoader = async (city: string) => {
  const file = join(rulesDir, `${city}.json`)
  if (!existsSync(file)) {
    throw new Error(`未找到城市规则：${city}（可用 no-money cities 查看全部）`)
  }
  return JSON.parse(readFileSync(file, 'utf8')) as CityRule
}

function listCities(): Array<{ id: string; name: string; year: number; verified: boolean }> {
  if (!existsSync(rulesDir)) fail(`规则目录不存在：${rulesDir}`)
  return readdirSync(rulesDir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const rule = JSON.parse(readFileSync(join(rulesDir, f), 'utf8')) as CityRule
      return { id: rule.city, name: rule.cityName, year: rule.year, verified: rule.verified }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

// ---------- 输出格式化 ----------
const money = (n: number) => `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function printResult(r: CalculateResult): void {
  const conf = r.dataConfidence === 'official' ? '已核实' : r.dataConfidence === 'partial' ? '部分待核实' : '未核实'
  const lines = [
    '',
    `  ${r.cityName} · ${r.scenarioName}`,
    `  ${'─'.repeat(46)}`,
    `  月净收入      ${money(r.netMonthly)}`,
    `  年净收入      ${money(r.netAnnual)}`,
    `  有效时薪      ${money(r.netHourly)}/小时`,
    `  ${'─'.repeat(46)}`,
    `  月总收入      ${money(r.grossMonthly)}`,
    `  月总成本      ${money(r.totalCost)}`,
    `  个税(月均)    ${money(r.taxMonthly)}`,
    `  社保(月)      ${money(r.socialInsuranceMonthly)}`,
    `  ${'─'.repeat(46)}`,
    `  权益评分      ${r.rightsScore}/100（${r.rightsLevel}）`,
    `  数据置信度    ${conf}`,
  ]
  if (r.unverifiedFields.length) {
    lines.push(`  未核实字段    ${r.unverifiedFields.join('、')}`)
  }
  if (r.rightsFlags.length) {
    lines.push('', '  风险提示：')
    for (const f of r.rightsFlags) lines.push(`    · ${f}`)
  }
  lines.push('')
  console.log(lines.join('\n'))
}

function printCompare(rows: CalculateResult[]): void {
  const header = ['城市', '月净收入', '有效时薪', '权益评分', '置信度']
  const data = rows.map(r => [
    r.cityName,
    money(r.netMonthly),
    money(r.netHourly),
    `${r.rightsScore}`,
    r.dataConfidence === 'official' ? '已核实' : r.dataConfidence === 'partial' ? '部分' : '未核实',
  ])
  // 简单列宽对齐（中文字符按 2 宽度计）
  const width = (s: string) => [...s].reduce((w, c) => w + (c.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)
  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - width(s)))
  const cols = header.map((h, i) => Math.max(width(h), ...data.map(r => width(r[i]))))

  console.log('')
  console.log('  ' + header.map((h, i) => pad(h, cols[i])).join('  '))
  console.log('  ' + cols.map(c => '─'.repeat(c)).join('  '))
  for (const row of data) {
    console.log('  ' + row.map((c, i) => pad(c, cols[i])).join('  '))
  }
  console.log('')
}

// ---------- 命令实现 ----------
async function cmdCalc(opts: CliOptions): Promise<void> {
  if (!opts.city) fail(`缺少 --city\n\n${USAGE}`)

  const result = await calculate(
    {
      city: opts.city,
      work: {
        dailyHours: opts.hours,
        dailyOrders: opts.orders,
        workDaysMonth: opts.days,
        avgDistance: opts.distance,
      },
    },
    nodeRuleLoader,
  )

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    printResult(result)
  }
}

async function cmdCompare(opts: CliOptions): Promise<void> {
  if (!opts.cities.length) fail(`缺少 --cities\n\n${USAGE}`)

  const results: CalculateResult[] = []
  for (const city of opts.cities) {
    results.push(
      await calculate(
        {
          city,
          work: {
            dailyHours: opts.hours,
            dailyOrders: opts.orders,
            workDaysMonth: opts.days,
            avgDistance: opts.distance,
          },
        },
        nodeRuleLoader,
      ),
    )
  }

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2))
  } else {
    printCompare(results)
  }
}

function cmdCities(opts: CliOptions): void {
  const cities = listCities()
  if (opts.json) {
    console.log(JSON.stringify(cities, null, 2))
    return
  }
  console.log(`\n  共 ${cities.length} 座城市（覆盖 31 个省级行政区）\n`)
  for (const c of cities) {
    console.log(`  ${c.id.padEnd(14)} ${c.name}  ${c.year}版  ${c.verified ? '已核验' : '部分待核实'}`)
  }
  console.log('')
}

async function cmdCheck(): Promise<void> {
  const cities = listCities()
  let pass = 0
  const failures: string[] = []

  for (const c of cities) {
    try {
      const r = await calculate({ city: c.id }, nodeRuleLoader)
      // 基本健全性断言：净收入必须为正且小于总收入
      if (!(r.netMonthly > 0)) throw new Error('净收入非正数')
      if (r.netMonthly > r.grossMonthly) throw new Error('净收入大于总收入')
      if (!Number.isFinite(r.netAnnual)) throw new Error('年净收入非有限数')
      pass++
    } catch (e) {
      failures.push(`${c.id}: ${(e as Error).message}`)
    }
  }

  console.log(`\n  规则自检：${pass}/${cities.length} 通过`)
  if (failures.length) {
    console.log('  失败：')
    for (const f of failures) console.log(`    · ${f}`)
    process.exit(2)
  }
  console.log('  全部城市规则可正常计算。\n')
}

// ---------- 入口 ----------
async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))

  if (opts.help || (!opts.command && !process.argv.slice(2).length)) {
    console.log(USAGE)
    return
  }

  try {
    switch (opts.command) {
      case 'calc': await cmdCalc(opts); break
      case 'compare': await cmdCompare(opts); break
      case 'cities': cmdCities(opts); break
      case 'check': await cmdCheck(); break
      case '': console.log(USAGE); break
      default:
        fail(`未知命令：${opts.command}\n\n${USAGE}`)
    }
  } catch (e) {
    console.error(`\n  错误：${(e as Error).message}\n`)
    process.exit(2)
  }
}

main()
