<template>
  <div class="reality-list">
    <div v-for="f in facts" :key="f.id" class="rf-item">
      <div class="rf-head">
        <n-tag size="tiny" :bordered="false" :type="evidenceTagType(f.evidence)">
          {{ EVIDENCE_LABELS[f.evidence] }}
        </n-tag>
        <strong class="rf-title">{{ f.title }}</strong>
      </div>
      <p v-if="f.detail" class="rf-detail">{{ f.detail }}</p>
      <p v-if="f.source" class="rf-line"><span class="rf-k">依据</span>{{ f.source }}</p>
      <p v-if="f.verify" class="rf-line"><span class="rf-k">自验</span>{{ f.verify }}</p>
      <OfficialLinks :links="f.links ?? []" label="原文" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { NTag } from 'naive-ui'
import { EVIDENCE_LABELS, type EvidenceLevel, type RealityFact } from '../utils/reality'
import OfficialLinks from './OfficialLinks.vue'

defineProps<{ facts: RealityFact[] }>()

function evidenceTagType(e: EvidenceLevel) {
  if (e === 'law') return 'success'
  if (e === 'official') return 'info'
  if (e === 'media') return 'warning'
  return 'default'
}
</script>

<style scoped>
.reality-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rf-item {
  padding: 10px 0;
  border-bottom: 1px solid var(--color-bg-tertiary);
}

.rf-item:last-child {
  border-bottom: none;
}

.rf-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

.rf-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.rf-detail {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.65;
  margin: 0 0 4px;
}

.rf-line {
  font-size: 11px;
  color: var(--color-text-tertiary);
  line-height: 1.6;
  margin: 0;
}

.rf-k {
  display: inline-block;
  margin-right: 4px;
  padding: 0 5px;
  border: 1px solid var(--color-border-primary);
  border-radius: 3px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

</style>
