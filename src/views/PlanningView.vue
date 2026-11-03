<template>
  <PageHeading />
  <n-tabs type="line" v-model:value="tab" style="margin-top: -8px">
    <n-tab-pane name="tax" tab="税务优化">
      <TaxOptimizer />
    </n-tab-pane>
    <n-tab-pane name="retirement" tab="养老规划">
      <RetirementPlanner />
    </n-tab-pane>
  </n-tabs>
</template>

<script setup lang="ts">
import { createPageHeading } from '../components/PageHeading'
const PageHeading = createPageHeading('planning')

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NTabs, NTabPane } from 'naive-ui'
import TaxOptimizer from '../components/panels/TaxOptimizer.vue'
import RetirementPlanner from '../components/panels/RetirementPlanner.vue'

// 页签与 URL 双向同步（与 PolicyView 同规则）：/planning?tab=retirement 可深链、
// 也可把当前页签连同地址复制给别人复现；切换用 replace，避免返回键逐页签回退
const TAB_NAMES = ['tax', 'retirement']
const route = useRoute()
const router = useRouter()
const tab = computed({
  get: () => (typeof route.query.tab === 'string' && TAB_NAMES.includes(route.query.tab) ? route.query.tab : 'tax'),
  set: (v: string) => {
    void router.replace({ query: { ...route.query, tab: v === 'tax' ? undefined : v } })
  },
})
</script>
