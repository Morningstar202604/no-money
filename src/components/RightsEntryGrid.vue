<template>
  <div class="entry-grid" aria-label="四个办事入口">
    <button
      v-for="item in entries"
      :key="item.key"
      type="button"
      class="entry-card"
      :class="`entry-${item.key}`"
      :aria-label="`${item.title}：${item.desc}`"
      @click="go(item.key)"
    >
      <span class="entry-index">{{ item.index }}</span>
      <span class="entry-title">{{ item.title }}</span>
      <span class="entry-desc">{{ item.desc }}</span>
      <span class="entry-cta">{{ item.cta }} →</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { RIGHTS_ENTRIES, type RightsEntryKey } from '../data/rights/entries'

const router = useRouter()
const entries = RIGHTS_ENTRIES

function go(key: RightsEntryKey) {
  // tasks 是默认入口，不带 query 让地址更干净
  router.push({ path: '/start', query: key === 'tasks' ? {} : { entry: key } })
}
</script>

<style scoped>
.entry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.entry-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  text-align: left;
  padding: 14px 16px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;
}
.entry-card:hover, .entry-card:focus-visible {
  border-color: var(--color-primary-500);
  box-shadow: var(--color-shadow-sm);
  transform: translateY(-1px);
}
.entry-card:focus-visible { outline: 2px solid var(--color-border-focus); outline-offset: 2px; }
.entry-index { font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; }
.entry-title { font-size: var(--font-size-md); font-weight: 650; color: var(--color-text-primary); }
.entry-desc { font-size: var(--font-size-sm); line-height: 1.55; color: var(--color-text-secondary); }
.entry-cta { font-size: var(--font-size-xs); color: var(--color-text-brand); margin-top: 2px; }
@media (max-width: 560px) {
  .entry-grid { grid-template-columns: 1fr; }
}
</style>
