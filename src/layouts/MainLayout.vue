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
          <!-- 命令面板入口：既是可点击按钮，也提示了快捷键，用户第一次就知道有这东西 -->
          <button
            class="search-trigger"
            @click="paletteOpen = true"
            aria-label="搜索页面、城市或操作"
            title="搜索（Ctrl/⌘ + K）"
          >
            <svg class="search-trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" stroke-linecap="round" />
            </svg>
            <span class="search-trigger-text">搜索</span>
            <kbd class="search-trigger-kbd">⌘K</kbd>
          </button>

          <!-- City Status -->
          <div class="status-badge" v-if="store.rule">
            <span class="status-dot" :class="store.rule.verified ? 'verified' : 'partial'" />
            <span class="status-text">{{ store.rule.cityName }} · {{ store.rule.year }}版</span>
            <span class="status-label" :class="store.rule.verified ? 'verified' : 'partial'">
              {{ store.rule.verified ? '历史已核验' : '部分待核验' }}
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

    <CommandPalette v-model:open="paletteOpen" :commands="paletteCommands" />
    <FeedbackButton />

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

        <div v-if="store.rule" class="global-alert info" role="status">
          <div class="alert-content"><p>{{ store.ruleTimeNotice }}</p></div>
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
import { CITY_OPTIONS } from '../data/cities'
import ParamSidebar from '../components/ParamSidebar.vue'
import ChatAssistant from '../components/ChatAssistant.vue'
import CommandPalette from '../components/CommandPalette.vue'
import FeedbackButton from '../components/FeedbackButton.vue'
import type { Command } from '../utils/commandPalette'
import { downloadTextFile } from '../utils/download'

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

/** 命令面板开关：⌘K / Ctrl+K 唤起 */
const paletteOpen = ref(false)

/**
 * 命令注册表。
 * 页面 + 城市 + 操作三类：这是用户每天真正会重复做的事。
 * 城市列表来自 CITY_OPTIONS，新增城市自动出现在面板里，不需要改这里。
 */
const paletteCommands = computed<Command[]>(() => [
  ...navItems.map((item) => ({
    id: `nav-${item.key}`,
    label: item.label,
    hint: item.path,
    kind: 'navigate' as const,
    group: '页面',
    keywords: [item.key.toLowerCase()],
    run: () => onNav(item.key),
  })),
  ...CITY_OPTIONS.map((city) => ({
    id: `city-${city.value}`,
    label: city.label,
    hint: store.work.city === city.value ? '当前城市' : '切换城市',
    kind: 'city' as const,
    group: '城市',
    keywords: [city.value],
    run: () => store.setCity(city.value),
  })),
  {
    id: 'action-toggle-theme',
    label: isDark.value ? '切换到浅色模式' : '切换到深色模式',
    kind: 'action' as const,
    group: '操作',
    keywords: ['theme', 'dark', 'light', '主题', '深色', '浅色'],
    run: toggleTheme,
  },
  {
    id: 'action-reset-params',
    label: '重置为默认参数',
    kind: 'action' as const,
    group: '操作',
    keywords: ['reset', 'default', '重置', '默认'],
    run: () => store.resetParams?.(),
  },
  {
    id: 'action-export-params',
    label: '导出参数',
    kind: 'action' as const,
    group: '操作',
    keywords: ['export', 'download', '导出', '备份'],
    run: () => {
      downloadTextFile({
        filename: `no-money-params-${store.work.city}.json`,
        content: store.exportParams(),
        mimeType: 'application/json',
      })
    },
  },
] as Command[])

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
  // ⌘K / Ctrl+K 唤起命令面板：这是编辑器与 IDE 的通用约定，用户会本能去按
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    // 引导弹窗打开时 naive-ui 的焦点陷阱会持续抢回焦点，导致面板输入框拿不到焦点。
    // 打开面板前先让引导自行收起（通过自定义事件解耦，不直接持有子组件实例）。
    if (!paletteOpen.value) window.dispatchEvent(new CustomEvent('app:close-onboarding'))
    paletteOpen.value = !paletteOpen.value
    return
  }
  // 斜杠快捷唤起：GitHub / Linear 的约定，单手就能按
  if (e.key === '/' && !isEditableTarget(e.target)) {
    e.preventDefault()
    paletteOpen.value = true
    return
  }
  // 移动抽屉此前只能点遮罩关闭，键盘用户没有退出路径
  if (e.key === 'Escape' && mobileSidebarOpen.value) mobileSidebarOpen.value = false
}

