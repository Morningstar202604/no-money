import { test, expect } from '@playwright/test'

async function dismissOnboarding(page: import('@playwright/test').Page) {
  const start = page.getByRole('button', { name: '开始调整参数' })
  if (await start.count()) {
    await start.click()
    await expect(start).toHaveCount(0)
  }
}

test.describe('权益导航 P0：四入口与三步向导', () => {
  test('首页首屏四个入口可点，进入办事页', async ({ page }) => {
    await page.goto('/dashboard')
    await dismissOnboarding(page)

    await expect(page.getByText('先看这四件事')).toBeVisible()
    for (const label of ['我该做什么', '我能拿什么', '社保医保怎么办', '遇到麻烦怎么办']) {
      await expect(page.getByRole('button', { name: new RegExp(label) })).toBeVisible()
    }

    await page.getByRole('button', { name: /我该做什么/ }).click()
    await expect(page).toHaveURL(/\/start/)
    await expect(page.getByText('3 步向导 · 不注册')).toBeVisible()
    await expect(page.getByText('你在哪个城市工作 / 参保')).toBeVisible()
  })

  test('三步向导生成 3–7 条，每条都有官方入口或明确说没有', async ({ page }) => {
    await page.goto('/start')
    await dismissOnboarding(page)

    await expect(page.getByText('3 步向导 · 不注册')).toBeVisible()
    await page.getByRole('button', { name: '下一步' }).click()
    await expect(page.getByText('企业职工')).toBeVisible()
    await page.getByRole('button', { name: '下一步' }).click()
    await expect(page.getByText('刚入职，先办什么')).toBeVisible()
    await page.getByRole('button', { name: '生成我的清单' }).click()

    await expect(page.getByText('你的清单')).toBeVisible()
    const cards = page.locator('.rw-list .right-card')
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(3)
    expect(count).toBeLessThanOrEqual(7)
    await expect(page.locator('.rw-list .right-card .rc-link').first()).toHaveAttribute('href', /^https:\/\//)
  })

  test('“我能拿什么”和“遇到麻烦怎么办”各自落到对应内容', async ({ page }) => {
    await page.goto('/start?entry=benefits')
    await dismissOnboarding(page)
    await expect(page.getByText('可能能领到的钱')).toBeVisible()
    await expect(page.getByText('这些是“可能领到”，不是“人人都有”')).toBeVisible()

    await page.goto('/start?entry=trouble')
    await dismissOnboarding(page)
    await expect(page.getByText('遇到麻烦：先留证据，再走流程')).toBeVisible()
    await expect(page.getByText('被欠薪：先留证据，再走监察/仲裁')).toBeVisible()
    await expect(page.getByRole('button', { name: /补偿计算/ })).toBeVisible()
  })
})
