#!/usr/bin/env node
/**
 * 版本号统一升级脚本
 *
 * 版本号散落在三处（package.json / tauri.conf.json / Cargo.toml），
 * 手工改必然漏一处——而 Tauri 会用 tauri.conf.json 的版本打包，
 * package.json 只影响 npm 元数据，两者不一致时安装包版本与 npm 版本会对不上。
 *
 * 用法：
 *   node scripts/bump-version.mjs 2.3.0
 *   node scripts/bump-version.mjs 2.3.0 --dry-run
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const TARGETS = [
  { file: 'package.json', kind: 'json' },
  { file: 'src-tauri/tauri.conf.json', kind: 'json' },
  { file: 'src-tauri/Cargo.toml', kind: 'toml' },
]

const SEMVER = /^\d+\.\d+\.\d+$/

function readJsonVersion(rel) {
  const data = JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))
  return data.version
}

function readTomlVersion(rel) {
  const text = readFileSync(join(ROOT, rel), 'utf8')
  // 只匹配 [package] 段内的 version，避免误伤依赖的 version 字段
  const pkgSection = text.split(/^\[/m).find((s) => s.startsWith('package]'))
  const m = pkgSection?.match(/^version\s*=\s*"([^"]+)"/m)
  return m?.[1]
}

function writeJsonVersion(rel, version) {
  const path = join(ROOT, rel)
  const data = JSON.parse(readFileSync(path, 'utf8'))
  data.version = version
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function writeTomlVersion(rel, version) {
  const path = join(ROOT, rel)
  const text = readFileSync(path, 'utf8')
  // 仅替换第一个 [package] 段内出现的 version 行
  const updated = text.replace(
    /(^\[package\][\s\S]*?^version\s*=\s*)"[^"]+"/m,
    `$1"${version}"`,
  )
  writeFileSync(path, updated, 'utf8')
}

function main() {
  const args = process.argv.slice(2)
  const version = args.find((a) => !a.startsWith('--'))
  const dryRun = args.includes('--dry-run')

  if (!version || !SEMVER.test(version)) {
    console.error('用法: node scripts/bump-version.mjs <MAJOR.MINOR.PATCH> [--dry-run]')
    console.error('示例: node scripts/bump-version.mjs 2.3.0')
    process.exit(1)
  }

  console.log(`目标版本: ${version}${dryRun ? '（演练，不写入）' : ''}\n`)

  // 先读取当前值，全部检查通过后再写入，避免改一半失败留下不一致状态
  const current = TARGETS.map((t) => ({
    ...t,
    before: t.kind === 'json' ? readJsonVersion(t.file) : readTomlVersion(t.file),
  }))

  const missing = current.filter((t) => !t.before)
  if (missing.length) {
    console.error('以下文件未找到 version 字段，已中止：')
    for (const t of missing) console.error(`  - ${t.file}`)
    process.exit(1)
  }

  for (const t of current) {
    console.log(`  ${t.file.padEnd(28)} ${t.before} -> ${version}`)
  }

  if (dryRun) {
    console.log('\n演练结束，未写入任何文件。')
    return
  }

  for (const t of current) {
    if (t.kind === 'json') writeJsonVersion(t.file, version)
    else writeTomlVersion(t.file, version)
  }

  console.log('\n已更新。请同步 CHANGELOG.md 后提交：')
  console.log(`  git commit -am "chore(release): ${version}"`)
  console.log(`  git tag -a v${version} -m "v${version}"`)
}

main()
