import { expect, type Page } from '@playwright/test'

/**
 * 关掉首次进入算一算页的引导弹窗。
 *
 * 0.1.0 起 `/dashboard` 的页面 chunk 与 naive-ui 都是按需加载的，弹窗会比
 * `page.goto()` 晚一帧出现。旧实现用 `count()` 立刻判断，会把“还没加载出来”
 * 当成“没有弹窗”，随后遮罩盖住 AI 按钮和参数控件，测试才开始失败。
 * 这里只对确实有引导的 `/dashboard` 等待，给弹窗 2 秒出现窗口；其他页面直接跳过。
 */
export async function dismissOnboarding(page: Page) {
  if (!new URL(page.url()).pathname.includes('/dashboard')) return
  const start = page.getByRole('button', { name: '开始调整参数' })
  await start.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {})
  if (await start.count()) {
    await start.click()
    await expect(start).toHaveCount(0)
  }
}
