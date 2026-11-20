<template>
  <div class="guides">
    <PageHeading />

    <section class="guides-hero">
      <span class="guides-kicker">怎么弄</span>
      <h2 class="guides-title">照着这张清单办，不用再到处问</h2>
      <p class="guides-lead">
        这里只收有材料、有步骤、有时限、有官方入口的 L2 教程。先选一个分类，再挑和你现在最相关的一条；
        没写金额的，一律以当地经办机构核定为准。
      </p>
      <div class="guides-facts">
        <span>{{ items.length }} 条可办教程</span>
        <span>{{ filters.length - 1 }} 个分类</span>
        <span>{{ officialCount }} 条带官方入口</span>
      </div>
    </section>

    <section class="guides-filter" aria-label="教程分类">
      <button
        v-for="filter in filters"
        :key="filter.key"
        type="button"
        class="guides-chip"
        :class="{ active: category === filter.key }"
        :aria-pressed="category === filter.key"
        @click="setCategory(filter.key)"
      >
        {{ filter.label }}
        <span>{{ filter.count }}</span>
      </button>
    </section>

    <n-alert v-if="!items.length" type="info" :show-icon="true">
      这个分类还没有 L2 教程。先回「该做什么」看清单，或到「政策与数据」查官方原文。
    </n-alert>

    <section v-else class="guides-list" aria-label="可办教程列表">
      <RightsItemCard v-for="item in items" :key="item.id" :item="item" />
    </section>

    <p class="guides-foot">
      只列能直接照着办的 L2；L1「知道有这件事」的条目在
      <a href="/start" @click.prevent="router.push('/start')">该做什么</a>
      里，不在这里凑数。
    </p>
  </div>
</template>

<script setup lang="ts">
import { createPageHeading } from '../components/PageHeading'
const PageHeading = createPageHeading('guides')

import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NAlert } from 'naive-ui'
import RightsItemCard from '../components/RightsItemCard.vue'
import { guideFilters, guidesForCategory, type GuideFilterKey } from '../data/rights/guides'

const router = useRouter()
const route = useRoute()
const filters = guideFilters()

function readCategory(): GuideFilterKey {
  const q = route.query.cat
  return typeof q === 'string' && filters.some((filter) => filter.key === q)
    ? (q as GuideFilterKey)
    : 'all'
}

const category = ref<GuideFilterKey>(readCategory())
const items = computed(() => guidesForCategory(category.value))
const officialCount = computed(() => items.value.filter((item) => item.officialUrl).length)

watch(() => route.query.cat, () => { category.value = readCategory() })

function setCategory(next: GuideFilterKey) {
  category.value = next
  void router.replace({ path: '/guides', query: next === 'all' ? {} : { cat: next } })
}
</script>

<style scoped>
.guides { display: flex; flex-direction: column; gap: 14px; padding-bottom: 8px; }
.guides-hero {
  display: flex; flex-direction: column; gap: 8px;
  padding: 22px 24px;
  background: linear-gradient(135deg, var(--color-bg-brand-light), var(--color-bg-primary));
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
}
.guides-kicker { font-size: var(--font-size-xs); color: var(--color-text-brand); letter-spacing: .08em; }
.guides-title { margin: 0; font-size: calc(var(--font-size-xl) + 4px); line-height: 1.35; color: var(--color-text-primary); }
.guides-lead { margin: 0; max-width: 780px; font-size: var(--font-size-md); line-height: 1.75; color: var(--color-text-secondary); }
.guides-facts { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 4px; font-size: var(--font-size-xs); color: var(--color-text-brand); }
.guides-filter { display: flex; flex-wrap: wrap; gap: 8px; }
.guides-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 12px; border: 1px solid var(--color-border-primary); border-radius: 999px;
  background: var(--color-bg-primary); color: var(--color-text-secondary);
  font-size: var(--font-size-sm); cursor: pointer;
}
.guides-chip span { color: var(--color-text-tertiary); font-size: var(--font-size-xs); }
.guides-chip.active { border-color: var(--color-primary-500); background: var(--color-primary-50); color: var(--color-primary-600); font-weight: 650; }
.guides-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; align-items: start; }
.guides-foot { margin: 2px 0 0; font-size: var(--font-size-xs); line-height: 1.7; color: var(--color-text-tertiary); }
.guides-foot a { color: var(--color-primary-600); text-decoration: underline; }
@media (max-width: 640px) {
  .guides-hero { padding: 18px; }
  .guides-title { font-size: var(--font-size-xl); }
  .guides-list { grid-template-columns: 1fr; }
}
</style>
