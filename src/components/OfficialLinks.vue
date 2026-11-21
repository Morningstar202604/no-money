<template>
  <div v-if="visible.length" class="official-links">
    <span v-if="label" class="official-links-label">{{ label }}</span>
    <a
      v-for="(link, index) in visible"
      :key="`${link.url}-${index}`"
      class="official-link"
      :href="link.url"
      target="_blank"
      rel="noopener noreferrer"
      :title="link.url"
    >{{ link.docNo ? `${link.docNo} · ` : '' }}{{ link.title }} ↗</a>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface OfficialLink {
  title: string
  url: string
  docNo?: string
}

const props = withDefaults(defineProps<{
  links: readonly OfficialLink[]
  /** 链接组前的说明，如「官方原文」「原文」；不传则只显示链接 */
  label?: string
  /** 最多显示几条；超出部分不渲染（知识库命中卡片只展示前 3 条） */
  max?: number
}>(), {
  label: '',
  max: Number.POSITIVE_INFINITY,
})

const visible = computed(() => props.links.slice(0, props.max))
</script>

<style scoped>
/*
 * 官方原文链接的统一形态。
 * 民生手册、知识库命中、现实核查三处此前各写一份 .gc-link / .kb-link / .rf-link，
 * 字号、下划线透明度、hover 颜色已经开始分叉；这里收敛为一份。
 */
.official-links {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  margin-top: 4px;
}

.official-links-label {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.official-link {
  font-size: 11px;
  color: var(--color-text-brand);
  text-decoration: none;
  border-bottom: 1px solid rgba(45, 212, 191, 0.35);
  line-height: 1.6;
}

.official-link:hover {
  border-bottom-color: var(--color-text-brand);
}
</style>
