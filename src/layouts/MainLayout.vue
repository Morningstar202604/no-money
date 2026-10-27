<template>
  <div class="main-layout">
    <!-- Header -->
    <header class="header" :class="{ 'header-scrolled': scrolled }">
      <div class="header-container">
        <!-- Brand -->
        <a class="header-brand" href="/dashboard" @click.prevent="goDashboard" aria-label="没钱 No Money 首页">
          <div class="brand-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" width="24" height="24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor"/>
            </svg>
          </div>
          <div class="brand-text">
            <span class="brand-name">没钱</span>
          </div>
        </a>

        <!-- Mobile menu button -->
        <button
          class="icon-btn mobile-menu-btn"
          @click="toggleMobileSidebar"
          :aria-label="mobileSidebarOpen ? '关闭参数设置' : '打开参数设置'"
          aria-controls="params-sidebar"
        >
          <MenuIcon class="icon" />
        </button>

        <!-- Navigation -->
        <nav class="header-nav" aria-label="主导航">
          <a
            v-for="item in navItems"
            :key="item.key"
            :href="item.path"
            class="nav-link"
            :class="{ active: activeKey === item.key }"
            @click.prevent="onNav(item.key)"
          >
            <span class="nav-icon" aria-hidden="true">
              <component :is="item.icon" />
            </span>
            <span class="nav-label">{{ item.label }}</span>
          </a>
        </nav>

        <!-- Status & Actions -->
        <div class="header-actions">
          <!-- City Status -->
          <div class="status-badge" v-if="store.rule">
            <span class="status-dot" :class="store.rule.verified ? 'verified' : 'partial'" />
            <span class="status-text">{{ store.rule.cityName }} · {{ store.rule.year }}版</span>
            <span class="status-label" :class="store.rule.verified ? 'verified' : 'partial'">
              {{ store.rule.verified ? '已核验' : '部分待核验' }}
            </span>
          </div>

          <!-- Theme Toggle -->
          <button
            class="icon-btn"
            @click="toggleTheme"
            :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
            title="切换主题"
          >
            <SunIcon v-if="isDark" class="icon" />
            <MoonIcon v-else class="icon" />
          </button>

          <!-- AI 助手：组件自带悬浮按钮与面板，勿再叠加额外的触发器 -->
          <ChatAssistant :scenarios="store.scenarios" />
        </div>
      </div>
    </header>

    <!-- Main Content Area -->
    <div class="layout-main">
      <!-- Sidebar -->
      <aside
        id="params-sidebar"
        class="sidebar"
        :class="{ collapsed: sidebarCollapsed, 'mobile-open': mobileSidebarOpen }"
        aria-label="参数设置"
      >
        <div class="sidebar-header">
          <h2 class="sidebar-title">参数设置</h2>
          <button
            class="sidebar-toggle"
            @click="sidebarCollapsed = !sidebarCollapsed"
            :aria-label="sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'"
          >
            <ChevronLeftIcon v-if="!sidebarCollapsed" class="icon" />
            <ChevronRightIcon v-else class="icon" />
          </button>
        </div>

        <div class="sidebar-content" v-show="!sidebarCollapsed">
          <ParamSidebar />
        </div>

        <div class="sidebar-collapsed-hint" v-show="sidebarCollapsed">
          <span>参数设置</span>
          <ChevronRightIcon class="icon" />
        </div>
      </aside>

      <!-- Content -->
      <main class="content" :class="{ 'content-full': sidebarCollapsed }">
        <!-- 提示容器由 App.vue 的 n-message-provider 统一提供，
             此处再嵌套一层会导致 useMessage() 归属不确定 -->

        <div v-if="store.loadError" class="global-alert error">
          <AlertIcon class="icon" />
          <div class="alert-content">
            <p class="alert-title">政策规则加载失败</p>
            <p>{{ store.loadError }}</p>
          </div>
          <n-button size="small" @click="store.loadRule(store.work.city)" variant="outlined">
            重新加载
          </n-button>
        </div>

        <!-- Page Content -->
        <div class="page-container">
          <!--
            不用 <transition mode="out-in"> 包裹：懒加载路由首次进入时，
            离场过渡与 chunk 解析存在竞态，会在部分 webview 里卡成
            page-leave-active 永驻（整页停在旧页面上，点导航也换不掉）。
            入场淡入由 .page-content 自身的 fadeIn 动画承担，效果等价。
          -->
          <router-view v-slot="{ Component }">
            <component :is="Component" class="page-content" />
          </router-view>
        </div>
      </main>
    </div>

    <!-- Mobile Sidebar Overlay -->
    <div
      class="sidebar-overlay"
      :class="{ visible: mobileSidebarOpen }"
      @click="mobileSidebarOpen = false"
      v-show="isMobile"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NButton } from 'naive-ui'
import { useMainStore } from '../stores/main'
import ParamSidebar from '../components/ParamSidebar.vue'
import ChatAssistant from '../components/ChatAssistant.vue'

