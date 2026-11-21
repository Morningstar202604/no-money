<template>
  <article class="kb-hit">
    <div class="kb-head">
      <n-tag size="tiny" :bordered="false" :type="typeTagType(hit.entry.type)">{{ KB_TYPE_LABELS[hit.entry.type] }}</n-tag>
      <span class="kb-cat">{{ hit.entry.category }}</span>
      <span v-if="hit.entry.docNo" class="kb-doc">{{ hit.entry.docNo }}</span>
      <span v-if="hit.entry.confidence" class="kb-conf">{{ hit.entry.confidence }}</span>
    </div>
    <h4 class="kb-title">{{ hit.entry.title }}</h4>
    <p class="kb-snippet">{{ hit.snippet }}</p>
    <div v-if="hit.entry.numbers.length" class="kb-nums">
      <span v-for="(n, i) in hit.entry.numbers.slice(0, 4)" :key="i" class="kb-num">
        {{ n.label }} <b>{{ n.value }}</b>
      </span>
    </div>
    <OfficialLinks :links="hit.entry.links" :max="3" />
  </article>
</template>

<script setup lang="ts">
import { NTag } from 'naive-ui'
import OfficialLinks from './OfficialLinks.vue'
import { KB_TYPE_LABELS, type KbEntryType, type KbHit } from '../utils/knowledge'

defineProps<{ hit: KbHit }>()

function typeTagType(t: KbEntryType) {
  if (t === 'policy') return 'info'
  if (t === 'guide') return 'success'
  if (t === 'reality') return 'warning'
  return 'default'
}
</script>

<style scoped>
.kb-hit {
  padding: 10px 0;
  border-bottom: 1px solid var(--color-bg-tertiary);
}
.kb-hit:last-child { border-bottom: none; }

.kb-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}
.kb-cat { font-size: 11px; color: var(--color-text-tertiary); }
.kb-doc {
  font-size: 10px; font-weight: 600; color: var(--color-text-brand);
  background: var(--color-bg-brand-light); border-radius: 3px; padding: 1px 6px;
}
.kb-conf { font-size: 10px; color: var(--color-text-tertiary); }

.kb-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 4px;
  line-height: 1.5;
}

.kb-snippet {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.65;
  margin: 0 0 6px;
}

.kb-nums { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-bottom: 6px; }
.kb-num { font-size: 11px; color: var(--color-text-tertiary); }
.kb-num b { color: var(--color-text-primary); font-weight: 600; font-variant-numeric: tabular-nums; }

</style>
