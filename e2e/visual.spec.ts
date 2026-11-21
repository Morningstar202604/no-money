import { test, expect } from '@playwright/test'
import { dismissOnboarding } from './helpers'

/**
 * 视觉回归锁两张「用户第一眼」页面：首页四入口首屏与向导第二步。
 *
 * 只做粗粒度布局门禁，不追求跨机器像素级一致：
 *   - 桌面 4% 容差；移动端 DPR 2.75 + 字体回退，放宽到 6%
 *   - 向导截屏前主动把向导顶到固定导航下方，消除点击「下一步」后的滚动差异
 *   - 结构断言（4 个入口 / 4 种身份 / 无横向溢出）负责精确部分，
 *     截图负责「入口消失、卡片塌陷、整块空白」这类粗错
 */
function pixelTolerance() {
  return test.info().project.name.includes('mobile') ? 0.06 : 0.04
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, '页面不得横向溢出').toBeLessThanOrEqual(1)
}

/** 把向导顶端固定到固定导航下方（移动端导航约 80px，留 16px 呼吸位）。 */
async function pinWizardBelowHeader(
  page: import('@playwright/test').Page,
  wizard: import('@playwright/test').Locator,
) {
  const top = await wizard.evaluate(
    (el) => el.getBoundingClientRect().top + window.scrollY - 96,
  )
  await page.evaluate((y) => {
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo(0, Math.max(0, y))
  }, top)
  await expect
    .poll(() => page.evaluate(() => Math.round(window.scrollY)))
    .toBe(Math.max(0, Math.round(top)))
}

test.describe('视觉回归：首页与向导', () => {
  test('首页四入口首屏', async ({ page }) => {
    await page.goto('/')
    await dismissOnboarding(page)
    const entries = page.getByRole('tablist', { name: '四个办事入口' })
    await expect(entries).toBeVisible()
    await expect(entries.getByRole('tab')).toHaveCount(4)
    await expectNoHorizontalOverflow(page)
    await expect(page).toHaveScreenshot('start-first-screen.png', {
      animations: 'disabled',
      maxDiffPixelRatio: pixelTolerance(),
    })
  })

  test('向导第二步：身份选择', async ({ page }) => {
    await page.goto('/start')
    await dismissOnboarding(page)
    const wizard = page.getByRole('region', { name: '三步办事向导' })
    await expect(wizard).toBeVisible()
    await wizard.getByRole('button', { name: '下一步' }).click()
    const identity = wizard.getByRole('group', { name: '选择身份' })
    await expect(identity).toBeVisible()
    await expect(identity.getByRole('button')).toHaveCount(4)
    await expectNoHorizontalOverflow(page)
    await pinWizardBelowHeader(page, wizard)
    await expect(page).toHaveScreenshot('wizard-step-2.png', {
      animations: 'disabled',
      maxDiffPixelRatio: pixelTolerance(),
    })
  })
})
