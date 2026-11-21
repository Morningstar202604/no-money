import { test, expect } from '@playwright/test'

/**
 * 数据管理后台
 *
 * 这里最容易再次漂移的是“官方覆盖率”的分母：全库 343 条溯源记录
 * 与 34 城 × 7 项核心字段的 238 格不是同一个数。页面必须把分子/分母写出来。
 */
test.describe('数据管理后台', () => {
  test('34 城与两个官方覆盖分母都写清楚', async ({ page }) => {
    await page.goto('/admin')

    await expect(page.locator('.city-table tbody tr')).toHaveCount(34)

    const sourceMetric = page.locator('.metric', { hasText: '全库条目官方占比' })
    await expect(sourceMetric.locator('.metric-value')).toHaveText('66%')
    await expect(sourceMetric.locator('.metric-note')).toHaveText('225 / 343 条')

    const coreMetric = page.locator('.metric', { hasText: '7 项核心字段官方率' })
    await expect(coreMetric.locator('.metric-value')).toHaveText('78%')
    await expect(coreMetric.locator('.metric-note')).toHaveText('186 / 238 格')

    await expect(page.getByText('全库溯源条目置信度分布')).toBeVisible()
  })
})
