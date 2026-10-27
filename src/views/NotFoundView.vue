<template>
  <n-card class="card">
    <n-result status="404" title="页面不存在" :description="`没有找到路径 ${path}。`">
      <template #footer>
        <n-space justify="center">
          <n-button type="primary" @click="router.push('/dashboard')">回到总览</n-button>
          <n-button @click="router.back()">返回上一页</n-button>
        </n-space>
      </template>
    </n-result>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NCard, NResult, NButton, NSpace } from 'naive-ui'

// 未知路径此前被静默重定向到 /dashboard：用户以为自己点对了地方，
// 地址栏却显示另一个页面，深链写错时也无从察觉。改为显式 404 并提供出口。
const route = useRoute()
const router = useRouter()
const path = computed(() => route.fullPath)
</script>

<style scoped>
/* 其余样式沿用 global.css 的 .card，这里只补页脚间距 */
.card { margin-top: 40px; }
</style>
