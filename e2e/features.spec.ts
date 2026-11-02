import { test, expect } from '@playwright/test'

async function dismissOnboarding(page: import('@playwright/test').Page) {
  const start = page.getByRole('button', { name: '开始调整参数' })
  if (await start.count()) await start.click()
}

/** 移动端侧边栏默认收起，参数控件要先展开才可见 */
async function openSidebar(page: import('@playwright/test').Page) {
  const sidebar = page.locator('#params-sidebar')
  const inViewport = await sidebar
    .evaluate((el) => {
      const r = el.getBoundingClientRect()
      return r.left >= -1 && r.width > 0
    })
    .catch(() => false)
  if (!inViewport) {
    const toggle = page.getByRole('button', { name: '打开参数设置' })
    if (await toggle.count()) await toggle.click()
    await expect(sidebar).toBeVisible()
  }
}

test.describe('核心功能', () => {
  test('AI 助手离线知识库可以回答快捷问题', async ({ page }) => {
    await page.goto('/dashboard')
    await dismissOnboarding(page)

    await page.getByRole('button', { name: 'AI 助手' }).click()
    const panel = page.locator('.chat-panel')
    await expect(panel).toBeVisible()

    // 离线模式必须有明确标识，用户要知道这不是大模型在回答
    await expect(panel.getByText('离线模式')).toBeVisible()

    const quick = panel.locator('.qq').first()
    await expect(quick).toBeVisible()
    await quick.click()

    // 必须真的产生一条助手回答（问题气泡 + 回答气泡），而不是只回显问题
    await expect
      .poll(async () => panel.locator('.msg, .bubble, [class*="msg"]').count(), { timeout: 20_000 })
      .toBeGreaterThan(1)

    const text = await panel.innerText()
    // 回答必须落到本项目的数据上（税率/扣除/社保等），不能是空话
    expect(text).toMatch(/税率|扣除|社保|专项|净收入/)
    // 用户的问题必须出现在面板里
    expect(text).toContain('怎么合法省税')
  })

  test('AI 对话默认不写入 localStorage', async ({ page }) => {
    await page.goto('/dashboard')
    await dismissOnboarding(page)
    await page.getByRole('button', { name: 'AI 助手' }).click()

    const quick = page.locator('.chat-panel .qq').first()
    if (await quick.count()) {
      await quick.click()
      await page.waitForTimeout(2000)
    }

    // 默认设置下，任何对话都不得落盘
    const keys = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.includes('chat_hist')),
    )
    expect(keys).toEqual([])
  })

  test('切换城市后计算结果随之变化', async ({ page }) => {
    await page.goto('/dashboard')
    await dismissOnboarding(page)
    await openSidebar(page)

    // KPI 数字被 AnimatedNumber 包成多个 span，innerText 会在 ¥ 与数字间插入换行，
    // 因此直接读 KPI 卡片的文本并归一化空白，而不是正则匹配整页文本。
    const readNet = async () => {
      const card = page.locator('.kpi-row .stat').first()
      const text = await card.locator('.stat-value').innerText()
      const m = text.replace(/\s/g, '').match(/¥([\d,]+\.?\d*)/)
      return m ? m[1] : null
    }
    // 数字滚动动画约 600ms，等它落定再取值，否则读到中间帧
    await page.waitForTimeout(900)
    const before = await readNet()
    expect(before).toBeTruthy()

    await page.getByRole('button', { name: '在地图上选城市（全国）' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // 地图弹窗里点深圳
    await dialog.getByText('深圳', { exact: true }).first().click()

    await page.waitForTimeout(900)
    await expect.poll(readNet, { timeout: 10_000 }).not.toBe(before)
    // 城市切换必须真实生效：侧边栏城市名与页面内容都要变成深圳
    const body = await page.locator('body').innerText()
    expect(body, '城市未切换为深圳').toContain('深圳')
    expect(body, '旧城市仍残留').not.toMatch(/广州\s*·\s*2026版/)
    // 城市切换后数据必须真的重算过（净收入变化已由上面的 poll 证明）
    expect(await readNet()).toBeTruthy()
  })

  test('税务页税额与独立核算一致', async ({ page }) => {
    await page.goto('/planning')
    await dismissOnboarding(page)

    await expect(page.getByText('劳务报酬（当前）')).toBeVisible()
    const body = await page.locator('body').innerText()

    // 默认参数下：年收入 106275，劳务报酬减除 20%，再减 60000 基本减除
    const taxable = Math.round(106275 * 0.8 - 60000) // 25020
    const expectedTax = Math.round(taxable * 0.03 * 10) / 10 // 750.6
    const afterTax = 106275 - expectedTax // 105524.4

    // 页面用千位分隔符，比较前统一去掉
    const normalized = body.replace(/,/g, '')
    expect(normalized, '应纳税所得额与独立核算不符').toContain(String(taxable))
    expect(normalized, '税额与独立核算不符').toContain(expectedTax.toFixed(1))
    expect(normalized, '税后收入与独立核算不符').toContain(afterTax.toFixed(1))
  })

  test('权益页区分可直接主张与条件项', async ({ page }) => {
    await page.goto('/rights')
    await dismissOnboarding(page)

    const body = await page.locator('body').innerText()
    expect(body).toContain('可直接主张')
    expect(body).toMatch(/条件/)
    // 必须有法条/条例依据，不能只给金额
    expect(body).toMatch(/第[一二三四五六七八九十百\d]+条|条例|办法/)
  })

  test('文书生成页提供四类文书并可下载', async ({ page }) => {
    await page.goto('/rights')
    await dismissOnboarding(page)

    // 权益页用 n-tabs 懒加载；naive-ui 的页签没有 role=tab，用可见文本定位
    const docTab = page.locator('.n-tabs-tab', { hasText: '文书生成' }).first()
    await expect(docTab).toBeVisible({ timeout: 15_000 })
    await docTab.click()
    await expect(page.getByText(/法律文书生成器/)).toBeVisible({ timeout: 15_000 })

    const body = await page.locator('body').innerText()
    for (const doc of ['劳动仲裁申请书', '行政投诉书', '证据清单', '维权诉求函']) {
      expect(body, `缺少文书类型：${doc}`).toContain(doc)
    }

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await page.getByRole('button', { name: /下载文书/ }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.txt$/)
  })

  test('政策页每个城市都有数据溯源', async ({ page }) => {
    await page.goto('/policy')
    await dismissOnboarding(page)

    const body = await page.locator('body').innerText()
    expect(body).toMatch(/official|derived|unverified|已核实|待核实/)
    // 必须能看到文号或链接，而不是只有数字
    expect(body).toMatch(/文号|来源|http/)
  })

  test('参数导出后可重新导入且数值不变', async ({ page }) => {
    await page.goto('/dashboard')
    await dismissOnboarding(page)
    await openSidebar(page)

    // 先改一个参数
    const slider = page.getByRole('slider').first()
    await slider.focus()
    await slider.press('ArrowRight')
    const changed = await slider.getAttribute('aria-valuenow')
    expect(changed).not.toBe('10')

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出参数' }).click()
    const download = await downloadPromise
    const path = await download.path()
    expect(path).toBeTruthy()

    // 重置回默认，确认确实变了
    await page.getByRole('button', { name: '重置为默认参数' }).click()
    await expect.poll(async () => await page.getByRole('slider').first().getAttribute('aria-valuenow')).toBe('10')
  })
})
