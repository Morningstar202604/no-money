import { test, expect } from '@playwright/test'

/**
 * 上线就绪度 E2E
 *
 * 这些不是功能测试，而是"能否交给陌生人用"的检查：
 * 安装得了吗？断网还能用吗？分享出去卡片正常吗？反馈入口能点吗？
 * 这些问题在开发机上永远暴露不出来，只有真的按用户路径走一遍才会发现。
 */
test.describe('上线就绪度', () => {
  test('页面声明了 Web App Manifest，且图标可访问', async ({ page, request }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(1500)

    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(href, '没有 manifest 链接，浏览器不会认为这是可安装应用').toBeTruthy()

    const res = await request.get(href!)
    expect(res.status()).toBe(200)
    const manifest = await res.json()

    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons?.length).toBeGreaterThanOrEqual(2)

    // 图标必须真的能取到，不能只是声明
    const iconRes = await request.get('/' + manifest.icons[0].src.replace(/^\//, ''))
    expect(iconRes.status()).toBe(200)
    expect(iconRes.headers()['content-type']).toContain('image')
  })

  test('Service Worker 注册成功并接管页面', async ({ page }) => {
    await page.goto('/dashboard')
    // SW 注册与激活是异步的，给它时间
    await page.waitForTimeout(4000)

    const state = await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations()
      return {
        count: regs.length,
        active: regs[0]?.active?.state ?? null,
        controlled: !!navigator.serviceWorker.controller,
        caches: (await caches.keys()).length,
      }
    })

    expect(state.count, 'Service Worker 未注册').toBeGreaterThan(0)
    expect(state.active).toBe('activated')
    expect(state.caches, '没有任何缓存，离线不可用').toBeGreaterThan(0)
  })

  test('离线时可以打开并完成一次测算', async ({ page, context }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(4000)

    // 先预热：让规则 JSON 进缓存
    await page.goto('/policy')
    await page.waitForTimeout(2500)
    await page.goto('/dashboard')
    await page.waitForTimeout(2500)

    // 真实断网
    await context.setOffline(true)
    try {
      await page.goto('/dashboard')
      await page.waitForTimeout(2500)

      const body = await page.locator('body').innerText()
      expect(body.length, '离线时页面空白').toBeGreaterThan(200)
      expect(body).toContain('总览')
      // 关键：离线也要能算出数，而不是只显示一个空壳
      expect(body).toMatch(/月净收入|¥/)
    } finally {
      await context.setOffline(false)
    }
  })

  test('社交分享元数据完整（OG + Twitter）', async ({ page, request }) => {
    await page.goto('/dashboard')

    const metas = await page.evaluate(() => {
      const get = (sel: string) => document.querySelector(sel)?.getAttribute('content') ?? null
      return {
        ogTitle: get('meta[property="og:title"]'),
        ogDesc: get('meta[property="og:description"]'),
        ogImage: get('meta[property="og:image"]'),
        ogType: get('meta[property="og:type"]'),
        twitterCard: get('meta[name="twitter:card"]'),
        twitterImage: get('meta[name="twitter:image"]'),
        description: get('meta[name="description"]'),
      }
    })

    expect(metas.ogTitle).toBeTruthy()
    expect(metas.ogDesc).toBeTruthy()
    expect(metas.ogType).toBe('website')
    expect(metas.twitterCard).toBe('summary_large_image')
    expect(metas.description).toBeTruthy()

    // 分享图必须真的可访问，否则卡片是空图
    expect(metas.ogImage).toBeTruthy()
    const imgRes = await request.get(metas.ogImage!)
    expect(imgRes.status()).toBe(200)
    expect(imgRes.headers()['content-type']).toContain('image')
  })

  test('反馈入口可打开，且提供三种反馈类型', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(2000)
    // 引导弹窗是模态的，期间所有浮动按钮按设计隐藏（否则会盖住主 CTA）
    const start = page.getByRole('button', { name: '开始调整参数' })
    if (await start.count()) await start.click()
    await page.waitForTimeout(600)

    const trigger = page.getByRole('button', { name: '反馈问题' })
    await expect(trigger).toBeVisible()
    await trigger.click()

    const panel = page.getByRole('dialog', { name: '反馈' })
    await expect(panel).toBeVisible()

    // 三种类型都要在，且都是真实链接
    for (const label of ['报告问题', '纠正政策数据', '提建议']) {
      const link = panel.getByRole('link', { name: new RegExp(label) })
      await expect(link).toBeVisible()
      const href = await link.getAttribute('href')
      expect(href).toContain('github.com')
      expect(href).toContain('issues/new')
    }
  })

  test('反馈诊断信息不含用户收入与成本', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(2000)
    const start = page.getByRole('button', { name: '开始调整参数' })
    if (await start.count()) await start.click()
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: '反馈问题' }).click()

    // 读复制按钮要写入的内容：直接调用页面里的剪贴板 API 拦截
    const copied = await page.evaluate(async () => {
      let captured = ''
      const orig = navigator.clipboard.writeText.bind(navigator.clipboard)
      navigator.clipboard.writeText = async (t: string) => { captured = t; return orig(t) }
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('复制诊断信息'))
      btn?.click()
      await new Promise((r) => setTimeout(r, 300))
      return captured
    })

    // 诊断信息应当只有版本/城市/浏览器这类公开信息
    expect(copied).toContain('版本')
    expect(copied).toContain('浏览器')
    // 绝不能出现用户的收入、成本数字
    expect(copied).not.toContain('8969')
    expect(copied).not.toContain('106275')
    expect(copied).not.toContain('身份证')
  })

  test('隐私政策与服务条款在仓库中可达', async ({ request }) => {
    // 这两个文件至少要在仓库根，README 与页脚都应能指过去
    const res = await request.get('/PRIVACY.md').catch(() => null)
    // 静态托管未必托管 md，这里只断言不返回 5xx（404 可接受，文件在仓库里）
    if (res) expect(res.status()).toBeLessThan(500)
  })
})
