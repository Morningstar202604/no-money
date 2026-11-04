#!/usr/bin/env node
/**
 * 生成第三方依赖许可声明
 *
 * 为什么要自动生成而不是手写：
 * 手写的清单一定会和 package.json 漂移——加了依赖忘了写，或删了依赖还留着。
 * 这份文件用于合规审计，错了比没有更糟。
 *
 * 只统计生产依赖（devDependencies 不进分发包），
 * 从各包的 package.json 读 license 字段，读不到的标 UNKNOWN 让人能发现。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

const deps = Object.keys(pkg.dependencies ?? {})
const rows = []

for (const name of deps) {
  const p = join(ROOT, 'node_modules', name, 'package.json')
  if (!existsSync(p)) {
    rows.push({ name, version: '?', license: 'UNKNOWN', author: '' })
    continue
  }
  const m = JSON.parse(readFileSync(p, 'utf8'))
  rows.push({
    name,
    version: m.version ?? '?',
    license: typeof m.license === 'string' ? m.license : m.licenses?.[0]?.type ?? 'UNKNOWN',
    author: typeof m.author === 'string' ? m.author : m.author?.name ?? '',
  })
}

rows.sort((a, b) => a.name.localeCompare(b.name))

// 汇总许可类型分布
const counts = {}
for (const r of rows) counts[r.license] = (counts[r.license] ?? 0) + 1

const lines = [
  '# 第三方许可声明',
  '',
  '本应用在生产构建中包含以下开源依赖。每个依赖的完整许可文本位于',
  '`node_modules/<包名>/LICENSE`，或该包的代码仓库。',
  '',
  `生成时间：${new Date().toISOString().slice(0, 10)}`,
  `生产依赖总数：${rows.length}`,
  '',
  '## 许可类型分布',
  '',
  '| 许可 | 数量 |',
  '|---|---:|',
  ...Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([l, c]) => `| ${l} | ${c} |`),
  '',
  '## 依赖清单',
  '',
  '| 包 | 版本 | 许可 |',
  '|---|---|---|',
  ...rows.map((r) => `| \`${r.name}\` | ${r.version} | ${r.license} |`),
  '',
  '## 需要说明的许可',
  '',
]

const mit = rows.filter((r) => /MIT/i.test(r.license))
if (mit.length) {
  lines.push(`**MIT（${mit.length} 个）**：允许商用、修改、分发，需保留版权声明。与本项目许可一致。`)
}

const apache = rows.filter((r) => /Apache/i.test(r.license))
if (apache.length) {
  lines.push(`**Apache-2.0（${apache.length} 个）**：允许商用，需保留 NOTICE 文件与专利授权条款。`)
  for (const r of apache) lines.push(`- \`${r.name}\` — 完整文本见 \`node_modules/${r.name}/LICENSE\``)
}

const other = rows.filter((r) => !/MIT|Apache/i.test(r.license))
if (other.length) {
  lines.push(`**其他（${other.length} 个）**：`)
  for (const r of other) lines.push(`- \`${r.name}\` — ${r.license}`)
}

lines.push(
  '',
  '## 本项目许可',
  '',
  '本项目以 MIT 许可发布，见 [LICENSE](LICENSE)。',
  '',
  '## 如何验证这份清单',
  '',
  '```bash',
  'node scripts/gen-licenses.mjs --check   # 与当前依赖比对，不一致则退出码 1',
  '```',
)

const content = lines.join('\n') + '\n'
const outPath = join(ROOT, 'THIRD-PARTY-NOTICES.md')

if (process.argv.includes('--check')) {
  const current = existsSync(outPath) ? readFileSync(outPath, 'utf8') : ''
  // 只比对依赖表部分，忽略"生成时间"这类每次都会变的行
  const stripDate = (s) => s.replace(/生成时间：.*\n/, '')
  if (stripDate(current) !== stripDate(content)) {
    console.error('THIRD-PARTY-NOTICES.md 与当前依赖不一致，请运行 node scripts/gen-licenses.mjs')
    process.exit(1)
  }
  console.log('第三方许可声明与当前依赖一致')
} else {
  writeFileSync(outPath, content, 'utf8')
  console.log(`已生成 THIRD-PARTY-NOTICES.md（${rows.length} 个生产依赖）`)
  for (const [l, c] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${l}: ${c}`)
  }
}
