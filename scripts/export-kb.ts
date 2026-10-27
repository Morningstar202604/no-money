/**
 * 导出知识库给外部 Agent / RAG 摄取。
 *
 * 运行：
 *   npm run kb:export           生成 public/knowledge/kb.json
 *   npm run kb:check            只校验产物是否与源码同步（CI / pre-commit 用），不写文件
 *
 * 产物：public/knowledge/kb.json（页面运行时也可直接 fetch /knowledge/kb.json）
 * 输出为确定性数据 + generatedAt 时间戳；条目 id 稳定，见 src/utils/knowledge.ts 顶部契约。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import type { CityRule } from '../src/types'
import { buildKbPayload } from '../src/utils/knowledge'
import { CITY_REGISTRY } from '../src/data/cities'

// 从注册表读取全部城市，避免新增城市时漏导出（此前硬编码 3 城）
const CITIES = CITY_REGISTRY.map(c => c.value)
const OUT = 'public/knowledge/kb.json'
const checkOnly = process.argv.includes('--check')

const rules = CITIES.map(c => JSON.parse(readFileSync(`public/rules/${c}.json`, 'utf8')) as CityRule)

if (checkOnly) {
  // 比对时沿用产物里的 generatedAt，避免时间戳造成假失败
  if (!existsSync(OUT)) {
    console.error(`kb:check 失败 — ${OUT} 不存在，请运行 npm run kb:export`)
    process.exitCode = 1
  } else {
    const current = JSON.parse(readFileSync(OUT, 'utf8')) as { generatedAt: string; entries: unknown[] }
    const fresh = buildKbPayload(rules, current.generatedAt)
    if (JSON.stringify(current.entries) !== JSON.stringify(fresh.entries)) {
      console.error('kb:check 失败 — kb.json 与数据源不同步，请运行 npm run kb:export 并提交')
      process.exitCode = 1
    } else {
      console.log(`kb:check 通过 — ${current.entries.length} 条与数据源一致`)
    }
  }
} else {
  const payload = buildKbPayload(rules, new Date().toISOString())
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  console.log(`kb:export 完成 — ${OUT}`)
  console.log(`  条目总数 ${payload.entries.length}（policy ${payload.counts.policy} / guide ${payload.counts.guide} / reality ${payload.counts.reality} / source ${payload.counts.source}）`)
}
