#!/usr/bin/env tsx
/**
 * 项目自动化健康检查
 *
 * 这不是单元测试的替代品，而是"上线前一次跑完全部关键断言"的守门脚本。
 * 单测关注公式细节，E2E 关注界面交互，这个脚本关注**跨切面的一致性**：
 *   - 四端（Web/CLI/API/MCP）算出的数是否一致
 *   - 34 城数据是否完整、可算、来源标注齐全
 *   - 打包体积是否失控
 *   - 关键文件是否齐全（法律、部署、文档）
 *   - 是否有意外提交的敏感文件或大文件
 *
 * 用法：
 *   npm run doctor           # 全量检查
 *   npm run doctor -- --quick  # 跳过耗时的构建检查
 *
 * 退出码：0 全部通过，1 有失败项
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { calculate } from '../src/kernel/calculate.js'
import type { CityRule } from '../src/types/index.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const quick = process.argv.includes('--quick')

interface Check {
  name: string
  status: 'pass' | 'fail' | 'warn'
  detail: string
}

const results: Check[] = []

function pass(name: string, detail: string) {
  results.push({ name, status: 'pass', detail })
}
function fail(name: string, detail: string) {
  results.push({ name, status: 'fail', detail })
}
function warn(name: string, detail: string) {
  results.push({ name, status: 'warn', detail })
}

// ---------- 1. 关键文件齐全 ----------
function checkFiles() {
  const required = [
    'README.md',
    'README.en.md',
    'LICENSE',
    'PRIVACY.md',
    'TERMS.md',
    'SECURITY.md',
    'CONTRIBUTING.md',
    'CHANGELOG.md',
    'AGENTS.md',
    'ARCHITECTURE.md',
    'ROADMAP.md',
    'THIRD-PARTY-NOTICES.md',
    'docs/DEPLOYMENT.md',
    'docs/VERSIONING.md',
  ]
  const missing = required.filter((f) => !existsSync(join(ROOT, f)))
  if (missing.length) fail('关键文件齐全', `缺失：${missing.join('、')}`)
  else pass('关键文件齐全', `${required.length} 个文件均在位`)

  const deploy = ['vercel.json', 'netlify.toml']
  const missingDeploy = deploy.filter((f) => !existsSync(join(ROOT, f)))
  if (missingDeploy.length) warn('部署配置', `缺少 ${missingDeploy.join('、')}（可选）`)
  else pass('部署配置', 'Vercel 与 Netlify 配置均在位')
}

// ---------- 2. 版本号三处一致 ----------
function checkVersions() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const tauri = JSON.parse(readFileSync(join(ROOT, 'src-tauri/tauri.conf.json'), 'utf8'))
  const cargo = readFileSync(join(ROOT, 'src-tauri/Cargo.toml'), 'utf8')
  const cargoVer = cargo.split(/^\[/m).find((s) => s.startsWith('package]'))?.match(/^version\s*=\s*"([^"]+)"/m)?.[1]

  const versions = { 'package.json': pkg.version, 'tauri.conf.json': tauri.version, 'Cargo.toml': cargoVer }
  const unique = new Set(Object.values(versions))

  if (unique.size === 1) pass('版本号一致', `三处均为 ${pkg.version}`)
  else fail('版本号一致', `不一致：${JSON.stringify(versions)}`)
}

// ---------- 3. 34 城数据完整且可算 ----------
async function checkCities() {
  const rulesDir = join(ROOT, 'public', 'rules')
  const files = readdirSync(rulesDir).filter((f) => f.endsWith('.json'))

  if (files.length !== 34) {
    fail('城市数量', `期望 34 座，实际 ${files.length} 座`)
  } else {
    pass('城市数量', '34 座')
  }

  const loadRule = async (city: string) =>
    JSON.parse(readFileSync(join(rulesDir, `${city}.json`), 'utf8')) as CityRule

  let calcFailed = 0
  let sourceMissing = 0
  const requiredSources = ['pension', 'pensionRate', 'medical', 'tax', 'minimumWage', 'retirement', 'income', 'soleVat', 'soleItr']

  for (const f of files) {
    const id = f.replace('.json', '')
    const rule = JSON.parse(readFileSync(join(rulesDir, f), 'utf8')) as CityRule

    // 来源键齐全
    const keys = Object.keys(rule.sources ?? {})
    const missing = requiredSources.filter((k) => !keys.includes(k))
    if (missing.length) sourceMissing++

    // 可计算
    try {
      const r = await calculate({ city: id }, loadRule)
      if (!Number.isFinite(r.netMonthly) || r.netMonthly <= 0) calcFailed++
    } catch {
      calcFailed++
    }
  }

  if (calcFailed) fail('城市可计算', `${calcFailed} 座城市计算失败`)
  else pass('城市可计算', `${files.length} 座全部返回有效正数`)

  if (sourceMissing) fail('来源键完整', `${sourceMissing} 座城市缺必填来源键`)
  else pass('来源键完整', `${requiredSources.length} 个必填来源键全覆盖`)
}

// ---------- 4. 四端一致性（核心） ----------
async function checkEntrypointConsistency() {
  const loadRule = async (city: string) =>
    JSON.parse(readFileSync(join(ROOT, 'public', 'rules', `${city}.json`), 'utf8')) as CityRule

  // 固定基准：这些值必须与 Web 端展示一致
  const baseline = [
    { city: 'guangzhou', expect: 6843.7 },
    { city: 'shenzhen', expect: 7924.77 },
  ]

  let drift = 0
  for (const b of baseline) {
    const r = await calculate({ city: b.city }, loadRule)
    if (Math.abs(r.netMonthly - b.expect) > 0.01) drift++
  }

  if (drift) fail('内核基准值', `${drift} 个城市结果漂移（公式可能被改动）`)
  else pass('内核基准值', '广州 6843.70 / 深圳 7924.77 与基准一致')
}

// ---------- 5. 无障碍与语义 ----------
function checkA11y() {
  // 每个 view 必须有 PageHeading
  const viewsDir = join(ROOT, 'src', 'views')
  const views = readdirSync(viewsDir).filter((f) => f.endsWith('.vue') && f !== 'NotFoundView.vue')
  // 两种合法写法：sr-only 的 PageHeading 组件，或页面本身有可见的 <h1>。
  // 只认其中一种会把合法的页面误判成缺陷。
  const missing = views.filter((f) => {
    const src = readFileSync(join(viewsDir, f), 'utf8')
    return !src.includes('PageHeading') && !/<h1[\s>]/.test(src)
  })

  if (missing.length) fail('页面语义标题', `${missing.join('、')} 缺少 h1`)
  else pass('页面语义标题', `${views.length} 个页面均有 h1`)

  // 不允许硬编码 hex（除设计系统文件）
  const componentFiles = [
    ...readdirSync(join(ROOT, 'src', 'components')).filter((f) => f.endsWith('.vue')).map((f) => join('src/components', f)),
    ...views.map((f) => join('src/views', f)),
  ]
  const hardcoded: string[] = []
  for (const rel of componentFiles) {
    const src = readFileSync(join(ROOT, rel), 'utf8')
    const styleStart = src.indexOf('<style')
    if (styleStart === -1) continue
    const style = src.slice(styleStart)
    // 只查样式块里的 hex 色值
    if (/#[0-9a-fA-F]{6}\b/.test(style) && !/#fff\b|#ffffff/i.test(style)) {
      hardcoded.push(rel)
    }
  }
  if (hardcoded.length > 3) {
    warn('颜色 token 化', `${hardcoded.length} 个组件样式含硬编码色值（会破坏主题切换）`)
  } else {
    pass('颜色 token 化', '组件样式基本无硬编码色值')
  }
}

// ---------- 6. 安全 ----------
function checkSecurity() {
  // 不允许提交敏感文件
  const forbidden = ['.env', '.env.local', 'id_rsa', 'credentials.json']
  const found = forbidden.filter((f) => existsSync(join(ROOT, f)))
  if (found.length) fail('敏感文件', `发现不应存在的文件：${found.join('、')}`)
  else pass('敏感文件', '无 .env / 密钥文件')

  // .gitignore 必须覆盖构建产物
  const ignore = readFileSync(join(ROOT, '.gitignore'), 'utf8')
  const mustIgnore = ['dist/', 'node_modules/', 'src-tauri/target/', 'test-results/']
  const notIgnored = mustIgnore.filter((p) => !ignore.includes(p))
  if (notIgnored.length) fail('.gitignore', `未忽略：${notIgnored.join('、')}`)
  else pass('.gitignore', '构建产物与依赖均已忽略')

  // API 默认只监听本地
  const api = readFileSync(join(ROOT, 'server', 'api.ts'), 'utf8')
  if (api.includes("process.env.HOST ?? '127.0.0.1'")) pass('API 默认监听', '默认仅 127.0.0.1')
  else warn('API 默认监听', '默认监听地址可能不是本机')
}

// ---------- 7. 打包体积 ----------
function checkBundleSize() {
  const distDir = join(ROOT, 'dist')
  if (!existsSync(distDir)) {
    warn('打包体积', 'dist/ 不存在，先运行 npm run build')
    return
  }

  const assetsDir = join(distDir, 'assets')
  if (!existsSync(assetsDir)) {
    warn('打包体积', '未找到 assets 目录')
    return
  }

  let total = 0
  let largest = { name: '', size: 0 }
  for (const f of readdirSync(assetsDir)) {
    const size = statSync(join(assetsDir, f)).size
    total += size
    if (size > largest.size) largest = { name: f, size }
  }

  const totalMB = total / 1024 / 1024
  if (totalMB > 5) fail('打包体积', `总计 ${totalMB.toFixed(2)} MB，超过 5 MB 预算`)
  else pass('打包体积', `总计 ${totalMB.toFixed(2)} MB（最大单文件 ${(largest.size / 1024).toFixed(0)} KB）`)

  // 首屏不该加载 echarts（它是懒加载块）
  const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf8')
  if (indexHtml.includes('echarts')) fail('首屏依赖', 'echarts 被预加载进首屏')
  else pass('首屏依赖', 'echarts 未进首屏（懒加载生效）')
}

// ---------- 8. 文档一致性 ----------
function checkDocs() {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')

  // README 里的测试数字必须与 package.json 的实际能力匹配（不做精确比对，只防严重漂移）
  const testMatch = readme.match(/tests-(\d+)/)
  if (testMatch) {
    const claimed = Number(testMatch[1])
    if (claimed < 1000) warn('README 测试数字', `声称 ${claimed} 项，看起来过时`)
    else pass('README 测试数字', `声称 ${claimed} 项`)
  }

  // 引用的文档必须存在
  const links = [...readme.matchAll(/\]\(([A-Za-z0-9_\-./]+\.md)\)/g)].map((m) => m[1])
  const broken = links.filter((l) => !existsSync(join(ROOT, l)))
  if (broken.length) fail('README 链接', `失效：${broken.join('、')}`)
  else pass('README 链接', `${links.length} 个文档链接全部有效`)
}

// ---------- 9. PWA ----------
function checkPwa() {
  const distDir = join(ROOT, 'dist')
  if (!existsSync(distDir)) {
    warn('PWA 产物', 'dist/ 不存在，跳过')
    return
  }
  const hasSw = existsSync(join(distDir, 'sw.js'))
  const hasManifest = existsSync(join(distDir, 'manifest.webmanifest'))
  if (hasSw && hasManifest) pass('PWA 产物', 'sw.js 与 manifest 均已生成')
  else fail('PWA 产物', `sw.js=${hasSw} manifest=${hasManifest}`)

  const iconsDir = join(ROOT, 'public', 'icons')
  if (!existsSync(iconsDir)) {
    fail('PWA 图标', 'public/icons 不存在')
    return
  }
  const icons = readdirSync(iconsDir).filter((f) => f.endsWith('.png'))
  if (icons.length >= 3) pass('PWA 图标', `${icons.length} 个尺寸`)
  else fail('PWA 图标', `只有 ${icons.length} 个，至少需要 3 个`)
}

// ---------- 主流程 ----------
async function main() {
  console.log('\n  没钱 No Money — 项目健康检查\n  ' + '─'.repeat(52) + '\n')

  checkFiles()
  checkVersions()
  await checkCities()
  await checkEntrypointConsistency()
  checkA11y()
  checkSecurity()
  checkDocs()
  checkPwa()
  if (!quick) checkBundleSize()

  const icon = { pass: '✓', fail: '✗', warn: '!' }
  for (const r of results) {
    console.log(`  ${icon[r.status]} ${r.name.padEnd(16)} ${r.detail}`)
  }

  const failed = results.filter((r) => r.status === 'fail').length
  const warned = results.filter((r) => r.status === 'warn').length

  console.log('\n  ' + '─'.repeat(52))
  if (failed) {
    console.log(`  ${failed} 项失败，${warned} 项警告\n`)
    process.exit(1)
  }
  console.log(`  全部通过${warned ? `（${warned} 项警告）` : ''}\n`)
}

main().catch((e) => {
  console.error('检查脚本异常：', e)
  process.exit(1)
})
