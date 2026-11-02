<template>
  <div class="skeleton-group" role="status" aria-live="polite" :aria-label="label">
    <span class="sr-only">{{ label }}</span>
    <!-- 骨架屏必须与真实内容同构：形状对不上时，内容到位会"跳一下"，比不显示还难受 -->
    <div class="sk-kpi-row">
      <div v-for="i in 4" :key="i" class="sk-kpi">
        <div class="sk-line" style="width: 52%" />
        <div class="sk-line sk-line-lg" style="width: 78%" />
        <div class="sk-line" style="width: 40%" />
      </div>
    </div>
    <div class="sk-card">
      <div class="sk-line" style="width: 24%; height: 14px" />
      <div class="sk-row">
        <div class="sk-block" style="flex: 0 0 168px" />
        <div class="sk-col">
          <div v-for="i in 4" :key="i" class="sk-line" :style="{ width: `${88 - i * 8}%` }" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 加载骨架屏
 *
 * 此前规则未加载时页面是空白 + 一条提示，用户会以为"页面坏了"。
 * 骨架屏传达的是"正在加载，结构已就位"，心理等待时间明显更短。
 *
 * 无障碍：容器带 role=status 与 aria-live，读屏会播报"正在加载"，
 * 而不是让视障用户对着一段无声的空 div 干等。
 */
withDefaults(
  defineProps<{
    label?: string
  }>(),
  { label: '正在加载测算数据' },
)
</script>

<style scoped>
.skeleton-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.sk-kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  background: var(--color-bg-primary);
  overflow: hidden;
}

.sk-kpi {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sk-kpi + .sk-kpi {
  border-left: 1px solid var(--color-border-primary);
}

.sk-card {
  padding: var(--space-5);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  background: var(--color-bg-primary);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.sk-row {
  display: flex;
  gap: var(--space-5);
  align-items: flex-start;
}

.sk-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sk-block {
  height: 120px;
  border-radius: var(--radius-md);
}

.sk-line,
.sk-block {
  background: linear-gradient(
    90deg,
    var(--surface-2) 0%,
    var(--surface-3) 50%,
    var(--surface-2) 100%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-sm);
  height: 10px;
  animation: sk-shimmer 1.4s var(--ease-in-out) infinite;
}

.sk-line-lg {
  height: 22px;
}

@keyframes sk-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (max-width: 768px) {
  .sk-kpi-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .sk-kpi:nth-child(3) {
    border-left: none;
  }

  .sk-kpi:nth-child(n + 3) {
    border-top: 1px solid var(--color-border-primary);
  }

  .sk-row {
    flex-direction: column;
  }

  .sk-block {
    width: 100%;
    flex: none;
  }
}

/* 减少动效时保留静态占位，不闪烁 */
@media (prefers-reduced-motion: reduce) {
  .sk-line,
  .sk-block {
    animation: none;
  }
}
</style>
