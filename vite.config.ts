import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'

// 生产环境启用压缩与分析
const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  // 部署到子路径时设 VITE_BASE=/app/（构建期注入，运行时资源统一走 assetUrl）
  base: process.env.VITE_BASE || '/',
  // 默认 node 环境（domain 纯函数最快）；组件挂载测试在文件头用
  // `// @vitest-environment happy-dom` 单独切环境，避免全部用例付 DOM 启动成本
  test: {
    environment: 'node',
    include: ['tests/**/*.{spec,test}.ts'],
  },
  plugins: [
    vue({
      // 生产环境开启 template 编译优化
      template: {
        compilerOptions: {
          hoistStatic: isProd,
          cacheHandlers: isProd,
        },
      },
    }),
    // PWA：让用户能"安装到桌面"并离线使用。
    // 对这个产品是刚需而不是锦上添花——骑手在电梯、地下车库、电梯间接单，
    // 那些地方没有信号，而"这个月到底能拿多少"恰恰是等单时才想算的。
    //
    // 缓存策略：
    //   - 应用外壳（JS/CSS/HTML）：预缓存，秒开
    //   - 城市规则 JSON：StaleWhileRevalidate —— 先给旧值保证可用，后台再更新
    //   - 不缓存任何用户数据（本来也不出设备）
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: '没钱 No Money — 灵活就业收入精算',
        short_name: '没钱',
        description: '收入 / 个税 / 社保 / 权益测算，离线可用，数据不出设备',
        lang: 'zh-CN',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f8fafc',
        theme_color: '#0d9488',
        categories: ['finance', 'productivity', 'utilities'],
        icons: [
          { src: 'icons/128x128.png', sizes: '128x128', type: 'image/png' },
          { src: 'icons/256x256.png', sizes: '256x256', type: 'image/png' },
          { src: 'icons/512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // 规则 JSON 体积小但数量多，单独走运行时缓存而不是预缓存，
        // 避免首次安装时下载全部 34 城（用户通常只用一个城市）
        globIgnores: ['**/rules/**', '**/knowledge/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // 城市规则：先返回缓存（保证离线可用），同时后台拉新版
            urlPattern: /\/rules\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'no-money-rules',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // 知识库：同上
            urlPattern: /\/knowledge\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'no-money-kb',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // 用户手动切换主题后刷新，不该被缓存挡住
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/rules\//, /^\/knowledge\//],
      },
      devOptions: { enabled: false },
    }),
    // 打包体积分析：npm run build && npx serve dist && open http://localhost:4173/stats.html
    isProd && visualizer({
      filename: 'stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),

  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },

  server: {
    port: 3000,
    open: false,
    strictPort: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
    // 不监听 Rust 构建产物：tauri:build 会写入 src-tauri/target，
    // 其中 .dll/.pdb 在链接期被占用，chokidar 触发 EBUSY 会让 dev 服务器直接退出
    watch: { ignored: ['**/src-tauri/**', '**/dist/**', '**/.aqg/**'] },
  },

  preview: { port: 4173 },

  build: {
    outDir: 'dist',
    // 生产不外发源码映射：dist 曾 14M 里 11M 是 .map，等于公开全部注释与内部逻辑
    sourcemap: process.env.SOURCE_MAP === '1',
    // 目标现代浏览器，启用更多现代语法压缩
    target: 'es2022',
    // CSS 代码分割：每个 async chunk 单独的 CSS 文件
    cssCodeSplit: true,
    // 模块预加载指令
    modulePreload: { polyfill: false },
    // 移除调试用 console/debugger（生产环境）
    minify: 'esbuild',
    // 将 chunkSizeWarningLimit 调大以避免误报，实际优化靠 manualChunks
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // 外部化：大型三方库走 CDN（需在 index.html 手动加载）
      // external: ['echarts', 'naive-ui', 'vue', 'vue-router', 'pinia'],
      output: {
        // 稳定的哈希文件名，利于长期缓存
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (info) => {
          const name = info.name ?? 'asset'
          const ext = name.split('.').pop()
          if (/\.(png|jpe?g|gif|svg|webp|avif|woff2?)$/.test(name)) return `assets/img/[name]-[hash].${ext}`
          if (/\.css$/.test(name)) return `assets/css/[name]-[hash].${ext}`
          return `assets/[name]-[hash].${ext}`
        },
        // 细粒度手动分块（避免循环依赖：合并易循环的库为单块，依赖 tree-shaking）
        manualChunks: (id) => {
          // 1. Vue 生态
          if (id.includes('node_modules/vue') || id.includes('node_modules/vue-router') || id.includes('node_modules/pinia')) {
            return 'vendor-vue'
          }
          // 2. naive-ui：单块打包（避免循环依赖，依赖 tree-shaking 剔除未用代码）
          if (id.includes('node_modules/naive-ui')) {
            return 'naive-ui'
          }
          // 3. echarts：单块打包（避免循环依赖，依赖 tree-shaking）
          if (id.includes('node_modules/echarts')) {
            return 'echarts'
          }
          // 4. 其余 node_modules
          if (id.includes('node_modules')) {
            return 'vendor-other'
          }
        },
      },
    },
    // terser 进阶压缩（若 esbuild 不够用可切换）
    // minify: 'terser',
    // terserOptions: { compress: { passes: 2, unsafe_math: true }, format: { comments: false } },
  },

  // 启用 CSS 模块哈希（避免类名冲突，配合 scoped 已足够，保留为未来多页扩展）
  css: { modules: { localsConvention: 'camelCaseOnly' } },

  // 实验性：依赖预构建优化
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia', 'naive-ui', 'echarts/core', 'echarts/charts', 'echarts/components'],
    // 避免重复预构建
    force: false,
  },
})