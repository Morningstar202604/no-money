import { readFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { dismissOnboarding } from './helpers'

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

    await expect(page.getByText('手册入口：21 条正文已去重')).toBeVisible()
    await expect(page.getByText('手册正文：仅 2 条站内无入口')).toBeVisible()
    await expect(page.locator('.guide-card')).toHaveCount(2)

    await page.getByRole('link', { name: /不想交了，能退多少钱/ }).click()
    await expect(page).toHaveURL(/\/guides\?cat=retire/)
    await expect(page.getByText('照着这张清单办，不用再到处问')).toBeVisible()
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

  test('七类办事模板可直接出清单、批量加入并导出', async ({ page }) => {
    await page.goto('/start')
    await dismissOnboarding(page)

    const quickCards = page.locator('.rw-quick-card')
    await expect(quickCards).toHaveCount(7)
    await page.getByRole('button', { name: /工伤/ }).click()

    await expect(page.locator('.rw-template')).toContainText('工伤 30 天倒计时')
    await expect(page.locator('.rw-template')).toContainText('单位 30 日')
    await expect(page.locator('.rw-list .right-card').first()).toBeVisible()
    await expect(page.getByText('第 1 件 · 先办这个')).toBeVisible()

    await page.getByRole('button', { name: '全部加入我的清单' }).click()
    await expect(page.getByText(/已加入我的清单/)).toBeVisible()
    const raw = await page.evaluate(() => localStorage.getItem('nomoney_rights_checklist_v1') || '')
    expect(raw).toContain('right-injury-report')

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出这张清单' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('工伤 30 天倒计时')
  })

  test('三步向导生成 3–7 条，每条都有官方入口或明确说没有', async ({ page }) => {
    await page.goto('/start')
    await dismissOnboarding(page)

    await expect(page.getByText('3 步向导 · 不注册')).toBeVisible()
    await page.getByRole('button', { name: '下一步' }).click()
    await expect(page.getByText('企业职工')).toBeVisible()
    await page.getByRole('button', { name: '下一步' }).click()
    await expect(page.getByText('刚入职，先办什么')).toBeVisible()
    await page.getByRole('button', { name: '生成我的清单', exact: true }).click()

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

  test('遇到麻烦的三个快捷入口落到各自页签', async ({ page }) => {
    await page.goto('/start?entry=trouble')
    await dismissOnboarding(page)

    await page.getByRole('button', { name: /维权指南/ }).click()
    await expect(page).toHaveURL(/\/rights\?tab=guide/)
    await expect(page.getByText('维权行动指南 — 从取证到仲裁')).toBeVisible({ timeout: 15_000 })

    await page.goto('/start?entry=trouble')
    await page.getByRole('button', { name: /文书生成/ }).click()
    await expect(page).toHaveURL(/\/rights\?tab=document/)
    await expect(page.getByText('法律文书生成器 — 一键生成可提交的正式文件')).toBeVisible({ timeout: 15_000 })
  })

  test('社保入口补上首页未展开的 5 条 L2', async ({ page }) => {
    await page.goto('/start?entry=social')
    await dismissOnboarding(page)

    await expect(page.getByText('还有 5 条：养老、失业与登记')).toBeVisible()
    for (const title of [
      '不想交了，能退多少钱？',
      '退休办理：提前 3 个月准备',
      '失业登记：领失业金、找工作前先办这一件事',
      '灵活就业登记：参保、领补贴的前置步骤',
      '养老金领取资格认证：每年一次，别让养老金停发',
    ]) {
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible()
    }

    await page.getByRole('button', { name: /退休办理/ }).click()
    await expect(page).toHaveURL(/\/guides\?cat=retire/)
    await expect(page.getByText('照着这张清单办，不用再到处问')).toBeVisible()
  })

  test('北京生成清单后显示社保/医保/公积金/就业四类本地官方入口', async ({ page }) => {
    await page.goto('/start')
    await dismissOnboarding(page)

    await page.locator('#rw-city').selectOption('beijing')
    await page.getByRole('button', { name: '下一步' }).click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.getByRole('button', { name: '生成我的清单', exact: true }).click()

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

    await page.locator('#rw-city').selectOption('dongguan')
    await page.getByRole('button', { name: '下一步' }).click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.getByRole('button', { name: '生成我的清单', exact: true }).click()

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

    await expect(page.getByRole('heading', { name: '我的清单', exact: true })).toBeVisible()
    await expect(page.getByText(/0 \/ 1 已办/)).toBeVisible()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出清单' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^没钱-我的清单-\d{4}-\d{2}-\d{2}\.txt$/)
    await expect(page.getByText('已导出 txt')).toBeVisible()

    await page.reload()
    await dismissOnboarding(page)
    await expect(page.getByRole('heading', { name: '我的清单', exact: true })).toBeVisible()
    const reloadedCard = page.locator('.right-card').first()
    await reloadedCard.getByRole('button', { name: '标记已办' }).click()
    await expect(page.getByText(/1 \/ 1 已办/)).toBeVisible()
  })

  test('我的清单可以整张复制给工友', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    })
    await page.goto('/start')
    await dismissOnboarding(page)

    await page.getByRole('button', { name: /工伤/ }).click()
    await page.getByRole('button', { name: '全部加入我的清单' }).click()
    await page.getByRole('button', { name: '分享清单' }).click()
    await expect(page.locator('.start-mine-note')).toContainText('已复制整张清单')

    const text = await page.evaluate(() => navigator.clipboard.readText())
    expect(text).toContain('没钱 No Money')
    expect(text).toContain('整理日期：')
    expect(text).toContain('第一步：')
    expect(text).toContain('去哪办：')
    expect(text).toContain('来自「没钱 No Money」')
    expect(text).not.toContain('undefined')
  })

  test('我的清单可设提醒日期并导出手机日历', async ({ page }) => {
    await page.goto('/start')
    await dismissOnboarding(page)

    const firstCard = page.locator('.right-card').first()
    await firstCard.getByRole('button', { name: '加入清单' }).click()

    const reminderInput = page.locator('.start-remind-input').first()
    await expect(reminderInput).toBeVisible()
    const remindDate = new Date()
    remindDate.setDate(remindDate.getDate() + 10)
    const isoDate = `${remindDate.getFullYear()}-${String(remindDate.getMonth() + 1).padStart(2, '0')}-${String(remindDate.getDate()).padStart(2, '0')}`
    await reminderInput.fill(isoDate)
    await expect(page.locator('.start-mine-note')).toContainText('已设提醒')

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '加入手机日历' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^没钱-办事提醒-\d{4}-\d{2}-\d{2}\.ics$/)
    const path = await download.path()
    expect(path).toBeTruthy()
    const ics = await readFile(path!, 'utf8')
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain(`DTSTART:${isoDate.replaceAll('-', '')}T010000Z`)
    expect(ics).toContain('TRIGGER:-P3D')
    expect(ics).toContain('办事提醒：')
    expect(ics).not.toContain('salary')
    expect(ics).not.toContain('identity')
    await expect(page.locator('.start-mine-note')).toContainText('已生成 .ics')

    await page.reload()
    await dismissOnboarding(page)
    await expect(page.locator('.start-remind-input').first()).toHaveValue(isoDate)
  })

  test('六段导航：怎么弄进入独立教程页，可按公积金筛选', async ({ page }) => {
    await page.goto('/start')
    await dismissOnboarding(page)

    const nav = page.getByRole('navigation', { name: '主导航' })
    await expect(nav.getByRole('link')).toHaveCount(6)
    await nav.getByRole('link', { name: /怎么弄/ }).click()

    await expect(page).toHaveURL(/\/guides/)
    await expect(page.getByRole('heading', { name: /怎么弄/ })).toBeVisible()
    await expect(page.locator('.right-card').first()).toBeVisible()
    const before = await page.locator('.right-card').count()
    expect(before).toBeGreaterThan(0)

    await page.getByRole('button', { name: /公积金/ }).click()
    await expect(page).toHaveURL(/cat=housing/)
    const cards = page.locator('.right-card')
    await expect(cards.first()).toBeVisible()
    expect(await cards.count()).toBeLessThanOrEqual(before)
    const categories = await cards.locator('.rc-cat').allTextContents()
    expect(categories.length).toBeGreaterThan(0)
    expect(categories.every((text) => text.includes('公积金'))).toBe(true)
  })

  test('怎么弄支持大白话搜索，无结果时给常见说法', async ({ page }) => {
    await page.goto('/guides')
    await dismissOnboarding(page)

    const search = page.locator('.guides-search input')
    await search.fill('被辞退能领失业金吗')
    await expect(page.getByText('找到 1 条相关教程')).toBeVisible()
    const results = page.locator('.right-card')
    await expect(results).toHaveCount(1)
    await expect(results.first()).toContainText('失业金')

    await search.fill('这句话肯定搜不到')
    await expect(page.getByText('没有匹配的教程，换个说法再试')).toBeVisible()
    await expect(page.locator('.guides-empty')).toBeVisible()

    await page.getByRole('button', { name: '异地看病怎么报销' }).click()
    await expect(results).toHaveCount(1)
    await expect(results.first()).toContainText('异地就医')
  })

  test('权益卡可以把办事文案复制给工友', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    })
    await page.goto('/guides')
    await dismissOnboarding(page)

    const card = page.locator('.right-card').first()
    await card.getByRole('button', { name: '分享这条' }).click()
    await expect(page.getByText('已复制分享文案，可发给工友')).toBeVisible()

    const text = await page.evaluate(() => navigator.clipboard.readText())
    expect(text).toContain('来自「没钱 No Money」')
    expect(text).toContain('核验日期：')
    expect(text).toContain('官方入口：')
    expect(text).not.toContain('undefined')
  })
})
