<template>
  <article class="right-card">
    <div class="rc-top">
      <span class="rc-cat">{{ categoryLabel }}</span>
      <span class="rc-conf" :class="`conf-${item.confidence}`">{{ confidenceLabel }}</span>
    </div>
    <h3 class="rc-title">{{ item.title }}</h3>
    <p class="rc-one">{{ item.oneLiner }}</p>

    <div v-if="item.whatToDo.length" class="rc-block">
      <span class="rc-label">第一步</span>
      <span class="rc-text">{{ item.whatToDo[0] }}</span>
    </div>
    <div v-if="item.whatToGet.length" class="rc-block">
      <span class="rc-label">能拿什么</span>
      <span class="rc-text">{{ item.whatToGet.slice(0, 2).join('；') }}</span>
    </div>
    <div class="rc-meta">
      <span v-if="item.deadline"><b>时限：</b>{{ item.deadline }}</span>
      <span><b>去哪办：</b>{{ item.whereToGo }}</span>
    </div>
    <div v-if="item.caution" class="rc-caution">{{ item.caution }}</div>

    <div class="rc-actions">
      <a
        v-if="item.officialUrl"
        class="rc-link"
        :href="item.officialUrl"
        target="_blank"
        rel="noopener noreferrer"
      >官方入口 ↗</a>
      <span v-else class="rc-no-link">暂无官方入口，先拨 12333 确认</span>
      <span class="rc-verify">核验：{{ item.lastVerified }}</span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RightsCategory, RightsItem } from '../data/rights/catalog'

const props = defineProps<{ item: RightsItem }>()

const CATEGORY_LABELS: Record<RightsCategory, string> = {
  onboard: '入职',
  social: '社保',
  medical: '医保',
  housing: '公积金',
  injury: '工伤',
  unemployment: '失业',
  birth: '生育',
  heat: '高温',
  subsidy: '补贴',
  tax: '税优',
  retire: '退休',
  trouble: '维权',
}

const CONFIDENCE_LABELS: Record<RightsItem['confidence'], string> = {
  official: '官方原文',
  derived: '按规则推算',
  platform: '平台数据',
  unverified: '待核实',
}

const categoryLabel = computed(() => CATEGORY_LABELS[props.item.category])
const confidenceLabel = computed(() => CONFIDENCE_LABELS[props.item.confidence])
</script>

<style scoped>
.right-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
}
.rc-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rc-cat {
  font-size: var(--font-size-xs);
  color: var(--color-text-brand);
  background: var(--color-primary-100);
  border-radius: var(--radius-full);
  padding: 2px 8px;
}
.rc-conf { font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.rc-conf.conf-official { color: var(--color-success-600); }
.rc-conf.conf-unverified { color: var(--color-warning-600); }
.rc-title { margin: 0; font-size: var(--font-size-md); line-height: 1.4; color: var(--color-text-primary); }
.rc-one { margin: 0; font-size: var(--font-size-sm); line-height: 1.65; color: var(--color-text-secondary); }
.rc-block { display: flex; gap: 8px; font-size: var(--font-size-sm); line-height: 1.6; }
.rc-label { flex: 0 0 auto; color: var(--color-text-tertiary); }
.rc-text { color: var(--color-text-primary); }
.rc-meta { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: var(--font-size-xs); line-height: 1.6; color: var(--color-text-tertiary); }
.rc-caution {
  font-size: var(--font-size-xs);
  line-height: 1.6;
  color: var(--color-warning-700);
  background: var(--color-warning-50);
  border-left: 3px solid var(--color-warning-500);
  padding: 6px 8px;
  border-radius: var(--radius-sm);
}
.rc-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; }
.rc-link { font-size: var(--font-size-sm); color: var(--color-text-brand); text-decoration: none; }
.rc-link:hover { text-decoration: underline; }
.rc-no-link { font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.rc-verify { font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
</style>
