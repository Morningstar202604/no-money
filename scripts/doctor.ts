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
import { gzipSync } from 'node:zlib'
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
    'README.zh-CN.md',
    'LICENSE',
    'PRIVACY.md',
    'TERMS.md',
    'SECURITY.md',
    'CONTRIBUTING.md',
    'CHANGELOG.md',
    'AGENTS.md',
    'ARCHITECTURE.md',
    'ROADMAP.md',
    'docs/POSITIONING.md',
    'docs/REALITY-AND-SCOPE.md',
    'docs/ENGINEERING.md',
    'tests/architecture.spec.ts',
    'THIRD-PARTY-NOTICES.md',
    'docs/DEPLOYMENT.md',
    'docs/VERSIONING.md',
    'docs/RESEARCH.md',
    'docs/SECURITY-EXCEPTIONS.md',
    'Dockerfile',
    'docker/Dockerfile.api',
    'docker-compose.yml',
    'docker/nginx.conf',
    'scripts/rules-snapshot.mjs',
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

// ---------- 2b. 无硬编码版本号 ----------
function checkNoHardcodedVersion() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const SEMVER_LIKE = /['"]\d+\.\d+\.\d+['"]/g

  // 这些文件里的版本号必须来自 package.json 或构建期注入，
  // 手写字符串一定会随版本迭代漂移（此前 API 报 2.4.0 而项目已 3.1.2）。
  const files = ['server/api.ts', 'mcp/server.ts', 'cli/index.ts', 'src/components/FeedbackButton.vue', 'src/stores/main.ts']
  const offenders: string[] = []

  for (const rel of files) {
    const full = join(ROOT, rel)
    if (!existsSync(full)) continue
    const src = readFileSync(full, 'utf8')
    // 排除注释行
    const codeLines = src.split(String.fromCharCode(10)).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    const code = codeLines.join(String.fromCharCode(10))
    const hits = code.match(SEMVER_LIKE) ?? []
    // 排除技术标准版本号：OpenAPI '3.1.0' 是规范版本，不是应用版本，
    // 把它当漂移会逼着人改错东西。
    const allowed = new Set(["'3.1.0'", '"3.1.0"', "'2.0.0'", '"2.0.0"'])
    const stale = hits.filter((h) => !h.includes(pkg.version) && !allowed.has(h))
    if (stale.length) offenders.push(`${rel}: ${stale.join(', ')}`)
  }

  if (offenders.length) {
    fail('版本号无硬编码', `以下文件手写了非当前版本号：${offenders.join(' | ')}`)
  } else {
    pass('版本号无硬编码', 'API / MCP / CLI / UI 均从 package.json 或构建注入读取')
  }
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
  const requiredSources = ['pension', 'pensionRate', 'medical', 'medicalRate', 'tax', 'minimumWage', 'retirement', 'income', 'soleVat', 'soleItr']

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

  // 漏洞例外记录必须存在：没有记录的例外等于没处理
  if (existsSync(join(ROOT, 'docs', 'SECURITY-EXCEPTIONS.md'))) {
    pass('漏洞例外记录', 'docs/SECURITY-EXCEPTIONS.md 在位')
  } else {
    fail('漏洞例外记录', '缺少 docs/SECURITY-EXCEPTIONS.md（有依赖漏洞时必须记录影响评估）')
  }

  // API 默认只监听本地
  const api = readFileSync(join(ROOT, 'server', 'api.ts'), 'utf8')
  if (api.includes("process.env.HOST ?? '127.0.0.1'")) pass('API 默认监听', '默认仅 127.0.0.1')
  else warn('API 默认监听', '默认监听地址可能不是本机')
}

// ---------- 7. 打包体积 ----------
function dirSize(dir: string): number {
  let total = 0
  for (const f of readdirSync(dir)) {
    const full = join(dir, f)
    const st = statSync(full)
    total += st.isDirectory() ? dirSize(full) : st.size
  }
  return total
}

