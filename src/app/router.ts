import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'Dashboard', component: () => import('../views/DashboardView.vue') },
    { path: '/scenario', name: 'Scenario', component: () => import('../views/ScenarioView.vue') },
    { path: '/planning', name: 'Planning', component: () => import('../views/PlanningView.vue') },
    { path: '/rights', name: 'Rights', component: () => import('../views/RightsView.vue') },
    { path: '/policy', name: 'Policy', component: () => import('../views/PolicyView.vue') },
    // 未知路径显式 404：静默重定向会让用户以为地址是对的（深链写错也无从发现）
    { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('../views/NotFoundView.vue') },
  ],
  // 页面切换回到顶部：长页（政策百科）滚到底再切页会从旧滚动位置开始渲染
  scrollBehavior() {
    return { top: 0 }
  },
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