/** 在输入框里按 / 时应该输入斜杠，而不是打开面板 */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
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
  /* 品牌名不换行：窄屏下「没钱」两个字曾被挤成两行，把 header 撑高 */
  white-space: nowrap;
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

/* 窄屏只显示图标：文字改用视觉隐藏（而非 display:none）——
   display:none 会把文字移出无障碍树，读屏软件读到的链接就没有名字了 */
.nav-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (min-width: 640px) {
  .nav-label {
    position: static;
    width: auto;
    height: auto;
    margin: 0;
    overflow: visible;
    clip: auto;
  }
}

/* 极窄屏（≤380px）：品牌只留图标，把宽度让给导航与操作区 */
@media (max-width: 380px) {
  .brand-text { display: none; }
  .header-brand { padding: var(--space-1); }
  /* 320px 下图标按钮 5 个 + 间距仍会超出可用宽度，
     收紧内边距与间距，保证最后一个导航项完整落在视口内 */
  .header-nav { gap: 2px; margin-left: var(--space-1); }
  .nav-link { padding: var(--space-1); }
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

/* 命令面板入口：看起来像搜索框，实际是按钮——比纯图标更容易被发现 */
.search-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 32px;
  padding: 0 var(--space-2) 0 var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--surface-border);
  background: var(--surface-1);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  font-family: inherit;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.search-trigger:hover {
  border-color: var(--surface-border-strong);
  background: var(--surface-2);
  color: var(--color-text-secondary);
}

.search-trigger:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.search-trigger-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.search-trigger-kbd {
  font-family: var(--font-family-mono);
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface-2);
  border: 1px solid var(--surface-border);
  color: var(--color-text-tertiary);
  line-height: 1.5;
}

/* 窄屏只留图标：搜索文字挤占导航空间，但按钮本身必须还在 */
@media (max-width: 900px) {
  .search-trigger-text,
  .search-trigger-kbd {
    display: none;
  }

  .search-trigger {
    width: 32px;
    padding: 0;
    justify-content: center;
  }
}

@media (max-width: 640px) {
  .search-trigger {
    display: none;
  }
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
/* 正常文档流：固定定位会把提示压在首屏正文上，用户看不到第一屏内容 */
.global-alert {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  margin: var(--space-4) var(--space-4) 0;
  padding: var(--space-4);
  background: var(--color-alert-bg-error);
  border: 1px solid var(--color-alert-border-error);
  border-radius: var(--radius-lg);
  animation: slideDown var(--transition-normal);
}

.global-alert .alert-content p {
  color: var(--color-alert-text-error);
}

.global-alert .alert-title {
  color: var(--color-alert-title-error);
}

.global-alert.info {
  background: var(--color-alert-bg-info);
  border-color: var(--color-alert-border-info);
}

.global-alert.info .alert-content p {
  color: var(--color-alert-text-info);
}

.global-alert.error {
  background: var(--color-alert-bg-error);
  border-color: var(--color-alert-border-error);
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

  /* 移动端告警保持正常文档流，左右留白由 margin 控制 */
  .global-alert {
    margin: var(--space-3) var(--space-3) 0;
  }

  .sidebar-overlay {
    display: block;
  }
}

/* ---------- Page Transitions ---------- */
/* 路由切换的入场淡入由 .page-content 的 fadeIn 动画承担；
   离场过渡已移除（懒加载路由首进时的竞态会卡死 out-in 过渡） */
</style>