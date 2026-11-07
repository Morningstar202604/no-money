<template>
  <n-config-provider :theme="theme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <!-- 分享链接生效提示：用 alert 而非 message，因为 message 3 秒消失，
           而用户需要有时间理解"我现在看到的数字是别人的参数" -->
      <div v-if="sharedApplied" class="shared-banner" role="status">
        已载入分享来的测算参数（城市与各项数值可能不是你的），修改后即为你的方案
      </div>
      <MainLayout />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, ref } from 'vue'
import { router } from './app/router'
import { stripShareFromUrl } from './utils/share'
import {
  NConfigProvider, NMessageProvider,
  darkTheme, lightTheme, type GlobalThemeOverrides,
} from 'naive-ui'
import MainLayout from './layouts/MainLayout.vue'
import { useMainStore } from './stores/main'

// Import global styles
import '@/styles/global.css'

const store = useMainStore()

// 应用启动必须加载本城规则：store.rule 为 null 时 scenarios/comparison 全为空，
// 所有页面会显示为「正常但全是零」的空界面，且 loadError 也是 null 不会报错。
// 启动加载是唯一的兜底入口——切城市由 ParamSidebar 触发，失败重试由 MainLayout 触发。
onMounted(() => {
  // URL 分享参数（?s=...）必须在首次 loadRule 之前应用：
  // 分享链接带着别人的城市，先加载默认城市再切会闪两次且可能用到默认参数算错一帧。
  if (store.applySharedParams()) {
    sharedApplied.value = true
    // router 的初始导航（含懒加载路由解析）会把它记录的初始地址写回 history，
    // 任何 setTimeout 都抢不过它。router.isReady() 是它写回完成后的第一个可靠时机。
    void router.isReady().then(() => stripShareFromUrl())
  }
  void store.loadRule(store.work.city)
})

// 分享生效时给一条可见确认：用户需要知道"我现在看到的确实是别人的参数"
const sharedApplied = ref(false)

// 同步全局主题 DOM：布局与内容组件都依赖 html[data-theme] 驱动的 CSS 变量。
// 默认浅色（:root 即浅色变量），store.isDark 为 true 时显式写 dark 覆盖。
watch(
  () => store.isDark,
  (v) => {
    document.documentElement.setAttribute('data-theme', v ? 'dark' : 'light')
  },
  { immediate: true },
)

// naive-ui 组件级主题：深/浅用 naive-ui 内建主题切换，品牌色引用设计 token
// （src/styles/variables.css）。注意 primaryColor 三兄弟会被 naive-ui 在 JS 里
// 用 seemly.changeColor 做颜色运算，不能是 var(...) 字符串，必须解析成真实色值；
// 其余只进 CSS 变量的键保持 var() 透传即可。
const theme = computed(() => (store.isDark ? darkTheme : lightTheme))

