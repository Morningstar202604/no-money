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
import { cityChannelOf, cityServiceEntries } from '../data/cityChannels'

const props = defineProps<{ city: string | null | undefined }>()

const channel = computed(() => cityChannelOf(props.city))
const entries = computed(() => (channel.value ? cityServiceEntries(channel.value) : []))
</script>

<template>
  <section v-if="channel" class="csl" aria-label="本地官方办事入口">
    <header class="csl-head">
      <div>
        <span class="csl-kicker">本地官方入口 · {{ channel.label }}</span>
        <h4 class="csl-title">社保、医保、公积金、就业，各去各的官网</h4>
      </div>
      <span class="csl-verified">{{ channel.lastVerified }} 核验</span>
    </header>

    <div class="csl-grid">
      <a
        v-for="entry in entries"
        :key="entry.key"
        class="csl-card"
        :href="entry.link.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="csl-key">{{ entry.label }}</span>
        <strong class="csl-name">{{ entry.link.name }}</strong>
        <span v-if="entry.link.note" class="csl-note">{{ entry.link.note }}</span>
        <span class="csl-go">打开官网 ↗</span>
      </a>
    </div>

    <p class="csl-foot">
      只放官网首页/栏目页，不放容易失效的办件深链；具体入口以站内「个人服务」为准。
      热线 {{ channel.hotlines }}。金额、比例、缴费基数以当地最新文件为准，本平台不代办。
    </p>
  </section>
</template>

<style scoped>
.csl {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  background: var(--color-bg-primary); border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-sm); color: var(--color-text-primary);
}
.csl-card:hover { border-color: var(--color-primary-500); background: var(--color-primary-50); }
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
