import { test, expect } from '@playwright/test'

/**
 * 首帧壳与首页信息架构：
 * 1. JS 还没到时，品牌页必须已经可见，而不是白屏；
 * 2. 路由就绪后首帧壳必须移除，不能残留一层挡住页面；
 * 3. 首页是权益导航，不挂「算一算」的骑手参数栏；只有计算类页面才挂。
 */
test('首帧壳先出现再移除，首页不挂算一算参数栏', async ({ page }) => {
  // 拖慢入口 JS，模拟 4G 下脚本尚未到达的首帧；页面 HTML/CSS 已到。
  await page.route('**/assets/index-*.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await route.continue()
  })

  const navigation = page.goto('/start')
  const boot = page.locator('#boot')
  await expect(boot).toBeVisible()
  await expect(boot).toContainText('该做什么、能拿什么')

  await navigation
  await expect(boot).toHaveCount(0, { timeout: 15_000 })
  await expect(page.getByRole('tablist', { name: '四个办事入口' })).toBeVisible()
  await expect(page.locator('#params-sidebar')).toHaveCount(0)

  await page.goto('/dashboard')
  await expect(page.locator('#params-sidebar')).toHaveCount(1)
})

/**
 * 首屏拆包回归：
 * naive-ui 的 682K 原始 / 176K gzip 不能因为 Provider 被根组件静态引用而回到首屏。
 * 首页只看权益导航，不应该请求它；进「算一算」后才按需下载。
 */
test('首屏不请求 naive-ui，进入算一算后才按需加载', async ({ page }) => {
  const scripts: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url())
  })

  await page.goto('/start')
  await expect(page.getByRole('tablist', { name: '四个办事入口' })).toBeVisible()
  expect(scripts.some((url) => url.includes('naive-ui'))).toBe(false)

  await page.goto('/dashboard')
  await expect(page.locator('#params-sidebar')).toHaveCount(1)
  await expect.poll(() => scripts.some((url) => url.includes('naive-ui'))).toBe(true)
})
