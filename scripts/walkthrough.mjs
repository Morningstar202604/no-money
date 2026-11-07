/**
 * 用户视角全流程走查：模拟普通用户从打开到每个模块的操作，
 * 每一步截图留存到 docs/screenshots-review/ 供人工复核。
 * 运行：node scripts/walkthrough.mjs（需先 npm run build）
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const PORT = Number(process.env.E2E_PORT ?? 4273)
const BASE = `http://127.0.0.1:${PORT}`
const OUT = 'docs/screenshots-review'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await shot('w01-dashboard')

// 命令面板：Ctrl+K → 输入城市 → 回车
await page.keyboard.press('Control+KeyK')
await page.waitForTimeout(400)
await shot('w02-command-palette')
await page.keyboard.press('Escape')

// 侧边栏拖动一个滑块（键盘方式模拟真实交互）
const slider = page.locator('.n-slider').first()
if (await slider.count()) {
  await slider.click()
  await page.waitForTimeout(600)
}
await shot('w03-after-slider')

// 各模块逐个进入
const navNames = [
  ['w04-scenario', /场景|Scenario/],
  ['w05-planning', /规划|养老|Tax|Planning/],
  ['w06-rights', /权益|Rights/],
  ['w07-policy', /政策|Policy/],
  ['w08-admin', /管理|Admin/],
]
for (const [name, re] of navNames) {
  const link = page.locator('a', { hasText: re }).first()
  if (await link.count()) {
    await link.click()
    await page.waitForTimeout(900)
    await shot(name)
  } else {
    console.log(`NAV MISS: ${name} (${re})`)
  }
}

// AI 助手设置面板（发送预览功能）
const chatBtn = page.locator('button', { hasText: /助手|AI|Assistant/ }).first()
if (await chatBtn.count()) {
  await chatBtn.click()
  await page.waitForTimeout(500)
  await shot('w09-chat')
}

// 分享链接按钮
const shareBtn = page.locator('button', { hasText: /分享|分享链接|Share/ }).first()
if (await shareBtn.count()) {
  await shareBtn.click()
  await page.waitForTimeout(500)
  await shot('w10-share')
}

// 移动端视口
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
await mobile.goto(BASE, { waitUntil: 'networkidle' })
await mobile.waitForTimeout(1000)
await mobile.screenshot({ path: `${OUT}/w11-mobile.png` })

// 深色主题
await page.evaluate(() => localStorage.setItem('theme', 'dark'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await shot('w12-dark')

console.log('CONSOLE ERRORS:', errors.length ? errors : '(none)')
await browser.close()
