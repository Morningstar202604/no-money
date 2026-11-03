import { test, expect } from '@playwright/test'

/**
 * 无障碍与语义结构 E2E
 *
 * 这些检查用真实浏览器验证，而不是读源码正则：
 * 「组件里写了 h1」和「DOM 里真的有 h1」是两件事，
 * 被 v-if 包住、被 CSS 隐藏、被 Teleport 移走，都会让后者失败。
 */
test.describe('语义结构', () => {
  const pages = [
    ['/dashboard', '总览'],
    ['/scenario', '方案对比'],
    ['/planning', '税务'],
    ['/rights', '权益'],
    ['/policy', '政策'],
    ['/admin', '数据管理'],
  ] as const

  for (const [path, keyword] of pages) {
    test(`${path} 有唯一 h1 且包含页面主题`, async ({ page }) => {
      await page.goto(path)
      await page.waitForTimeout(2000)

      const h1s = page.locator('h1')
      await expect(h1s, `${path} 必须恰好有一个 h1`).toHaveCount(1)
      const text = await h1s.innerText()
      expect(text, `${path} 的 h1 应体现页面主题`).toContain(keyword)
    })
  }

  test('主导航有可访问名称且每项有文本', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(1500)

    const nav = page.getByRole('navigation', { name: '主导航' })
    await expect(nav).toBeVisible()

    const links = nav.getByRole('link')
    const count = await links.count()
    expect(count).toBe(5)

    for (let i = 0; i < count; i++) {
      const name = await links.nth(i).innerText()
      expect(name.length, `第 ${i + 1} 个导航项没有可访问名称`).toBeGreaterThan(1)
    }
  })

  test('所有按钮都有可访问名称', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(2000)

    const buttons = page.getByRole('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(5)

    const unnamed: string[] = []
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i)
      if (!(await btn.isVisible())) continue
      const name = (await btn.getAttribute('aria-label')) ?? (await btn.innerText())
      if (!name || !name.trim()) {
        unnamed.push((await btn.evaluate((el) => el.outerHTML)).slice(0, 100))
      }
    }
    expect(unnamed, `存在没有可访问名称的按钮：\n${unnamed.join('\n')}`).toHaveLength(0)
  })

  test('键盘可以到达命令面板并完成一次操作', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(2000)

    // 全程不用鼠标：不预先关闭引导弹窗，直接按快捷键——
    // 这正是真实用户会做的事（引导弹窗打开时想直接搜索）。
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('dialog', { name: '命令面板' })).toBeVisible()

    await page.keyboard.type('政策')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1200)

    // 应该跳到了政策页
    expect(new URL(page.url()).pathname).toBe('/policy')
  })

  test('主题切换后刷新仍保持选择', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(1500)

    // 默认浅色
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light')

    const toggle = page.getByRole('button', { name: /切换到(浅色|深色)模式/ })
    await toggle.click()
    await page.waitForTimeout(400)
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark')

    // 刷新后仍然是深色（持久化生效）
    await page.reload()
    await page.waitForTimeout(1500)
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark')

    // 清回默认，避免影响后续测试
    await page.evaluate(() => localStorage.removeItem('theme'))
  })
})
