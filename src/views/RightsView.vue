<template>
  <PageHeading />
  <!-- display-directive="show:lazy"：三个面板是同一条链路（补偿 → 指南 → 文书），
       默认的 if 会在切页签时卸载组件——补偿面板重新挂载即把 store.compensation
       置空，用户切去看指南再回来，文书页的金额已全部丢失 -->
  <n-tabs type="line" v-model:value="tab" style="margin-top: -8px" display-directive="show:lazy">
    <n-tab-pane name="compensation" tab="补偿计算">
      <RightsCompensation />
    </n-tab-pane>
    <n-tab-pane name="guide" tab="维权指南">
      <RightsGuide />
    </n-tab-pane>
    <n-tab-pane name="document" tab="文书生成">
      <DocumentGenerator />
    </n-tab-pane>
  </n-tabs>
</template>

<script setup lang="ts">
import { createPageHeading } from '../components/PageHeading'
const PageHeading = createPageHeading('rights')

import { provide, ref } from 'vue'
import { NTabs, NTabPane } from 'naive-ui'
import RightsCompensation from '../components/panels/RightsCompensation.vue'
import RightsGuide from '../components/panels/RightsGuide.vue'
import DocumentGenerator from '../components/panels/DocumentGenerator.vue'

// 维权是一条链路：算补偿 → 查指南 → 出文书，面板间通过该 ref 切换
const tab = ref('compensation')
provide('rightsTab', tab)
</script>
