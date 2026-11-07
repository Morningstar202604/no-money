import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './app/router'

const app = createApp(App)

// 无全局错误边界时，组件内异常会静默中断渲染并留下空白页。
// 这里给出用户可见的提示，并监听 router 的 chunk 失败事件。
app.config.errorHandler = (err, _instance, info) => {
  console.error('[app] 运行时异常：', err, info)
  // 已被视图级 ErrorBoundary（src/app/ViewOutlet.vue）捕获的错误不再整页替换：
  // 边界 return false 阻止了向上冒泡，能走到这里说明边界没罩住
  // （如 app 级初始化、MainLayout 自身），整页兜底卡才是正确降级。
  const detail = err instanceof Error ? err.message : String(err)
  showFatalError(`应用出现异常，请刷新页面重试（${info}: ${detail}）`)
}

function showFatalError(message: string) {
  const el = document.getElementById('app')
  if (!el) return
  // 用 DOM API 而非 innerHTML 拼接：err.message 可能内嵌用户可篡改的
  // localStorage 片段（如 JSON.parse 的 SyntaxError 原文），必须按文本节点插入
  el.replaceChildren()
  const wrap = document.createElement('div')
  wrap.style.cssText = 'display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;font-family:system-ui,sans-serif;background:#f8fafc'
  const card = document.createElement('div')
  card.style.cssText = 'max-width:420px;text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:32px'
  const title = document.createElement('div')
  title.style.cssText = 'font-size:15px;font-weight:600;color:#0f172a;margin-bottom:8px'
  title.textContent = '没钱 No Money'
  const detail = document.createElement('div')
  detail.style.cssText = 'font-size:13px;color:#64748b;line-height:1.6;margin-bottom:16px'
  detail.textContent = message
  const btn = document.createElement('button')
  btn.style.cssText = 'background:#0d9488;color:#fff;border:none;border-radius:4px;padding:8px 20px;font-size:13px;cursor:pointer'
  btn.textContent = '刷新页面'
  btn.addEventListener('click', () => location.reload())
  card.append(title, detail, btn)
  wrap.append(card)
  el.append(wrap)
}

// router.onError 派发的 chunk 失败事件，同样给出可见提示
window.addEventListener('app:chunk-error', () => {
  showFatalError('页面资源加载失败（可能是版本更新后缓存了旧文件），请刷新重试')
})

app.use(createPinia())
app.use(router)
app.mount('#app')

// PWA 注册：让浏览器知道这个站点可安装、可离线。
// registerType 是 autoUpdate，新版本会在后台装好，下次打开自动生效——
// 不用弹「有新版本，是否更新」打扰用户（这类提示在移动端很容易被误点关闭）。
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({ immediate: true })
    })
    .catch(() => {
      // SW 注册失败不影响主功能，静默降级为纯在线模式
    })
}