function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const themeOverrides = computed<GlobalThemeOverrides>(() => {
  // 依赖 isDark：watch 会先同步 data-theme，computed 求值时读到的是新主题的色值
  void store.isDark
  const primaryColor = readToken('--color-primary-500')
  const primaryColorHover = readToken('--color-primary-400')
  const primaryColorPressed = readToken('--color-primary-600')
  return {
    common: {
      primaryColor,
      primaryColorHover,
      primaryColorPressed,
      borderRadius: '8px',
      borderRadiusSmall: '6px',
      fontWeightStrong: '600',
      fontFamily: 'var(--font-family-sans)',
      },
    Card: {
      color: 'var(--color-bg-primary)',
      colorModal: 'var(--color-bg-primary)',
      colorPopover: 'var(--color-bg-primary)',
      textColor: 'var(--color-text-primary)',
      borderColor: 'var(--color-border-primary)',
      titleTextColor: 'var(--color-text-primary)',
      boxShadow: 'var(--color-shadow-md)',
    },
    DataTable: {
      thColor: 'var(--color-bg-tertiary)',
      tdColor: 'var(--color-bg-primary)',
      tdColorHover: 'var(--color-bg-tertiary)',
      borderColor: 'var(--color-border-primary)',
      thTextColor: 'var(--color-text-secondary)',
      tdTextColor: 'var(--color-text-primary)',
    },
    Input: {
      color: 'var(--color-bg-primary)',
      colorFocus: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border-primary)',
      borderHover: '1px solid var(--color-border-secondary)',
      borderFocus: '1px solid var(--color-border-focus)',
      textColor: 'var(--color-text-primary)',
    },
    Select: {
      peers: {
        InternalSelection: {
          color: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-primary)',
          borderHover: '1px solid var(--color-border-secondary)',
          textColor: 'var(--color-text-primary)',
        },
      },
    },
  Slider: {
    fillColor: primaryColor,
    fillColorHover: primaryColor,
    railColor: 'var(--color-border-primary)',
  },
  Statistic: {
    labelTextColor: 'var(--color-text-secondary)',
    valueTextColor: 'var(--color-text-primary)',
  },
  Tag: {
    colorInfo: 'var(--color-primary-50)',
    colorSuccess: 'var(--color-success-50)',
    colorWarning: 'var(--color-warning-50)',
    colorError: 'var(--color-danger-50)',
    textColorInfo: 'var(--color-primary-600)',
    textColorSuccess: 'var(--color-success-600)',
    textColorWarning: 'var(--color-warning-600)',
    textColorError: 'var(--color-danger-600)',
  },
  Menu: {
    itemTextColor: 'var(--color-text-secondary)',
    itemTextColorActive: primaryColor,
    itemTextColorHover: 'var(--color-text-primary)',
    itemColorActive: 'var(--color-primary-50)',
  },
  Alert: {
    colorInfo: 'var(--color-alert-bg-info)',
    borderColorInfo: 'var(--color-alert-border-info)',
    titleTextColorInfo: 'var(--color-alert-title-info)',
    contentTextColorInfo: 'var(--color-alert-text-info)',
    iconColorInfo: 'var(--color-primary-400)',
    colorSuccess: 'var(--color-alert-bg-success)',
    borderColorSuccess: 'var(--color-alert-border-success)',
    titleTextColorSuccess: 'var(--color-alert-title-success)',
    contentTextColorSuccess: 'var(--color-alert-text-success)',
    iconColorSuccess: 'var(--color-text-success)',
    colorWarning: 'var(--color-alert-bg-warning)',
    borderColorWarning: 'var(--color-alert-border-warning)',
    titleTextColorWarning: 'var(--color-alert-title-warning)',
    contentTextColorWarning: 'var(--color-alert-text-warning)',
    iconColorWarning: 'var(--color-text-warning)',
    colorError: 'var(--color-alert-bg-error)',
    borderColorError: 'var(--color-alert-border-error)',
    titleTextColorError: 'var(--color-alert-title-error)',
    contentTextColorError: 'var(--color-alert-text-error)',
    iconColorError: 'var(--color-text-danger)',
  },
  Button: {
    // 不能设 textColor：naive-ui 用它作为 default/quaternary 按钮的文字色，
    // 覆盖成 text-inverse 会让默认按钮在白底/深底上都不可读（1:1 对比度）。
    fontWeight: 500,
    // 但 primary 按钮必须显式指定文字色：naive-ui 默认白字，而深色主题的
    // primary-500 是亮青 #2dd4bf —— 白字压亮青对比度约 1.9:1，远低于
    // WCAG AA 的 4.5:1，按钮文字几乎看不清。--color-text-inverse 在
    // 深色主题是近黑 #0b1120、浅色主题是白，两个主题都达标。
    textColorPrimary: 'var(--color-text-on-primary)',
    textColorHoverPrimary: 'var(--color-text-on-primary)',
    textColorPressedPrimary: 'var(--color-text-on-primary)',
    textColorFocusPrimary: 'var(--color-text-on-primary)',
  },
  Modal: {
    color: 'var(--color-bg-primary)',
    borderColor: 'var(--color-border-primary)',
  },
  Drawer: {
    color: 'var(--color-bg-primary)',
  },
  Popover: {
    color: 'var(--color-bg-primary)',
  },
  Tooltip: {
    color: 'var(--color-bg-inverse)',
  },
  }
})
</script>

<style>
/* Global app styles are now in src/styles/global.css */

/* 分享参数生效提示 */
.shared-banner {
  position: fixed;
  top: var(--header-height);
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-fixed);
  margin-top: var(--space-2);
  padding: 6px 14px;
  border-radius: var(--radius-full);
  background: var(--color-primary-50);
  border: 1px solid var(--surface-border-strong);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  max-width: min(92vw, 560px);
  text-align: center;
}
</style>
