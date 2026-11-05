<template>
  <PageHeading />
  <!-- display-directive="show:lazy"：三个面板是同一条链路（补偿 → 指南 → 文书），
       用户会反复来回切。首次访问才挂载（lazy），访问过就保留（show），
       避免每次切换都重建表单与重算模型。

       注意：这不是在修一个"切页签丢金额"的 bug。
       store.compensation 只在切换城市与重置参数时清空，面板重挂载不会清它
       （calc() 只由规则变更与用户输入触发，不在 onMounted 里跑）。
       这里选 show:lazy 是为了省掉重复挂载的开销，不是因为不加就会丢数据。 -->
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
