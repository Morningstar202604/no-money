import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  // 用构建期 base：部署到 /app/ 时路由前缀与资源前缀一致，否则深链全部 404
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'Dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: '总览 — 月净收入与权益评分' } },
    { path: '/scenario', name: 'Scenario', component: () => import('../views/ScenarioView.vue'), meta: { title: '方案对比与收支明细' } },
    { path: '/planning', name: 'Planning', component: () => import('../views/PlanningView.vue'), meta: { title: '税务优化与养老规划' } },
    { path: '/rights', name: 'Rights', component: () => import('../views/RightsView.vue'), meta: { title: '权益护航 — 补偿计算与文书' } },
    { path: '/policy', name: 'Policy', component: () => import('../views/PolicyView.vue'), meta: { title: '政策百科与民生手册' } },
    // 未知路径显式 404：静默重定向会让用户以为地址是对的（深链写错也无从发现）
    { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('../views/NotFoundView.vue'), meta: { title: '页面不存在' } },
  ],
  // 页面切换回到顶部：长页（政策百科）滚到底再切页会从旧滚动位置开始渲染
  scrollBehavior() {
    return { top: 0 }
  },
})

// 每个路由更新标题：五个页面共用 index.html 的同一个 title 时，浏览器历史、
// 标签页与分享卡片都无法区分页面，深链粘贴出去也看不出是哪一页
const APP_NAME = '没钱 No Money'
router.afterEach((to) => {
  const pageTitle = typeof to.meta?.title === 'string' ? to.meta.title : ''
  document.title = pageTitle ? `${pageTitle} — ${APP_NAME}` : `${APP_NAME} — 灵活就业者收入精算与权益决策平台`
})

// 懒加载 chunk 失败（发版后旧 HTML 指向已删除的 hash）时 vue-router 只会往 console 打印，
// router-view 渲染空白且用户无法自行恢复，这里给出可刷新的提示
router.onError((err) => {
  const msg = String(err?.message ?? err)
  if (/dynamically imported module|Failed to fetch|Importing a module script failed/i.test(msg)) {
    console.error('[router] 页面资源加载失败：', err)
    window.dispatchEvent(new CustomEvent('app:chunk-error'))
    return
  }
  console.error('[router] 导航失败：', err)
})