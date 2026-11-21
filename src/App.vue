<template>
  <!-- 分享链接生效提示：用 alert 而非 message，因为 message 3 秒消失，
       而用户需要有时间理解"我现在看到的数字是别人的参数" -->
  <div v-if="sharedApplied" class="shared-banner" role="status">
    已载入分享来的测算参数（城市与各项数值可能不是你的），修改后即为你的方案
  </div>
  <MainLayout />
</template>

<script setup lang="ts">
import { watch, onMounted, ref } from 'vue'
import { router } from './app/router'
import { stripShareFromUrl } from './utils/share'
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
