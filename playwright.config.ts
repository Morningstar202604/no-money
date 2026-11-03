import { defineConfig, devices } from '@playwright/test'

// 默认 4173 可能被同机其他项目（如 015/workbench）的 preview 占用，
// 冲突时 Playwright 会连到别人的站点，测试全挂但看不出原因。默认改用 4273。
const PORT = Number(process.env.E2E_PORT ?? 4273)
const baseURL = `http://127.0.0.1:${PORT}`

/**
 * E2E 只验证「用户真的能用的东西」：页面能开、数字能算、交互有反应、窄屏不破版。
 * 与单元测试的分工：
 *   - 单元测试保证公式与数据正确
 *   - E2E 保证这些正确的东西真的接到了界面上
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    // 用生产构建产物跑 E2E：dev 服务器与线上行为不同（HMR、未压缩、sourcemap）
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