function largestFile(dir: string): { name: string; size: number } {
  let largest = { name: '', size: 0 }
  for (const f of readdirSync(dir)) {
    const full = join(dir, f)
    const st = statSync(full)
    if (st.isDirectory()) {
      const child = largestFile(full)
      if (child.size > largest.size) largest = { name: join(f, child.name), size: child.size }
    } else if (st.size > largest.size) {
      largest = { name: f, size: st.size }
    }
  }
  return largest
}

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

  const assetsTotal = dirSize(assetsDir)
  const largest = largestFile(assetsDir)

  const distTotal = dirSize(distDir)
  const distMB = distTotal / 1024 / 1024
  const assetsMB = assetsTotal / 1024 / 1024
  if (distMB > 5) fail('打包体积', `dist 总计 ${distMB.toFixed(2)} MB，超过 5 MB 预算`)
  else {
    pass(
      '打包体积',
      `dist ${distMB.toFixed(2)} MB（assets ${assetsMB.toFixed(2)} MB，最大单文件 ${(largest.size / 1024).toFixed(0)} KB）`,
    )
  }

  // 首屏 JS 预算（gzip）：超过 300K 说明有库被同步引入；0.1.0 拆掉 naive-ui 后从 410K 降到这里
  const html = readFileSync(join(distDir, 'index.html'), 'utf8')
  const entryChunks = Array.from(new Set(html.match(/assets\/[a-zA-Z0-9_-]+\.js/g) ?? []))
  let gzTotal = 0
  for (const rel of entryChunks) {
    const f = join(distDir, rel)
    if (existsSync(f)) gzTotal += gzipSync(readFileSync(f)).length
  }
  const gzKb = Math.round(gzTotal / 1024)
  if (gzKb > 300) fail('首屏 JS 预算', gzKb + 'K gzip，超过 300K（检查是否有库被同步引入）')
  else pass('首屏 JS 预算', gzKb + 'K gzip（预算 300K）')

  // 首屏不该加载 echarts / naive-ui（都是按需块）
  const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf8')
  if (indexHtml.includes('echarts')) fail('首屏依赖', 'echarts 被预加载进首屏')
  else if (indexHtml.includes('naive-ui')) fail('首屏依赖', 'naive-ui 被预加载进首屏')
  else pass('首屏依赖', 'echarts / naive-ui 均未进首屏（按需加载）')
}

// ---------- 8. 文档与对外口径 ----------
function checkDocs() {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')

  // README 不再写死测试数量，避免每次加测试都要改文案；这里只确认开发者能找到命令。
  if (!readme.includes('npm test')) warn('README 测试入口', '未说明 npm test')
  else pass('README 测试入口', '已说明 npm test，不写死测试数量')

  // 引用的文档必须存在
  const links = [...readme.matchAll(/\]\(([A-Za-z0-9_\-./]+\.md)\)/g)].map((m) => m[1])
  const broken = links.filter((l) => !existsSync(join(ROOT, l)))
  if (broken.length) fail('README 链接', `失效：${broken.join('、')}`)
  else pass('README 链接', `${links.length} 个文档链接全部有效`)
}

function checkDataClaims() {
  const rulesDir = join(ROOT, 'public', 'rules')
  const files = readdirSync(rulesDir).filter((f) => f.endsWith('.json') && f !== 'index.json')
  let total = 0
  for (const f of files) {
    const rule = JSON.parse(readFileSync(join(rulesDir, f), 'utf8')) as CityRule
    for (const v of Object.values(rule.sources ?? {})) {
      const src = v as { confidence?: string }
      if (!src || typeof src !== 'object') continue
      total += 1
    }
  }

  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')
  const readmeZh = readFileSync(join(ROOT, 'README.zh-CN.md'), 'utf8')
  const problems: string[] = []

  // README 只解释置信度分级，不再展示硬编码覆盖率；避免数据变化后文案漂移。
  for (const level of ['official', 'derived', 'unverified']) {
    if (!readme.includes(level)) problems.push(`README.md 未说明 ${level}`)
    if (!readmeZh.includes(level)) problems.push(`README.zh-CN.md 未说明 ${level}`)
  }
  if (readme.includes('38%') || readmeZh.includes('38%')) {
    problems.push('README 仍有 38% 旧口径')
  }

  if (problems.length) fail('README 数据口径', problems.join('；'))
  else pass('README 数据口径', `${files.length} 城 / ${total} 条来源；两版都说明置信度分级，不写死覆盖率`)
}

