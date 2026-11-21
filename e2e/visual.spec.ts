import { test, expect } from '@playwright/test'

/**
 * 视觉回归只锁两张「用户第一眼」页面：首页四入口与向导第二步。
 * 不追求像素级 100% 相同（字体渲染随平台略有差异），允许 2% 像素差异；
 * 真正的结构问题（入口消失、卡片塌陷、横向溢出）远高于这个阈值。
 */
async function dismissOnboarding(page: import('@playwright/test').Page) {
  const start = page.getByRole('button', { name: '开始调整参数' })
  if (await start.count()) {
    await start.click()
    await expect(start).toHaveCount(0)
  }
}

test.describe('视觉回归：首页与向导', () => {
  test('首页四入口首屏', async ({ page }) => {
    await page.goto('/')
    await dismissOnboarding(page)
    await expect(page.getByRole('tablist', { name: '四个办事入口' })).toBeVisible()
    await expect(page).toHaveScreenshot('start-first-screen.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    })
  })

  test('向导第二步：身份选择', async ({ page }) => {
    await page.goto('/start')
    await dismissOnboarding(page)
    const wizard = page.getByRole('region', { name: '三步办事向导' })
    await expect(wizard).toBeVisible()
    await wizard.getByRole('button', { name: '下一步' }).click()
    await expect(wizard.getByRole('group', { name: '选择身份' })).toBeVisible()
    await expect(page).toHaveScreenshot('wizard-step-2.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    })
  })
})