// Icons
import {
  DashboardIcon,
  GitCompareIcon,
  CalculatorIcon,
  ShieldCheckIcon,
  BookOpenIcon,
  SunIcon,
  MoonIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  AlertIcon,
  MenuIcon,
} from '../components/icons'

const router = useRouter()
const route = useRoute()
const store = useMainStore()

const activeKey = computed(() => route.name as string || 'dashboard')
const scrolled = ref(false)
const sidebarCollapsed = ref(false)
const mobileSidebarOpen = ref(false)
const isDark = computed(() => store.isDark)
const isMobile = ref(false)

// key 必须与 src/app/router.ts 中的路由 name 完全一致：
// onNav 用 router.push({ name: key })，大小写不符会静默失败；
// activeKey 直接比较 route.name，不一致则导航永远没有高亮。
const navItems = [
  { key: 'Dashboard', label: '总览', path: '/dashboard', icon: DashboardIcon },
  { key: 'Scenario', label: '方案对比', path: '/scenario', icon: GitCompareIcon },
  { key: 'Planning', label: '税务与养老', path: '/planning', icon: CalculatorIcon },
  { key: 'Rights', label: '权益护航', path: '/rights', icon: ShieldCheckIcon },
  { key: 'Policy', label: '政策百科', path: '/policy', icon: BookOpenIcon },
]

function onNav(key: string) {
  router.push({ name: key })
  if (isMobile.value) mobileSidebarOpen.value = false
}

function goDashboard() {
  router.push({ name: 'Dashboard' })
}

function toggleTheme() {
  store.toggleTheme()
}

function checkMobile() {
  const mobile = window.innerWidth < 768
  isMobile.value = mobile
  // 离开移动端时收起移动抽屉，避免回到桌面端后遮罩残留
  if (!mobile) mobileSidebarOpen.value = false
}

function toggleMobileSidebar() {
  mobileSidebarOpen.value = !mobileSidebarOpen.value
}

function handleScroll() {
  scrolled.value = window.scrollY > 8
}

function onGlobalKeydown(e: KeyboardEvent) {
  // 移动抽屉此前只能点遮罩关闭，键盘用户没有退出路径
  if (e.key === 'Escape' && mobileSidebarOpen.value) mobileSidebarOpen.value = false
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  window.addEventListener('scroll', handleScroll)
  window.addEventListener('keydown', onGlobalKeydown)
})

// Cleanup
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<style scoped lang="css">
/* ==========================================================================
   Main Layout
   ========================================================================== */

.main-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-secondary);
}

/* ---------- Header ---------- */
.header {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  height: var(--header-height);
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border-primary);
  transition: box-shadow var(--transition-normal), background var(--transition-normal);
}

.header-scrolled {
  box-shadow: var(--color-shadow-md);
}

.header-container {
  max-width: var(--container-max-width);
  margin: 0 auto;
  padding: 0 var(--space-4);
  height: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-6);
  /* flex 子项默认 min-width:auto，内容宽于视口时整页被撑出横向滚动条 */
  min-width: 0;
}

/* Brand */
.header-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  outline-offset: 2px;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}

.header-brand:hover {
  background: var(--color-bg-tertiary);
}

.brand-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--color-primary-600);
  color: var(--color-text-inverse);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}

.brand-name {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
}


/* Navigation */
.header-nav {
  display: flex;
  gap: var(--space-1);
  margin-left: var(--space-2);
  padding: var(--space-1) 0;
  flex: 1;
  max-width: 720px;
  /* 允许收缩：否则导航项按内容宽度把 header 撑破视口 */
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.header-nav::-webkit-scrollbar {
  display: none;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  transition: all var(--transition-fast);
}

.nav-link:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
}

.nav-link.active {
  color: var(--color-primary-600);
  background: var(--color-primary-50);
}

.nav-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: currentColor;
}

.nav-label {
  display: none;
}

@media (min-width: 640px) {
  .nav-label {
    display: inline;
  }
}

/* Header Actions */
.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
  flex-shrink: 0;
  min-width: 0;
}

/* Status Badge */
.status-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--color-neutral-400);
}

.status-dot.verified {
  background: var(--color-success-500);
  box-shadow: 0 0 0 2px var(--color-success-100);
}

.status-dot.partial {
  background: var(--color-warning-500);
  box-shadow: 0 0 0 2px var(--color-warning-100);
}