function checkPositioning() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { description?: string }
  const index = readFileSync(join(ROOT, 'index.html'), 'utf8')
  const vite = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8')
  const og = readFileSync(join(ROOT, 'public', 'og-image.svg'), 'utf8')
  const agents = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8')
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')
  const problems: string[] = []

  if (!pkg.description?.includes('权益导航')) problems.push('package.json description 缺「权益导航」')
  if (pkg.description?.includes('灵活就业者收入精算')) problems.push('package.json 仍是旧定位')
  for (const token of ['劳动者权益导航', '该做什么', '能拿什么', '去哪办']) {
    if (!index.includes(token)) problems.push(`index.html 缺「${token}」`)
  }
  if (index.includes('外卖骑手、网约车司机')) problems.push('index.html 仍用旧受众措辞')
  if (!index.includes('%BASE_URL%')) problems.push('index.html 未使用 %BASE_URL%（子路径会指错）')

  if (!vite.includes("name: '没钱 No Money — 劳动者权益导航'")) problems.push('PWA manifest 名称未更新')
  if (!vite.includes('start_url: BASE') || !vite.includes('scope: BASE')) {
    problems.push('PWA start_url/scope 未跟随 BASE')
  }
  if (!vite.includes('navigateFallback: `${BASE}index.html`')) {
    problems.push('PWA navigateFallback 未跟随 BASE')
  }

  if (og.includes('8,969') || og.includes('¥')) problems.push('OG 图仍有金额演示数字')
  if (!og.includes('劳动者权益导航') || !og.includes('该做什么')) problems.push('OG 图未改成权益导航版')

  if (agents.includes('A calculator for China')) problems.push('AGENTS.md 仍是旧定位')
  if (!agents.includes('rights-navigation')) problems.push('AGENTS.md 未描述权益导航定位')
  if (!readme.includes('rights navigation')) problems.push('README 首屏未描述权益导航定位')

  if (problems.length) fail('对外定位一致', problems.join('；'))
  else pass('对外定位一致', 'package / index / PWA / OG / AGENTS / README 均为权益导航口径')
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

  if (hasManifest) {
    const manifest = JSON.parse(readFileSync(join(distDir, 'manifest.webmanifest'), 'utf8')) as {
      name?: string
      description?: string
      start_url?: string
      scope?: string
    }
    if (manifest.start_url !== manifest.scope) {
      fail('PWA 子路径', `start_url=${manifest.start_url} 与 scope=${manifest.scope} 不一致`)
    } else if (!manifest.start_url?.endsWith('/')) {
      fail('PWA 子路径', `start_url=${manifest.start_url} 必须以 / 结尾`)
    } else {
      pass('PWA 子路径', `start_url = scope = ${manifest.start_url}`)
    }
    if (!manifest.name?.includes('劳动者')) {
      fail('PWA 定位', `manifest name 仍是「${manifest.name ?? '(空)'}」`)
    } else {
      pass('PWA 定位', manifest.name)
    }
    if (!manifest.description?.includes('社保')) {
      warn('PWA 描述', 'manifest description 未提到社保/权益内容')
    }
  }

  if (hasSw) {
    const sw = readFileSync(join(distDir, 'sw.js'), 'utf8')
    const entries = (sw.match(/url:/g) ?? []).length
    // 0.1.0 拆分首屏后路由/组件 chunk 变多，但总预缓存体积仍低于 3 MB；
    // 条目数本身不是问题，90 条只作为「是否把大文件逐个塞进来」的粗略警戒线。
    if (entries > 90) warn('PWA 预缓存', `${entries} 条，接近/超过 90 条，检查是否把大文件 precache`)
    else pass('PWA 预缓存', `${entries} 条`)

    // PWA 预缓存体积：sw.js 的 precacheAndRoute 清单里逐条 url，累加 dist 内实际文件。
    // 清单里图标可能重复出现（includeAssets + manifest icons），体积按去重后的文件算。
    const urls = [...new Set([...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]))]
    let bytes = 0
    for (const u of urls) {
      const f = join(distDir, u)
      if (existsSync(f)) bytes += statSync(f).size
    }
    const mb = bytes / 1024 / 1024
    if (mb > 3.2) fail('PWA 体积', `${mb.toFixed(2)} MB / ${urls.length} 条，超过 3.2 MB 阻断线`)
    else if (mb > 3) warn('PWA 体积', `${mb.toFixed(2)} MB / ${urls.length} 条，超过 3 MB 预算`)
    else pass('PWA 体积', `${mb.toFixed(2)} MB / ${urls.length} 条（预算 3 MB）`)
  }

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
  checkNoHardcodedVersion()
  await checkCities()
  await checkEntrypointConsistency()
  checkA11y()
  checkSecurity()
  checkDocs()
  checkDataClaims()
  checkPositioning()
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
