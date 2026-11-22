<template>
  <PageHeading />
  <section class="page-intro">
    <span class="page-intro-kicker">规划 · 税务 / 养老</span>
    <h2>同样一笔收入，换个身份，到手可能差很多</h2>
    <p>先比较劳务报酬与个体工商户的税负，再看长期养老缴费。所有比例都可以改，结论跟着你的参数走，不替你拍板。</p>
  </section>
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
