import { test, expect } from '@playwright/test'

/**
 * 命令面板 E2E
 *
 * 单测只验证匹配排序；这里验证真实浏览器里「按下快捷键 → 面板出现 →
 * 输入 → 回车 → 页面真的变了」这条完整链路。
 * 纯逻辑正确但事件没接上，是这类组件最常见的失效方式。
 */
test.describe('命令面板', () => {
  test('Ctrl+K 能唤起面板，ESC 能关闭', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: '开始调整参数' }).click().catch(() => {})

    await page.keyboard.press('Control+k')
    const palette = page.getByRole('dialog', { name: '命令面板' })
    await expect(palette).toBeVisible()
    await expect(page.getByRole('combobox')).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(palette).toBeHidden()
  })

  test('输入城市名并回车会真的切换城市', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: '开始调整参数' }).click().catch(() => {})
    await expect(page.locator('body')).toContainText('广州')

    await page.keyboard.press('Control+k')
    const input = page.getByRole('combobox')
    await input.fill('深圳')

    // 输入后应只剩与深圳相关的命令
    const options = page.getByRole('option')
    await expect(options).toHaveCount(1)
    await expect(options.first()).toContainText('深圳')

    await input.press('Enter')

    // 面板必须关闭，且城市真的切换了
    await expect(page.getByRole('dialog', { name: '命令面板' })).toBeHidden()
    await expect(page.locator('body')).toContainText('深圳')
  })

  test('方向键可以移动选中项，选中项有 aria-selected', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: '开始调整参数' }).click().catch(() => {})

    await page.keyboard.press('Control+k')
    const input = page.getByRole('combobox')

    const first = page.getByRole('option').first()
    await expect(first).toHaveAttribute('aria-selected', 'true')

    await input.press('ArrowDown')
    const second = page.getByRole('option').nth(1)
    await expect(second).toHaveAttribute('aria-selected', 'true')
    await expect(first).toHaveAttribute('aria-selected', 'false')
  })

  test('搜不到结果时给出可操作提示，而不是空白', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: '开始调整参数' }).click().catch(() => {})

    await page.keyboard.press('Control+k')
    await page.getByRole('combobox').fill('zzzzz')

    await expect(page.getByRole('option')).toHaveCount(0)
    await expect(page.getByText('没有匹配的命令')).toBeVisible()
    await expect(page.getByText(/试试输入城市名/)).toBeVisible()
  })

  test('面板打开时按 Tab 不会把焦点漏到页面背后', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: '开始调整参数' }).click().catch(() => {})

    await page.keyboard.press('Control+k')
    const input = page.getByRole('combobox')
    await expect(input).toBeFocused()

    await page.keyboard.press('Tab')
    // 焦点仍应在面板内（输入框本身，因为 Tab 被拦截）
    await expect(input).toBeFocused()
  })

  test('点击头部搜索按钮也能打开面板（移动端没有键盘快捷键）', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: '开始调整参数' }).click().catch(() => {})

    // 宽屏下按钮可见
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('button', { name: '搜索页面、城市或操作' }).click()
    await expect(page.getByRole('dialog', { name: '命令面板' })).toBeVisible()
  })
})
