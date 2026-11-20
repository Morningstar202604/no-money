/**
 * 34 城数据新鲜度检查。
 *
 * 只读 public/rules/*.json，不改数据、不补数值：
 * - 每个登记城市必须有规则文件；
 * - 每个来源必须有合法 confidence 与可解析的 retrievedAt；
 * - 超过 365 天未复核的来源直接失败，并列出城市 + 字段。
 *
 * 用法：
 *   npm run freshness:check
 *   npm run freshness:check -- --now=2026-11-20
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { CITY_REGISTRY } from '../src/data/cities'
import { summarizeCityFreshness, summarizeSourceFreshness } from '../src/utils/sourceFreshness'
import type { CityRule } from '../src/types'

const ROOT = resolve(import.meta.dirname ?? '.', '..')
const CONFIDENCES = new Set(['official', 'derived', 'unverified'])
const MAX_AGE_DAYS = 365

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length)
}

function main() {
  const nowArg = argValue('now')
  const now = nowArg ? new Date(`${nowArg}T00:00:00Z`) : new Date()
  if (Number.isNaN(now.getTime())) {
    console.error(`--now 不是合法日期：${nowArg}`)
    process.exitCode = 2
    return
  }

  const rules: Record<string, CityRule | null> = {}
  const issues: string[] = []
  const stale: string[] = []

  for (const city of CITY_REGISTRY) {
    const path = join(ROOT, 'public', 'rules', `${city.value}.json`)
    let rule: CityRule
    try {
      rule = JSON.parse(readFileSync(path, 'utf8')) as CityRule
    } catch {
      rules[city.value] = null
      issues.push(`${city.label}（${city.value}）：规则文件缺失或不是合法 JSON`)
      continue
    }
    rules[city.value] = rule

    if (!rule.sources || typeof rule.sources !== 'object') {
      issues.push(`${city.label}（${city.value}）：缺少 sources`)
      continue
    }

    for (const [key, source] of Object.entries(rule.sources)) {
      if (!source || typeof source !== 'object') {
        issues.push(`${city.label} / ${key}：来源不是对象`)
        continue
      }
      if (!CONFIDENCES.has(source.confidence)) {
        issues.push(`${city.label} / ${key}：confidence 非法（${String(source.confidence)}）`)
      }
      if (Number.isNaN(Date.parse(source.retrievedAt))) {
        issues.push(`${city.label} / ${key}：retrievedAt 非法（${source.retrievedAt}）`)
      }
    }

    const summary = summarizeSourceFreshness(rule.sources, now)
    if (summary.staleCount > 0) {
      for (const [key, source] of Object.entries(rule.sources)) {
        const dateMs = Date.parse(source.retrievedAt)
        if (Number.isFinite(dateMs) && dateMs < now.getTime() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
          stale.push(`${city.label} / ${key}：${source.retrievedAt} — ${source.title}`)
        }
      }
    }
  }

  const overview = summarizeCityFreshness(CITY_REGISTRY, rules, now)
  console.log(`数据新鲜度检查 — ${now.toISOString().slice(0, 10)}`)
  console.log(`${overview.loaded} / ${CITY_REGISTRY.length} 城 · ${overview.totals.total} 项参数：` +
    `官方 ${overview.totals.official} / 推算 ${overview.totals.derived} / 待核验 ${overview.totals.unverified} / ` +
    `超 ${MAX_AGE_DAYS} 天 ${overview.totals.staleCount}`)

  const PRINT_LIMIT = 20
  if (issues.length) {
    console.error(`\n✗ 发现 ${issues.length} 个结构问题：`)
    for (const issue of issues.slice(0, PRINT_LIMIT)) console.error(`- ${issue}`)
    if (issues.length > PRINT_LIMIT) console.error(`- …还有 ${issues.length - PRINT_LIMIT} 条，见对应规则文件`)
  }
  if (stale.length) {
    console.error(`\n✗ 发现 ${stale.length} 个超过 ${MAX_AGE_DAYS} 天未复核的来源：`)
    for (const item of stale.slice(0, PRINT_LIMIT)) console.error(`- ${item}`)
    if (stale.length > PRINT_LIMIT) console.error(`- …还有 ${stale.length - PRINT_LIMIT} 条，见对应规则文件`)
  }
  if (issues.length || stale.length || overview.missing.length) {
    process.exitCode = 1
    return
  }

  console.log(`\n✓ 通过：${CITY_REGISTRY.length} 城规则齐全、日期合法、无超过 ${MAX_AGE_DAYS} 天的来源`)
}

main()
