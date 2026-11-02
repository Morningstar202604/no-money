import { test, expect } from '@playwright/test'

/** 首次引导弹窗会挡住主内容，测试里统一先关掉 */
async function dismissOnboarding(page: import('@playwright/test').Page) {
  const start = page.getByRole('button', { name: '开始调整参数' })
  if (await start.count()) {
    await start.click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
}

/**
 * 移动端侧边栏默认收起，参数控件不可见。
 * 真实用户必须先点开侧边栏才能改参数——测试也照这个路径走，
 * 否则会误判成「控件不存在」，掩盖真正的不可达问题。
 */
async function openSidebar(page: import('@playwright/test').Page) {
  const sidebar = page.locator('#params-sidebar')
  const visible = await sidebar.isVisible().catch(() => false)
  const inViewport = visible
    ? await sidebar.evaluate((el) => {
        const r = el.getBoundingClientRect()
        return r.left >= -1 && r.width > 0
      })
    : false
  if (!inViewport) {
    // 移动端由顶部菜单按钮切换抽屉
    await page.getByRole('button', { name: '打开参数设置' }).click()
    await expect(sidebar).toBeVisible()
  }
}

test.describe('应用可用性', () => {
  test('首页能打开并完成首次计算', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/没钱 No Money/)
    // 规则加载完成：侧边栏显示城市名
    await expect(page.getByRole('complementary', { name: '参数设置' })).toBeVisible()
    await dismissOnboarding(page)

    // 核心结果必须渲染出真实数字，而不是 0 或空
    await expect(page.getByText('月净收入（假设）')).toBeVisible()
    const netText = await page.getByText(/^¥[\d,]+\.\d$/).first().textContent()
    expect(netText).toBeTruthy()
    const net = Number(netText!.replace(/[¥,]/g, ''))
    expect(net).toBeGreaterThan(1000)
    expect(net).toBeLessThan(100000)
  })

  test('五个主页面都能打开且不空白', async ({ page }) => {
    const routes = [
      ['/dashboard', /总览/],
      ['/scenario', /方案对比/],
      ['/planning', /税务/],
      ['/rights', /权益/],
      ['/policy', /政策/],
    ] as const

    for (const [path, titlePattern] of routes) {
      await page.goto(path)
      await dismissOnboarding(page)
      await expect(page).toHaveTitle(titlePattern)
      // 主内容区必须有实质文本
      const mainText = await page.locator('main').innerText()
      expect(mainText.length).toBeGreaterThan(200)
    }
  })

  test('未知路径返回 404 而不是静默重定向', async ({ page }) => {
    await page.goto('/this-route-does-not-exist')
    await expect(page).toHaveTitle(/页面不存在/)
    await expect(page.getByText('页面不存在')).toBeVisible()
    // 必须给出回到主界面的出口，而不是把用户困在死页
    await expect(page.getByRole('button', { name: '回到总览' })).toBeVisible()
    // 不得静默跳转到 dashboard：地址栏必须保留用户输错的原始路径
    expect(new URL(page.url()).pathname).toBe('/this-route-does-not-exist')
  })

  test('修改工作参数会实时改变净收入', async ({ page }) => {
    await page.goto('/dashboard')
    await dismissOnboarding(page)
    await openSidebar(page)

    const netLocator = page.locator('.kpi-value, [data-kpi="net"]').first()
    // KPI 数字由 AnimatedNumber 渲染为多个 span，读卡片文本并归一化空白
    const readNet = async () => {
      const card = page.locator('.kpi-row .stat').first()
      const text = (await card.locator('.stat-value').innerText()).replace(/\s/g, '')
      const m = text.match(/¥([\d,]+\.?\d*)/)
      return m ? Number(m[1].replace(/,/g, '')) : NaN
    }

    // 数字滚动动画约 600ms，等它落定再取值
    await page.waitForTimeout(900)
    const before = await readNet()
    expect(before).toBeGreaterThan(0)

    // 拖动「日均工时」滑块到右侧
    const hoursSlider = page.getByRole('slider').first()
    await hoursSlider.focus()
    for (let i = 0; i < 4; i++) await hoursSlider.press('ArrowRight')

    await page.waitForTimeout(900)
    await expect.poll(readNet, { timeout: 8000 }).not.toBe(before)
    const after = await readNet()
    expect(after).toBeGreaterThan(before)
  })

  test('切换到方案对比页能看到多个方案', async ({ page }) => {
    await page.goto('/scenario')
    await dismissOnboarding(page)
    await expect(page.getByText('多场景对比实验室')).toBeVisible()
    await expect(page.getByText('当前方案')).toBeVisible()
    // 至少 3 个方案卡
    const cards = page.locator('text=/¥[\\d,]+\\.?\\d*\\/月/')
    expect(await cards.count()).toBeGreaterThanOrEqual(3)
  })

  test('政策页展示数据溯源与置信度标记', async ({ page }) => {
    await page.goto('/policy')
    await dismissOnboarding(page)
    const body = await page.locator('body').innerText()
    // 必须能看到「待核实 / 未核实」这类诚实标记
    expect(body).toMatch(/待核验|未核实|unverified|待核实/)
  })

  test('AI 助手面板可以打开且默认不持久化', async ({ page }) => {
    await page.goto('/dashboard')
    await dismissOnboarding(page)

    await page.getByRole('button', { name: 'AI 助手' }).click()
    const body = await page.locator('body').innerText()
    expect(body).toMatch(/AI|助手/)

    // 默认状态下不应写入任何对话历史
    const hist = await page.evaluate(() => localStorage.getItem('nomoney_chat_hist'))
    expect(hist).toBeNull()
  })

  test('窄屏 320px 不出现横向溢出', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto('/dashboard')
    await dismissOnboarding(page)

    const overflow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }))
    expect(overflow.scrollW).toBeLessThanOrEqual(overflow.clientW + 1)
  })

  test('窄屏下引导弹窗的按钮必须可达', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto('/dashboard')

    const start = page.getByRole('button', { name: '开始调整参数' })
    await expect(start).toBeVisible()
    // 按钮必须在视口内，否则用户永远点不到
    const box = await start.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y + box!.height).toBeLessThanOrEqual(640 + 1)

    await start.click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('参数导出按钮能触发下载', async ({ page }) => {
    await page.goto('/dashboard')
    await dismissOnboarding(page)
    await openSidebar(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 })
    await page.getByRole('button', { name: '导出参数' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.json$/)
  })

  test('重置参数恢复默认值', async ({ page }) => {
    await page.goto('/dashboard')
    await dismissOnboarding(page)
    await openSidebar(page)

    const slider = page.getByRole('slider').first()
    await slider.focus()
    await slider.press('ArrowRight')
    await slider.press('ArrowRight')
    const changed = await slider.getAttribute('aria-valuenow')
    expect(changed).not.toBe('10')

    await page.getByRole('button', { name: '重置为默认参数' }).click()
    await expect.poll(async () => await page.getByRole('slider').first().getAttribute('aria-valuenow')).toBe('10')
  })
})
