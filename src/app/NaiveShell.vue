<template>
  <n-config-provider :theme="theme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <slot />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import {
  NConfigProvider, NMessageProvider,
  darkTheme, lightTheme, type GlobalThemeOverrides,
} from 'naive-ui'
import { useMainStore } from '../stores/main'
import { installNaiveA11y } from './naiveA11y'

// naive-ui 的主题/消息容器从 App 根组件挪到这里，只被使用 naive 组件的页面按需加载。
// 首屏（/start）全部用原生控件，因此首包不再下载 176K gzip 的 naive-ui。
const store = useMainStore()

const theme = computed(() => (store.isDark ? darkTheme : lightTheme))

// 库自身的 heading/slider/数字按钮缺 ARIA 名称，挂载后统一补齐（见 naiveA11y.ts）
onMounted(() => installNaiveA11y())

function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const themeOverrides = computed<GlobalThemeOverrides>(() => {
  // 依赖 isDark：App.vue 的 watch 会先同步 data-theme，computed 求值时读到的是新主题的色值
  void store.isDark
  const primaryColor = readToken('--color-primary-500')
  const primaryColorHover = readToken('--color-primary-400')
  const primaryColorPressed = readToken('--color-primary-600')
  return {
    common: {
      primaryColor,
      primaryColorHover,
      primaryColorPressed,
      borderRadius: '12px',
      borderRadiusSmall: '8px',
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
      titleFontSize: '20px',
      titleFontWeight: '700',
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
      textColorInfo: 'var(--color-text-brand)',
      textColorSuccess: 'var(--color-text-success)',
      textColorWarning: 'var(--color-text-warning)',
      textColorError: 'var(--color-text-danger)',
    },
    Tabs: {
      // 选中页签的 600 档品牌色放在页签条浅底上只有 2.37:1；
      // 语义文字色在浅色主题是 700 档、深色主题是 400 档，两边都达标。
      tabTextColorActiveLine: 'var(--color-text-brand)',
      tabTextColorHoverLine: 'var(--color-text-brand)',
      tabTextColorActiveBar: 'var(--color-text-brand)',
      tabTextColorHoverBar: 'var(--color-text-brand)',
      tabTextColorActiveCard: 'var(--color-text-brand)',
    },
    Steps: {
      // naive-ui 默认未激活步骤用 textColorDisabled（#c2c2c2），
      // 白底只有 1.78:1；等待中的步骤仍是给用户看的说明，必须能读。
      headerTextColorProcess: 'var(--color-text-primary)',
      descriptionTextColorProcess: 'var(--color-text-secondary)',
      headerTextColorWait: 'var(--color-text-tertiary)',
      descriptionTextColorWait: 'var(--color-text-tertiary)',
      indicatorTextColorWait: 'var(--color-text-tertiary)',
      headerTextColorFinish: 'var(--color-text-tertiary)',
      descriptionTextColorFinish: 'var(--color-text-tertiary)',
      indicatorTextColorFinish: 'var(--color-text-tertiary)',
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
      // text 类型主按钮默认用 primaryColor（#14b8a6）当文字色，白底 2.48:1。
      textColorTextPrimary: 'var(--color-text-brand)',
      textColorTextHoverPrimary: 'var(--color-text-brand)',
      textColorTextPressedPrimary: 'var(--color-text-brand)',
      textColorTextFocusPrimary: 'var(--color-text-brand)',
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
