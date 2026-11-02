import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { visualizer } from 'rollup-plugin-visualizer'

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