.status-text {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.status-label {
  font-weight: var(--font-weight-semibold);
  padding: 1px var(--space-2);
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-label.verified {
  color: var(--color-success-700);
  background: var(--color-success-50);
  border: 1px solid var(--color-success-200);
}

.status-label.partial {
  color: var(--color-warning-700);
  background: var(--color-warning-50);
  border: 1px solid var(--color-warning-200);
}

/* Icon Button */
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.icon-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.icon-btn .icon {
  width: 20px;
  height: 20px;
}

/* ---------- Layout Main ---------- */
.layout-main {
  display: flex;
  flex: 1;
  min-height: calc(100vh - var(--header-height));
}

/* ---------- Sidebar ---------- */
.sidebar {
  position: fixed;
  left: 0;
  top: var(--header-height);
  bottom: 0;
  width: var(--sider-width);
  background: var(--color-bg-primary);
  border-right: 1px solid var(--color-border-primary);
  z-index: var(--z-fixed);
  display: flex;
  flex-direction: column;
  transition: width var(--transition-normal), transform var(--transition-normal);
  overflow: hidden;
}

.sidebar.collapsed {
  width: var(--sider-collapsed-width);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 var(--space-3);
  border-bottom: 1px solid var(--color-border-primary);
  flex-shrink: 0;
}

.sidebar-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar.collapsed .sidebar-title {
  display: none;
}

.sidebar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.sidebar-toggle:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.sidebar-toggle .icon {
  width: 18px;
  height: 18px;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-3);
}

.sidebar-collapsed-hint {
  display: none;
  align-items: center;
  justify-content: center;
  height: 100%;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-tertiary);
  gap: var(--space-2);
  white-space: nowrap;
}

.sidebar.collapsed .sidebar-collapsed-hint {
  display: flex;
}

.sidebar.collapsed .sidebar-collapsed-hint .icon {
  width: 16px;
  height: 16px;
}

/* ---------- Content ---------- */
.content {
  flex: 1;
  margin-left: var(--sider-width);
  min-height: calc(100vh - var(--header-height));
  transition: margin-left var(--transition-normal);
  /* flex 子项默认 min-width:auto，页面内容（表格/步骤条/图表）的 min-content
     宽度会把主区撑出视口，表现为整页横向滚动 */
  min-width: 0;
}

.content-full {
  margin-left: var(--sider-collapsed-width);
}

.page-container {
  max-width: var(--container-max-width);
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
  width: 100%;
  min-width: 0;
}

.page-content {
  animation: fadeIn var(--transition-normal);
}

/* ---------- Global Alert ---------- */
.global-alert {
  position: fixed;
  top: calc(var(--header-height) + var(--space-4));
  left: calc(var(--sider-width) + var(--space-4));
  right: var(--space-4);
  z-index: var(--z-tooltip);
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-danger-50);
  border: 1px solid var(--color-danger-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--color-shadow-lg);
  animation: slideDown var(--transition-normal);
}

.global-alert.error {
  background: var(--color-danger-50);
  border-color: var(--color-danger-200);
}

.global-alert .icon {
  width: 20px;
  height: 20px;
  color: var(--color-danger-500);
  flex-shrink: 0;
  margin-top: 2px;
}

.alert-content {
  flex: 1;
}

.alert-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-danger-700);
  margin-bottom: var(--space-1);
}

.alert-content p {
  font-size: var(--font-size-sm);
  color: var(--color-danger-600);
  margin: 0;
}

/* ---------- Mobile Menu Button ---------- */
/* 仅移动端显示：桌面端侧栏常驻，不需要汉堡按钮 */
.mobile-menu-btn {
  display: none;
}

/* ---------- Mobile Sidebar Overlay ---------- */
/* 关闭态必须是「不可点」：display:block + opacity:0 但 pointer-events:auto 时，
   遮罩会盖在 header 上（z-index 299 > sticky 200）吃掉所有点击，
   表现为移动端"打开参数设置"按钮按不动、页面看似正常却完全无响应 */
.sidebar-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  z-index: calc(var(--z-fixed) - 1);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition-normal);
}

.sidebar-overlay.visible {
  display: block;
  opacity: 1;
  pointer-events: auto;
}

@media (max-width: 767px) {
  .mobile-menu-btn {
    display: flex;
  }

  /* 窄屏放不下城市徽章全文：只留状态点，详情在参数栏可见，
     否则 header 内容总宽超过视口，整页出现横向滚动 */
  .status-badge {
    display: none;
  }

  .header-container {
    gap: var(--space-2);
  }

  .header-nav {
    /* 移动端导航让位给汉堡按钮与操作区，改为横向可滑 */
    margin-left: 0;
    flex: 1 1 auto;
  }

  .sidebar {
    transform: translateX(-100%);
  }

  /* 移动端抽屉由 mobileSidebarOpen 驱动，不再复用 collapsed：
     collapsed 还要控制桌面端的折叠宽度，两者混用会导致参数栏无法打开 */
  .sidebar.mobile-open {
    transform: translateX(0);
    box-shadow: var(--color-shadow-xl);
  }

  .sidebar.collapsed {
    width: var(--sider-width);
  }

  .content,
  .content-full {
    margin-left: 0;
  }

  /* 全局告警在移动端必须从屏幕左侧铺满，否则会按侧栏宽度偏移出可视区 */
  .global-alert {
    left: var(--space-4);
  }

  .sidebar-overlay {
    display: block;
  }
}

/* ---------- Page Transitions ---------- */
/* 路由切换的入场淡入由 .page-content 的 fadeIn 动画承担；
   离场过渡已移除（懒加载路由首进时的竞态会卡死 out-in 过渡） */
</style>