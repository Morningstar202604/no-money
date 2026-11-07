<template>
  <!--
    视图级错误边界
    --------------------------------------------------------------------------
    为什么需要：main.ts 的全局 errorHandler 会用整页错误卡替换 #app——
    一个视图里的渲染异常（比如某条规则数据触发边界情况）会让整个应用白屏，
    侧边栏、导航、其他页面全部不可用。这违背"局部出错不影响整体"。

    放在 RouterView 外层后：
    - 某个视图渲染/更新抛错 → 只有内容区显示错误卡与"重试"按钮
    - 侧边栏、导航、主题切换、命令面板继续可用
    - 点"重试"强制重建该视图（常见的数据型错误重挂载即恢复）
    - 点"回总览"跳转路由（路由型错误换页即恢复）
  -->
  <ErrorBoundary>
    <!-- 把 page-content（入场淡入）直接挂到被渲染的页面组件上，
         而不是挂到 ViewOutlet 根——ErrorBoundary 是片段组件，
         根上挂 class 会触发「Extraneous non-props attributes」警告并丢失动画 -->
    <RouterView v-slot="{ Component }">
      <component :is="Component" class="page-content" />
    </RouterView>
  </ErrorBoundary>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import ErrorBoundary from '../components/ErrorBoundary.vue'
</script>
