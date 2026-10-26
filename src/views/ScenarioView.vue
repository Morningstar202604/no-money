<template>
  <n-tabs type="line" v-model:value="tab" style="margin-top: -8px">
    <n-tab-pane name="compare" tab="方案对比">
      <ScenarioCompare />
    </n-tab-pane>
    <n-tab-pane name="detail" tab="收支明细">
      <IncomeDetail />
    </n-tab-pane>
  </n-tabs>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NTabs, NTabPane } from 'naive-ui'
import ScenarioCompare from '../components/panels/ScenarioCompare.vue'
import IncomeDetail from '../components/panels/IncomeDetail.vue'

// 页签与 URL 双向同步（与 PlanningView/PolicyView 同规则）：/scenario?tab=detail 可深链、
// 也可把当前页签连同地址复制给别人复现；切换用 replace，避免返回键逐页签回退
const TAB_NAMES = ['compare', 'detail']
const route = useRoute()
const router = useRouter()
const tab = computed({
  get: () => (typeof route.query.tab === 'string' && TAB_NAMES.includes(route.query.tab) ? route.query.tab : 'compare'),
  set: (v: string) => {
    void router.replace({ query: { ...route.query, tab: v === 'compare' ? undefined : v } })
  },
})
</script>
