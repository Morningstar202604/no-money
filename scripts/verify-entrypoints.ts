#!/usr/bin/env tsx
/**
 * 入口一致性自检
 *
 * 四个入口共用同一个内核。这个脚本直接调用内核，把结果与固定值对拍，
 * 确保「CLI 说的数」和「Web 显示的数是同一个数」。
 *
 * 为什么单独一个脚本而不放进单测：
 * 它需要读真实规则文件、跑真实计算，是集成级验证；
 * 单测聚焦公式细节，这里是「端到端数字没漂移」的守门员。
 */
import { readFileSync } from 'node:fs'
import { calculate } from '../src/kernel/calculate.js'
import type { CityRule } from '../src/types/index.js'

const loadRule = async (city: string) =>
  JSON.parse(readFileSync(`public/rules/${city}.json`, 'utf8')) as CityRule

/** 固定基准：这些值必须与 Web 端「当前方案」一致，改动公式会在这里立刻暴露 */
const BASELINE: Array<{ city: string; net: number; label: string }> = [
  { city: 'guangzhou', net: 6843.7, label: '广州默认参数' },
  { city: 'shenzhen', net: 7924.77, label: '深圳默认参数' },
]

let failed = 0

for (const b of BASELINE) {
  const r = await calculate({ city: b.city }, loadRule)
  const ok = Math.abs(r.netMonthly - b.net) < 0.01
  console.log(`${ok ? '✓' : '✗'} ${b.label}: 期望 ${b.net}，实际 ${r.netMonthly}`)
  if (!ok) failed++
}

// 全部城市都能算且结果有限
const { readdirSync } = await import('node:fs')
const cities = readdirSync('public/rules').filter((f) => f.endsWith('.json'))
let bad = 0
for (const f of cities) {
  const id = f.replace('.json', '')
  try {
    const r = await calculate({ city: id }, loadRule)
    if (!Number.isFinite(r.netMonthly) || r.netMonthly <= 0) bad++
  } catch {
    bad++
  }
}
console.log(`${bad === 0 ? '✓' : '✗'} ${cities.length} 座城市全部可计算（失败 ${bad}）`)
if (bad > 0) failed++

if (failed > 0) {
  console.error(`\n入口一致性自检失败：${failed} 项`)
  process.exit(1)
}
console.log('\n入口一致性自检通过 — CLI / API / MCP / Web 共用同一内核')
