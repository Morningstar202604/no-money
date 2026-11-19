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

import { NTabs, NTabPane } from 'naive-ui'
import TaxOptimizer from '../components/panels/TaxOptimizer.vue'
import RetirementPlanner from '../components/panels/RetirementPlanner.vue'
import { useTabQuery } from '../composables/useTabQuery'

const TAB_NAMES = ['tax', 'retirement'] as const
const tab = useTabQuery(TAB_NAMES, 'tax')
</script>
