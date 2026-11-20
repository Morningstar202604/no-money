<template>
  <article class="right-card surface-card" :class="{ 'is-done': done, 'is-first': rank === 1 }">
    <div class="rc-top">
      <div class="rc-left">
        <span v-if="rank" class="rc-order" :class="{ first: rank === 1 }">
          {{ rank === 1 ? '第 1 件 · 先办这个' : `第 ${rank} 件` }}
        </span>
        <span class="rc-cat">{{ categoryLabel }}</span>
      </div>
      <div class="rc-badges">
        <span class="rc-level" :class="`level-${item.level.toLowerCase()}`">{{ levelLabel }}</span>
        <span class="rc-conf" :class="`conf-${item.confidence}`">{{ confidenceLabel }}</span>
      </div>
    </div>
    <h3 class="rc-title">{{ item.title }}</h3>
    <p class="rc-one">{{ item.oneLiner }}</p>

    <div v-if="item.whatToDo.length" class="rc-block">
      <span class="rc-label">第一步</span>
      <span class="rc-text">{{ item.whatToDo[0] }}</span>
    </div>
    <div v-if="item.whatToGet.length" class="rc-block">
      <span class="rc-label">能拿什么</span>
      <span class="rc-text">{{ item.whatToGet.slice(0, 2).join('；') }}</span>
    </div>
    <div class="rc-meta">
      <span v-if="item.deadline"><b>时限：</b>{{ item.deadline }}</span>
      <span><b>去哪办：</b>{{ item.whereToGo }}</span>
    </div>
    <div v-if="item.caution" class="rc-caution">{{ item.caution }}</div>

    <details v-if="hasDetail" class="rc-detail">
      <summary>展开完整步骤 / 材料 / 依据</summary>
      <!-- 手册迁移条目直接复用同一张 GuideCard：正文只在 livingGuide 维护一份 -->
      <GuideCard v-if="guideItem" :item="guideItem" />
      <template v-else>
        <ol class="rc-steps">
          <li v-for="(step, i) in item.whatToDo" :key="i">{{ step }}</li>
        </ol>
        <div v-if="item.materials?.length" class="rc-sub">
          <b>材料：</b>{{ item.materials.join('、') }}
        </div>
        <div v-if="item.whatToGet.length > 2" class="rc-sub">
          <b>还能拿：</b>{{ item.whatToGet.slice(2).join('；') }}
        </div>
        <div v-if="item.sourceTitle" class="rc-sub">
          <b>依据：</b>{{ item.sourceTitle }}
        </div>
      </template>
    </details>

    <div class="rc-actions">
      <a
        v-if="item.officialUrl"
        class="rc-link"
        :href="item.officialUrl"
        target="_blank"
        rel="noopener noreferrer"
      >官方入口 ↗</a>
      <span v-else class="rc-no-link">暂无官方入口，先拨 12333 确认</span>
      <span class="rc-verify">核验：{{ item.lastVerified }}</span>
    </div>

    <div class="rc-track">
      <button
        type="button"
        class="rc-track-btn"
        :class="{ on: saved }"
        :aria-pressed="saved"
        @click="checklist.toggleSaved(item.id)"
      >
        {{ saved ? '已加入清单' : '加入清单' }}
      </button>
      <button
        type="button"
        class="rc-track-btn rc-track-done"
        :class="{ on: done }"
        :aria-pressed="done"
        @click="checklist.toggleDone(item.id)"
      >
        {{ done ? '已办 ✓' : '标记已办' }}
      </button>
      <button
        type="button"
        class="rc-track-btn rc-track-share"
        :disabled="sharing"
        @click="onShare"
      >
        {{ sharing ? '分享中…' : '分享这条' }}
      </button>
      <span class="rc-track-hint">只存本机，不注册</span>
      <span v-if="shareFeedback" class="rc-share-feedback" role="status">{{ shareFeedback }}</span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RIGHTS_CATEGORY_LABELS, type RightsItem } from '../data/rights/catalog'
import GuideCard from './GuideCard.vue'
import { GUIDE_ITEMS } from '../utils/livingGuide'
import { buildRightsShareText, shareErrorMessage, shareRightsText } from '../utils/rightsShare'
import { useRightsChecklistStore } from '../stores/rightsChecklist'

const props = defineProps<{ item: RightsItem; rank?: number }>()
const GUIDE_BY_ID = new Map(GUIDE_ITEMS.map((guide) => [guide.id, guide]))
const guideItem = computed(() => (props.item.guideId ? GUIDE_BY_ID.get(props.item.guideId) : undefined))

const CONFIDENCE_LABELS: Record<RightsItem['confidence'], string> = {
  official: '官方原文',
  derived: '按规则推算',
  platform: '平台数据',
  unverified: '待核实',
}

const categoryLabel = computed(() => RIGHTS_CATEGORY_LABELS[props.item.category])
const confidenceLabel = computed(() => CONFIDENCE_LABELS[props.item.confidence])
const levelLabel = computed(() => (props.item.level === 'L2' ? 'L2 可办' : 'L1 知道'))
const hasDetail = computed(
  () =>
    Boolean(guideItem.value) ||
    props.item.whatToDo.length > 1 ||
    Boolean(props.item.materials?.length) ||
    props.item.whatToGet.length > 2 ||
    Boolean(props.item.sourceTitle),
)

