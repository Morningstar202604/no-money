<!--
/**
 * 本地官方入口卡：只在 10 个深核城市出现。
 *
 * 设计目标：用户选完城市后，不用自己猜「社保去哪个网站、医保去哪个网站」；
 * 四个入口一次摊开，点进去就能在官网里找到个人办事。
 */
-->

<script setup lang="ts">
import { computed } from 'vue'
import { cityServiceEntries, resolveServiceChannel } from '../data/cityChannels'

const props = defineProps<{ city: string | null | undefined }>()

const resolved = computed(() => resolveServiceChannel(props.city))
const entries = computed(() => (resolved.value ? cityServiceEntries(resolved.value) : []))
</script>

<template>
  <section v-if="resolved" class="csl stack-sm" aria-label="官方办事入口">
    <header class="csl-head">
      <div>
        <span class="csl-kicker">
          {{ resolved.level === 'city' ? '本地官方入口' : '省级官方入口' }} ·
          {{ resolved.level === 'city' ? resolved.city : resolved.province }}
        </span>
        <h4 class="csl-title">
          {{ resolved.level === 'city' ? '社保、医保、公积金、就业，各去各的官网' : '你所在城市暂未深核，先用省级入口' }}
        </h4>
      </div>
      <span v-if="resolved.lastVerified" class="csl-verified">{{ resolved.lastVerified }} 核验</span>
    </header>

    <div class="csl-grid">
      <component
        :is="entry.link.url ? 'a' : 'div'"
        v-for="entry in entries"
        :key="entry.key"
        class="csl-card surface-card"
        :class="{ 'is-text-only': !entry.link.url }"
        :href="entry.link.url || undefined"
        :target="entry.link.url ? '_blank' : undefined"
        :rel="entry.link.url ? 'noopener noreferrer' : undefined"
      >
        <span class="csl-key">{{ entry.label }}</span>
        <strong class="csl-name">{{ entry.link.name }}</strong>
        <span v-if="entry.link.note" class="csl-note">{{ entry.link.note }}</span>
        <span class="csl-go">{{ entry.link.url ? '打开官网 ↗' : '暂无直达链接，按说明找' }}</span>
      </component>
    </div>

    <p class="csl-foot">
      <template v-if="resolved.level === 'city'">
        只放官网首页/栏目页，不放容易失效的办件深链；具体入口以站内「个人服务」为准。
      </template>
      <template v-else>
        省级入口只给政务/人社官网；市级具体经办地址以站内说明或 12333 为准，本平台不代办。
      </template>
      热线 {{ resolved.hotlines }}。金额、比例、缴费基数以当地最新文件为准。
    </p>
  </section>
</template>

<style scoped>
.csl {
  padding: 10px 12px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-left: 3px solid var(--color-primary-500);
  border-radius: var(--radius-sm);
}
.csl-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.csl-kicker { font-size: var(--font-size-xs); color: var(--color-text-brand); letter-spacing: .02em; }
.csl-title { margin: 2px 0 0; font-size: var(--font-size-sm); line-height: 1.45; color: var(--color-text-primary); }
.csl-verified { flex: none; font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.csl-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.csl-card {
  display: flex; flex-direction: column; gap: 2px; min-width: 0;
  padding: 8px 9px; text-decoration: none;
  color: var(--color-text-primary);
}
.csl-card:hover { border-color: var(--color-primary-500); background: var(--color-primary-50); }
.csl-card.is-text-only { background: var(--color-bg-secondary); }
.csl-key { font-size: var(--font-size-xs); color: var(--color-text-brand); }
.csl-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--font-size-sm); font-weight: 600; }
.csl-note { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.csl-go { margin-top: 2px; font-size: var(--font-size-xs); color: var(--color-text-brand); }
.csl-foot { margin: 0; font-size: var(--font-size-xs); line-height: 1.6; color: var(--color-text-tertiary); }
@media (max-width: 700px) {
  .csl-grid { grid-template-columns: 1fr; }
  .csl-head { flex-direction: column; gap: 2px; }
}
</style>
