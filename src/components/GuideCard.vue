<template>
  <article class="guide-card">
    <h4 class="gc-q">{{ item.question }}</h4>
    <p class="gc-line">{{ item.oneLiner }}</p>

    <div v-if="item.numbers?.length" class="gc-nums">
      <div v-for="(n, i) in item.numbers" :key="i" class="gc-num">
        <span class="gc-num-label">{{ n.label }}</span>
        <span class="gc-num-value">{{ n.value }}</span>
      </div>
    </div>

    <ul v-if="item.keyPoints?.length" class="gc-points">
      <li v-for="(p, i) in item.keyPoints" :key="i">{{ p }}</li>
    </ul>

    <ol v-if="item.steps?.length" class="gc-steps">
      <li v-for="(s, i) in item.steps" :key="i">{{ s }}</li>
    </ol>

    <p v-if="item.caution" class="gc-caution"><b>注意</b>{{ item.caution }}</p>
    <p v-if="item.toolHint" class="gc-tool"><b>本工具</b>{{ item.toolHint }}</p>

    <OfficialLinks :links="item.links" label="官方原文" />
  </article>
</template>

<script setup lang="ts">
import type { GuideItem } from '../utils/livingGuide'
import OfficialLinks from './OfficialLinks.vue'

defineProps<{ item: GuideItem }>()
</script>

<style scoped>
.guide-card {
  padding: 12px 0;
  border-bottom: 1px solid var(--color-bg-tertiary);
}
.guide-card:last-child {
  border-bottom: none;
}

.gc-q {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 6px;
}

.gc-line {
  font-size: 13px;
  line-height: 1.7;
  color: var(--color-text-primary);
  background: var(--color-bg-brand-light);
  border-left: 3px solid var(--color-text-brand);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  padding: 8px 10px;
  margin: 0 0 8px;
}

.gc-nums {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 6px;
  margin-bottom: 8px;
}

.gc-num {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
}

.gc-num-label {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.gc-num-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.gc-points {
  margin: 0 0 6px;
  padding-left: 18px;
}
.gc-points li {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin-bottom: 2px;
}

.gc-steps {
  margin: 0 0 6px;
  padding-left: 20px;
  counter-reset: step;
  list-style: decimal;
}
.gc-steps li {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin-bottom: 2px;
}

.gc-caution {
  font-size: 12px;
  color: var(--color-text-warning);
  background: var(--color-warning-50);
  border-left: 2px solid var(--color-text-warning);
  border-radius: 0 3px 3px 0;
  padding: 6px 8px;
  margin: 0 0 6px;
  line-height: 1.6;
}
.gc-caution b,
.gc-tool b {
  margin-right: 6px;
}

.gc-tool {
  font-size: 12px;
  color: var(--color-text-brand);
  background: var(--color-bg-brand-light);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  margin: 0 0 6px;
}

</style>
