/**
 * 导出知识库给外部 Agent / RAG 摄取。
 *
 * 运行：npm run kb:export
 * 产物：public/knowledge/kb.json（页面运行时也可直接 fetch /knowledge/kb.json）
 *
 * 输出为确定性数据 + generatedAt 时间戳；条目 id 稳定，见 src/utils/knowledge.ts 顶部契约。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { CityRule } from '../src/types'
import { buildKbPayload } from '../src/utils/knowledge'
import { CITY_REGISTRY } from '../src/data/cities'

// 从注册表读取全部城市，避免新增城市时漏导出（此前硬编码 3 城）
const CITIES = CITY_REGISTRY.map(c => c.value)
const OUT = 'public/knowledge/kb.json'

const rules = CITIES.map(c => JSON.parse(readFileSync(`public/rules/${c}.json`, 'utf8')) as CityRule)
const payload = buildKbPayload(rules, new Date().toISOString())

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8')

const total = payload.entries.length
console.log(`kb:export 完成 — ${OUT}`)
console.log(`  条目总数 ${total}（policy ${payload.counts.policy} / guide ${payload.counts.guide} / reality ${payload.counts.reality} / source ${payload.counts.source}）`)
