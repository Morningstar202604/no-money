/**
 * /admin 与 /audit 共用的指标卡网格。
 *
 * 两页此前各自手写 6 张 `.metric` 卡：标签、数值、脚注、色调类名逐字重复，
 * 新增一个指标就要在两个页面各抄一遍。这里只保留「数据 → 卡片」的渲染，
 * 每个指标的含义仍由各自页面决定（全库口径 vs 7 项核心字段口径不可混）。
 */
<script setup lang="ts">
interface MetricItem {
  label: string
  value: string | number
  /** 脚注，如分子/分母 */
  note?: string
  /** 数值色调：成功 / 推算 / 警告 */
  tone?: 'ok' | 'derived' | 'warn'
}

defineProps<{
  items: MetricItem[]
}>()
</script>

<template>
  <div class="metric-row">
    <div v-for="item in items" :key="item.label" class="metric">
      <span class="metric-label">{{ item.label }}</span>
      <span class="metric-value" :class="item.tone">{{ item.value }}</span>
      <span v-if="item.note" class="metric-note">{{ item.note }}</span>
    </div>
  </div>
</template>

<style scoped>
.metric-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.metric {
  padding: var(--space-4);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.metric-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.metric-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  font-family: var(--font-family-num);
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}

.metric-note {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.metric-value.ok { color: var(--color-text-success); }
.metric-value.derived { color: var(--color-text-info); }
.metric-value.warn { color: var(--color-text-warning); }

@media (max-width: 900px) {
  .metric-row { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 640px) {
  .metric-row { grid-template-columns: 1fr; }
}
</style>
