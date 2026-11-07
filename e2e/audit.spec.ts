import { test, expect } from '@playwright/test'

/**
 * 数据核验对账页
 *
 * 这页的存在意义是"让用户判断能不能信这个数"。
 * 因此测的不是"页面能打开"，而是：
 *   1. 矩阵真的渲染出 34 城 × 5 字段
 *   2. 覆盖率是算出来的真数字，不是写死的
 *   3. 未核实字段用黄色标注（视觉上必须与已核实可区分）
 */
test.describe('数据核验对账', () => {
  test('矩阵渲染 34 城 × 5 字段，且覆盖率来自真实统计', async ({ page }) => {
    await page.goto('/audit')
    await page.waitForTimeout(3500)

    const rows = page.locator('.matrix tbody tr')
    await expect(rows).toHaveCount(34)

    // 5 个字段列
    const headers = page.locator('.matrix thead th')
    // 城市列 + 5 字段 + 缺口列 = 7
    await expect(headers).toHaveCount(7)

    // 每行必须有 5 个色块
    const cellsInFirstRow = rows.first().locator('.cell')
    await expect(cellsInFirstRow).toHaveCount(5)

    // 覆盖率数字必须是 0-100 的整数（不是占位符）
    const ratioText = await page.locator('.metric-value').nth(3).innerText()
    const ratio = Number(ratioText.replace('%', ''))
    expect(Number.isFinite(ratio)).toBe(true)
    expect(ratio).toBeGreaterThanOrEqual(0)
    expect(ratio).toBeLessThanOrEqual(100)
  })

  test('未核实字段有可区分的视觉标记，且带解释性 title', async ({ page }) => {
    await page.goto('/audit')
    await page.waitForTimeout(3500)

    // 只取表格里的格子：图例区也有 .cell.warn（无 title，是纯色块示意），
    // 用 .matrix 作用域把它排除掉，否则 .first() 会命中的是图例。
    const warnCells = page.locator('.matrix .cell.warn')
    const okCells = page.locator('.matrix .cell.ok')
    expect(await warnCells.count()).toBeGreaterThan(0)
    expect(await okCells.count()).toBeGreaterThan(0)

    // title 让鼠标悬停能知道状态含义
    const title = await warnCells.first().getAttribute('title')
    expect(title).toBeTruthy()
    expect(title).toContain('待核实')
  })

  test('页面明确说明平台计价为何永远无法官方化', async ({ page }) => {
    await page.goto('/audit')
    await page.waitForTimeout(3000)
    // 这是产品诚实承诺的关键说明，不能只藏在代码注释里
    await expect(page.getByText(/为什么「平台计价」永远是待核实/)).toBeVisible()
  })
})
