import { test, expect } from '@playwright/test'

/**
 * URL 方案分享 — 真实浏览器全链路
 *
 * 用户路径：A 调好参数 → 复制分享链接 → 发给 B → B 打开链接 →
 * 看到与 A 相同的城市与参数，并有"这是别人的参数"的提示。
 * 单测只验证编解码，这里验证整条链路（按钮 → 剪贴板 → 打开 → 生效 → 提示）。
 */
test.describe('URL 方案分享', () => {
  test('复制分享链接 → 打开 → 参数生效并显示提示', async ({ page, context, browserName }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(2500)
    const start = page.getByRole('button', { name: '开始调整参数' })
    if (await start.count()) await start.click()
    await page.waitForTimeout(600)

    // A：改参数（工时拉到 12）让分享内容有区分度。
    // 桌面端侧边栏常驻、没有"打开参数设置"按钮； getByRole().click() 找不到
    // 元素会等满超时——先数一下有没有，没有就跳过（与真实用户行为一致）。
    const menuBtn = page.getByRole('button', { name: '打开参数设置' })
    if (await menuBtn.count()) await menuBtn.click()
    await page.waitForTimeout(600)
    const slider = page.getByRole('slider').first()
    await slider.focus()
    await slider.press('ArrowRight')
    await slider.press('ArrowRight')
    await page.waitForTimeout(700)

    // A：点分享按钮，授权剪贴板并读取
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByRole('button', { name: /复制分享链接|已复制分享链接/ }).click()
    await page.waitForTimeout(500)
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied, '剪贴板里应是带 s= 参数的链接').toMatch(/[?&]s=/)
    expect(copied.length).toBeLessThan(2000)

    // B：新标签页打开链接
    const pageB = await context.newPage()
    await pageB.goto(copied)
    await pageB.waitForTimeout(3000)

    // 必须有"这是别人的参数"提示
    await expect(
      pageB.getByText(/已载入分享来的测算参数/),
      '打开分享链接后没有出现参数来源提示',
    ).toBeVisible()

    // 城市与 A 的工时应一致（A 基于广州默认，工时被 +2）
    const body = await pageB.locator('body').innerText()
    expect(body).toContain('广州')
    expect(body).toMatch(/12h/)
    // 分享参数消费后应从地址栏移除：刷新不会再次"弹别人参数"
    const url = new URL(pageB.url())
    expect(url.searchParams.has('s'), '消费后 s 参数应被移除').toBe(false)

    // 刷新后提示不再出现（参数已并入本地状态）
    await pageB.reload()
    await pageB.waitForTimeout(2500)
    expect(await pageB.getByText(/已载入分享来的测算参数/).count()).toBe(0)
    await pageB.close()
  })

  test('篡改的分享参数不致命：打开后正常显示默认界面', async ({ page }) => {
    await page.goto('/dashboard?s=!!!!broken!!!!')
    await page.waitForTimeout(2500)
    // 不应有"已载入分享"提示（解码失败按无分享处理）
    expect(await page.getByText(/已载入分享来的测算参数/).count()).toBe(0)
    // 页面必须正常渲染出默认测算，而不是白屏
    const body = await page.locator('body').innerText()
    expect(body).toContain('月净收入')
  })
})
