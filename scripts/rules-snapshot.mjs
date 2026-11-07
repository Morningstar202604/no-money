#!/usr/bin/env node
/**
 * 规则数据快照与回滚工具（数据可信度切片 P2）。
 *
 * 背景：public/rules/*.json 是 34 城计价/税/社保规则的唯一事实源。
 * 在手工核验或批量更新城市参数前，需要能对当前数据做快照；
 * 更新引入错误时能按城回滚到快照版本。此前仓库没有任何快照/回滚手段，
 * 规则数据被改坏只能靠 git 历史人工翻找。
 *
 * 用法：
 *   npm run rules:snapshot                    # 快照当前规则 + 生成 manifest 与 latest 指针
 *   npm run rules:verify                      # 当前规则 vs 最新快照，有漂移退出码 1
 *   npm run rules:rollback -- guangzhou       # 单城回滚（需 --yes 确认）
 *   node scripts/rules-snapshot.mjs rollback all --yes
 *
 * 快照目录 .rules-snapshots/ 属本地工具状态，已加入 .gitignore；
 * 真正的长期事实源仍是 git 历史，本工具服务"更新前的本地安全点"场景。
 *
 * 测试钩子：NOMONEY_RULES_ROOT 可覆盖仓库根目录（tests/rulesSnapshot.spec.ts 使用）。
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.env.NOMONEY_RULES_ROOT
  ? join(process.env.NOMONEY_RULES_ROOT)
  : join(dirname(fileURLToPath(import.meta.url)), '..')
const RULES_DIR = join(ROOT, 'public', 'rules')
const SNAP_ROOT = join(ROOT, '.rules-snapshots')

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const listRuleFiles = () => readdirSync(RULES_DIR).filter((f) => f.endsWith('.json')).sort()

function fail(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

function latestSnapDir() {
  const pointerPath = join(SNAP_ROOT, 'latest.json')
  if (!existsSync(pointerPath)) fail('没有快照。先运行：npm run rules:snapshot')
  try {
    const pointer = JSON.parse(readFileSync(pointerPath, 'utf8'))
    const dir = join(SNAP_ROOT, pointer.dir)
    if (!existsSync(join(dir, 'manifest.json'))) fail(`latest 指针指向的快照不存在或已损坏：${pointer.dir}`)
    return dir
  } catch {
    fail('latest 指针无法解析，请重新运行 npm run rules:snapshot')
  }
}

function cmdSnapshot() {
  if (!existsSync(RULES_DIR)) fail(`规则目录不存在：${RULES_DIR}`)
  const files = listRuleFiles()
  if (!files.length) fail('规则目录下没有 .json 文件')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = join(SNAP_ROOT, stamp)
  mkdirSync(dir, { recursive: true })
  const hashes = {}
  for (const f of files) {
    copyFileSync(join(RULES_DIR, f), join(dir, f))
    hashes[f] = sha256(readFileSync(join(RULES_DIR, f)))
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), files: hashes }, null, 2))
  writeFileSync(join(SNAP_ROOT, 'latest.json'), JSON.stringify({ dir: stamp, createdAt: new Date().toISOString(), count: files.length }, null, 2))
  console.log(`✓ 已快照 ${files.length} 个规则文件 → .rules-snapshots/${stamp}`)
}

function cmdVerify(snapDir) {
  const manifest = JSON.parse(readFileSync(join(snapDir, 'manifest.json'), 'utf8'))
  const manifestFiles = Object.keys(manifest.files)
  const currentFiles = existsSync(RULES_DIR) ? listRuleFiles() : []
  let changed = 0
  let missing = 0
  for (const f of manifestFiles) {
    const cur = join(RULES_DIR, f)
    if (!existsSync(cur)) {
      console.log(`  MISSING  ${f}`)
      missing++
      continue
    }
    if (sha256(readFileSync(cur)) !== manifest.files[f]) {
      console.log(`  CHANGED  ${f}`)
      changed++
    }
  }
  const added = currentFiles.filter((f) => !manifestFiles.includes(f))
  for (const f of added) console.log(`  ADDED    ${f}`)
  if (changed || missing || added.length) {
    fail(`与快照存在漂移：${changed} 改动 / ${missing} 缺失 / ${added.length} 新增（快照：${snapDir}）`)
  }
  console.log(`✓ 当前 ${manifestFiles.length} 个规则文件与快照一致`)
}

function cmdRollback(target, snapDir, yes) {
  if (!yes) {
    fail('回滚会覆盖当前规则数据。确认请加 --yes，例如：npm run rules:rollback -- guangzhou --yes')
  }
  const manifest = JSON.parse(readFileSync(join(snapDir, 'manifest.json'), 'utf8'))
  let targets
  if (target === 'all') {
    targets = Object.keys(manifest.files)
  } else {
    const file = target.endsWith('.json') ? target : `${target}.json`
    if (!(file in manifest.files)) fail(`快照中没有该城：${file}`)
    targets = [file]
  }
  let restored = 0
  let skipped = 0
  for (const f of targets) {
    const cur = join(RULES_DIR, f)
    const src = join(snapDir, f)
    if (!existsSync(src)) {
      console.log(`  SKIP（快照缺文件）  ${f}`)
      skipped++
      continue
    }
    if (existsSync(cur) && sha256(readFileSync(cur)) === manifest.files[f]) {
      skipped++
      continue
    }
    copyFileSync(src, cur)
    if (sha256(readFileSync(cur)) !== manifest.files[f]) fail(`回滚后校验失败：${f}`)
    console.log(`  RESTORED ${f}`)
    restored++
  }
  console.log(`✓ 回滚完成：${restored} 恢复 / ${skipped} 跳过（与快照一致或缺文件）`)
}

const [, , cmd, target, ...flags] = process.argv
const yes = flags.includes('--yes')
const snapIdx = flags.indexOf('--snap')
// latest 指针只在 verify/rollback 需要；snapshot 前当然没有快照，不能在顶层急切解析
const resolveSnapDir = () => (snapIdx >= 0 ? join(SNAP_ROOT, flags[snapIdx + 1]) : latestSnapDir())

if (cmd === 'snapshot') cmdSnapshot()
else if (cmd === 'verify') cmdVerify(resolveSnapDir())
else if (cmd === 'rollback') cmdRollback(target ?? 'all', resolveSnapDir(), yes)
else {
  console.log('用法：node scripts/rules-snapshot.mjs <snapshot|verify|rollback <city|all>> [--snap <dir>] [--yes]')
  process.exit(cmd ? 1 : 0)
}