const checklist = useRightsChecklistStore()
const saved = computed(() => checklist.isSaved(props.item.id))
const done = computed(() => checklist.isDone(props.item.id))

const sharing = ref(false)
const shareFeedback = ref('')
let feedbackTimer: ReturnType<typeof setTimeout> | undefined
async function onShare() {
  if (sharing.value) return
  sharing.value = true
  try {
    const mode = await shareRightsText(props.item.title, buildRightsShareText(props.item))
    shareFeedback.value = mode === 'shared' ? '已打开系统分享' : '已复制分享文案，可发给工友'
    if (feedbackTimer) clearTimeout(feedbackTimer)
    feedbackTimer = setTimeout(() => { shareFeedback.value = '' }, 3000)
  } catch (error) {
    const message = shareErrorMessage(error)
    if (message) shareFeedback.value = message
  } finally {
    sharing.value = false
  }
}
</script>

<style scoped>
.right-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
}
.right-card.is-first { border-color: var(--color-primary-500); box-shadow: 0 0 0 1px var(--color-primary-100) inset; }
.right-card.is-done { border-color: var(--color-success-500); background: var(--color-success-50); }
.rc-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rc-left { display: flex; align-items: center; gap: 6px; min-width: 0; flex-wrap: wrap; }
.rc-order { font-size: 10px; line-height: 1.4; color: var(--color-text-tertiary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-full); padding: 1px 7px; }
.rc-order.first { color: var(--color-text-brand); border-color: var(--color-primary-500); background: var(--color-primary-50); font-weight: 650; }
.rc-cat {
  font-size: var(--font-size-xs);
  color: var(--color-text-brand);
  background: var(--color-primary-100);
  border-radius: var(--radius-full);
  padding: 2px 8px;
}
.rc-badges { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.rc-level {
  font-size: 10px;
  line-height: 1.4;
  border-radius: var(--radius-full);
  padding: 1px 7px;
  border: 1px solid var(--color-border-primary);
  color: var(--color-text-tertiary);
}
.rc-level.level-l2 { color: var(--color-success-700); border-color: var(--color-success-500); background: var(--color-success-50); }
.rc-conf { font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.rc-conf.conf-official { color: var(--color-success-600); }
.rc-conf.conf-unverified { color: var(--color-warning-600); }
.rc-title { margin: 0; font-size: var(--font-size-md); line-height: 1.4; color: var(--color-text-primary); }
.rc-one { margin: 0; font-size: var(--font-size-sm); line-height: 1.65; color: var(--color-text-secondary); }
.rc-block { display: flex; gap: 8px; font-size: var(--font-size-sm); line-height: 1.6; }
.rc-label { flex: 0 0 auto; color: var(--color-text-tertiary); }
.rc-text { color: var(--color-text-primary); }
.rc-meta { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: var(--font-size-xs); line-height: 1.6; color: var(--color-text-tertiary); }
.rc-caution {
  font-size: var(--font-size-xs);
  line-height: 1.6;
  color: var(--color-warning-700);
  background: var(--color-warning-50);
  border-left: 3px solid var(--color-warning-500);
  padding: 6px 8px;
  border-radius: var(--radius-sm);
}
.rc-detail {
  border-top: 1px dashed var(--color-border-primary);
  padding-top: 8px;
  font-size: var(--font-size-xs);
  line-height: 1.65;
  color: var(--color-text-secondary);
}
.rc-detail summary {
  cursor: pointer;
  color: var(--color-text-brand);
  min-height: 32px;
  display: flex;
  align-items: center;
}
.rc-steps { margin: 6px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 5px; }
.rc-sub { margin-top: 6px; }
.rc-sub b { color: var(--color-text-tertiary); font-weight: 600; }
.rc-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; }
.rc-link { font-size: var(--font-size-sm); color: var(--color-text-brand); text-decoration: none; }
.rc-link:hover { text-decoration: underline; }
.rc-no-link { font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.rc-verify { font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.rc-track {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  border-top: 1px solid var(--color-border-primary);
  padding-top: 8px;
}
.rc-track-btn {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-full);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  cursor: pointer;
}
.rc-track-btn:disabled { cursor: wait; opacity: .65; }
.rc-track-share { color: var(--color-text-brand); }
.rc-track-btn.on { border-color: var(--color-primary-500); color: var(--color-text-brand); background: var(--color-primary-50); }
.rc-track-done.on { border-color: var(--color-success-500); color: var(--color-success-700); background: var(--color-success-50); }
.rc-track-hint { margin-left: auto; font-size: 10px; color: var(--color-text-tertiary); }
.rc-share-feedback { flex-basis: 100%; font-size: var(--font-size-xs); color: var(--color-success-700); }
@media (max-width: 480px) {
  .rc-track-hint { margin-left: 0; }
}
</style>
