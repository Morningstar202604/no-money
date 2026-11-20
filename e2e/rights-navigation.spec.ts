import { test, expect } from '@playwright/test'

async function dismissOnboarding(page: import('@playwright/test').Page) {
  const start = page.getByRole('button', { name: '开始调整参数' })
  if (await start.count()) {
    await start.click()
    await expect(start).toHaveCount(0)
  }
}

test.describe('权益导航 P0：四入口与三步向导', () => {
  test('根路径默认进入办事页，四个入口可见可点', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/start/)
    await dismissOnboarding(page)

    await expect(page.getByRole('tablist', { name: '四个办事入口' })).toBeVisible()
    for (const label of ['我该做什么', '我能拿什么', '社保医保怎么办', '遇到麻烦怎么办']) {
      await expect(page.getByRole('tab', { name: new RegExp(label) })).toBeVisible()
    }

    await page.getByRole('tab', { name: /我该做什么/ }).click()
    await expect(page).toHaveURL(/\/start/)
    await expect(page.getByText('3 步向导 · 不注册')).toBeVisible()
    await expect(page.getByText('你在哪个城市工作 / 参保')).toBeVisible()
  })

  test('政策页首屏只有四组，民生手册收进「手册与知识库」', async ({ page }) => {
    await page.goto('/policy')
    await dismissOnboarding(page)

    await expect(page.locator('.n-tabs-tab')).toHaveCount(4)
    for (const label of ['政策原文', '数据溯源', '现实与救济', '手册与知识库']) {
      await expect(page.locator('.n-tabs-tab').filter({ hasText: label })).toBeVisible()
    }
    await expect(page.getByText('民生手册', { exact: true })).toBeHidden()

    await page.locator('.n-tabs-tab').filter({ hasText: '数据溯源' }).click()
    await expect(page.getByText('34 城数据新鲜度总览')).toBeVisible()
    await expect(page.getByText(/已读取 34 \/ 34 城/)).toBeVisible()
    await page.getByText('查看 34 城明细').click()
    await expect(page.locator('.df-row')).toHaveCount(34)
    await expect(page.locator('.df-row').filter({ hasText: '广州' }).first()).toContainText('当前')
    await expect(page.getByText('本城数据状态：')).toBeVisible()
    await expect(page.getByText(/项参数/)).toBeVisible()

    await page.locator('.n-tabs-tab').filter({ hasText: '手册与知识库' }).click()
    await expect(page.getByText('民生手册', { exact: true })).toBeVisible()
    await expect(page.getByText('知识库', { exact: true })).toBeVisible()
  })

  test('常见情况一键出清单，不用走完三步', async ({ page }) => {
    await page.goto('/start')
    await dismissOnboarding(page)

    await expect(page.getByRole('group', { name: '常见情况一键清单' })).toBeVisible()
    await page.getByRole('button', { name: /刚入职/ }).click()
    await expect(page.getByText('你的清单')).toBeVisible()
    await expect(page.locator('.rw-list .right-card').first()).toBeVisible()
    await expect(page.getByText('第 1 件 · 先办这个')).toBeVisible()
    await expect(page.getByText('刚入职，先办什么')).toBeVisible()

    await page.getByRole('button', { name: '问 AI 材料/流程' }).click()
    await expect(page.locator('.chat-panel')).toBeVisible()
    await expect(page.locator('.chat-panel textarea')).toHaveValue(/广州/)
    await expect(page.locator('.chat-panel textarea')).toHaveValue(/我的清单第 1 件/)
    await expect(page.getByText('已带入当前清单，确认后点发送；可先改。')).toBeVisible()
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

  test('北京生成清单后显示社保/医保/公积金/就业四类本地官方入口', async ({ page }) => {
    await page.goto('/start')
    await dismissOnboarding(page)

    await page.locator('#rw-city').click()
    await page.getByText('北京', { exact: true }).last().click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.getByRole('button', { name: '生成我的清单' }).click()

    await expect(page.getByText('本地官方入口 · 北京')).toBeVisible()
    for (const label of ['社会保险', '医疗保险', '住房公积金', '就业服务']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }
    await expect(page.locator('.csl-card')).toHaveCount(4)
    await expect(page.locator('.csl-card').first()).toHaveAttribute('href', /^https:\/\/rsj\.beijing\.gov\.cn/)
  })

  test('非深核城市自动回退省级入口，公积金没直达链接就不给死链', async ({ page }) => {
    await page.goto('/start')
    await dismissOnboarding(page)

    await page.locator('#rw-city').click()
    await page.getByText('东莞', { exact: true }).last().click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.getByRole('button', { name: '生成我的清单' }).click()

    await expect(page.getByText('省级官方入口 · 广东')).toBeVisible()
    await expect(page.locator('.csl-card')).toHaveCount(4)
    const housing = page.locator('.csl-card').filter({ hasText: '住房公积金' })
    await expect(housing).toHaveClass(/is-text-only/)
    expect(await housing.getAttribute('href')).toBeNull()
  })

  test('加入清单后刷新还在，标记已办后进度更新', async ({ page }) => {
    await page.goto('/start')
    await dismissOnboarding(page)

    const firstCard = page.locator('.right-card').first()
    await expect(firstCard).toBeVisible()
    await firstCard.getByRole('button', { name: '加入清单' }).click()

    await expect(page.getByText('我的清单')).toBeVisible()
    await expect(page.getByText(/0 \/ 1 已办/)).toBeVisible()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出清单' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^没钱-我的清单-\d{4}-\d{2}-\d{2}\.txt$/)
    await expect(page.getByText('已导出 txt')).toBeVisible()

    await page.reload()
    await dismissOnboarding(page)
    await expect(page.getByText('我的清单')).toBeVisible()
    const reloadedCard = page.locator('.right-card').first()
    await reloadedCard.getByRole('button', { name: '标记已办' }).click()
    await expect(page.getByText(/1 \/ 1 已办/)).toBeVisible()
  })
})
