<template>
  <section class="rw" aria-label="三步办事向导">
    <header class="rw-head">
      <span class="rw-kicker">3 步向导 · 不注册</span>
      <h2 class="rw-title">先搞清楚你该办哪几件事</h2>
      <p class="rw-lead">只选城市、身份、想解决的事；不填身份证、不填工资。清单 3–7 条，第一条先告诉你第一步做什么。</p>
    </header>

    <div class="rw-progress" aria-hidden="true">
      <span v-for="p in progress" :key="p.n" class="rw-dot" :class="{ done: step > p.n, active: step === p.n }">
        <b>{{ p.n }}</b>{{ p.label }}
      </span>
    </div>

    <div v-if="step === 1" class="rw-step">
      <label class="rw-label" for="rw-city">你在哪个城市工作 / 参保？</label>
      <n-select
        id="rw-city"
        v-model:value="city"
        :options="CITY_OPTIONS"
        filterable
        placeholder="选城市"
        style="max-width: 360px"
      />
      <p class="rw-hint">只用于给你本地办事入口；不会改你左侧当前的测算城市。</p>
      <div class="rw-actions">
        <n-button type="primary" :disabled="!city" @click="step = 2">下一步</n-button>
      </div>
    </div>

    <div v-else-if="step === 2" class="rw-step">
      <span class="rw-label">你现在属于哪种情况？</span>
      <div class="rw-choices" role="group" aria-label="选择身份">
        <button
          v-for="o in IDENTITY_OPTIONS"
          :key="o.value"
          type="button"
          class="rw-choice"
          :class="{ active: identity === o.value }"
          :aria-pressed="identity === o.value"
          @click="identity = o.value"
        >
          <b>{{ o.label }}</b>
          <span>{{ o.hint }}</span>
        </button>
      </div>
      <div class="rw-actions">
        <n-button @click="step = 1">上一步</n-button>
        <n-button type="primary" @click="step = 3">下一步</n-button>
      </div>
    </div>

    <div v-else-if="step === 3 && !generated" class="rw-step">
      <span class="rw-label">最近最想解决哪件事？</span>
      <div class="rw-choices rw-choices-wide" role="group" aria-label="选择要办的事">
        <button
          v-for="o in SITUATION_OPTIONS"
          :key="o.value"
          type="button"
          class="rw-choice"
          :class="{ active: situation === o.value }"
          :aria-pressed="situation === o.value"
          @click="situation = o.value"
        >
          <b>{{ o.label }}</b>
          <span>{{ o.hint }}</span>
        </button>
      </div>
      <div class="rw-actions">
        <n-button @click="step = 2">上一步</n-button>
        <n-button type="primary" @click="generate">生成我的清单</n-button>
      </div>
    </div>

    <div v-else class="rw-result">
      <div class="rw-result-head">
        <div>
          <span class="rw-kicker">你的清单</span>
          <h3 class="rw-result-title">{{ resultTitle }}</h3>
        </div>
        <n-button text size="small" @click="reset">重新选</n-button>
      </div>

      <p class="rw-result-lead">
        共 {{ result.length }} 条。先做前 3 条；每条都写了第一步、时限和官方入口。具体金额/比例以你当地最新文件为准，本平台不代办、不代缴。
      </p>

      <CityServiceLinks v-if="cityChannel" :city="city" />
      <div v-else-if="provinceChannel" class="rw-local">
        <b>省级入口：</b>
        <span>{{ provinceChannel.portalName }} · {{ provinceChannel.hrssName }}</span>
        <span class="rw-local-medical">医保：{{ provinceChannel.medicalChannel }}</span>
        <a v-if="provinceChannel.portalUrl" :href="provinceChannel.portalUrl" target="_blank" rel="noopener noreferrer">打开政务入口 ↗</a>
        <span class="rw-local-more">你所在城市暂未做市级深核；可先用省级入口，或拨 12333 问市级经办地址。</span>
      </div>

      <div class="rw-list">
        <RightsItemCard v-for="item in result" :key="item.id" :item="item" />
      </div>

      <div class="rw-actions rw-actions-end">
        <n-button @click="reset">重新选</n-button>
        <n-button type="primary" ghost @click="browse">看全部条目</n-button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NSelect } from 'naive-ui'
import { CITY_OPTIONS } from '../data/cities'
import { useMainStore } from '../stores/main'
import RightsItemCard from './RightsItemCard.vue'
import CityServiceLinks from './CityServiceLinks.vue'
import {
  IDENTITY_OPTIONS,
  SITUATION_OPTIONS,
  getProvinceChannel,
  getRightsForSituation,
  type RightsIdentity,
  type RightsItem,
  type RightsSituation,
} from '../data/rights/catalog'
import { cityChannelOf } from '../data/cityChannels'

const emit = defineEmits<{ browse: [] }>()
const store = useMainStore()

const step = ref<1 | 2 | 3>(1)
const generated = ref(false)
const city = ref<string | null>(store.work.city || 'guangzhou')
const identity = ref<RightsIdentity>('unsure')
const situation = ref<RightsSituation>('first-job')
const result = ref<RightsItem[]>([])

const progress = [
  { n: 1, label: '城市' },
  { n: 2, label: '身份' },
  { n: 3, label: '要办的事' },
]

const cityChannel = computed(() => cityChannelOf(city.value))
const provinceChannel = computed(() => getProvinceChannel(city.value))

const identityLabel = computed(() => IDENTITY_OPTIONS.find((o) => o.value === identity.value)?.label ?? '')
const situationLabel = computed(() => SITUATION_OPTIONS.find((o) => o.value === situation.value)?.label ?? '')
const resultTitle = computed(() => `${identityLabel.value} · ${situationLabel.value}`)

function generate() {
  result.value = getRightsForSituation(city.value, identity.value, situation.value)
  generated.value = true
  step.value = 3
}

function reset() {
  generated.value = false
  result.value = []
  step.value = 1
}

function browse() {
  emit('browse')
}
</script>

<style scoped>
.rw {
  padding: 18px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
}
.rw-head { display: flex; flex-direction: column; gap: 4px; }
.rw-kicker { font-size: var(--font-size-xs); color: var(--color-text-brand); letter-spacing: .04em; }
.rw-title { margin: 0; font-size: var(--font-size-xl); line-height: 1.3; color: var(--color-text-primary); }
.rw-lead { margin: 2px 0 0; font-size: var(--font-size-sm); line-height: 1.65; color: var(--color-text-secondary); }
.rw-progress { display: flex; gap: 8px; margin: 14px 0 4px; flex-wrap: wrap; }
.rw-dot {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: var(--font-size-xs); color: var(--color-text-tertiary);
  border: 1px solid var(--color-border-primary); border-radius: var(--radius-full); padding: 3px 9px;
}
.rw-dot b { font-weight: 650; }
.rw-dot.active { color: var(--color-text-brand); border-color: var(--color-primary-500); background: var(--color-primary-50); }
.rw-dot.done { color: var(--color-success-600); border-color: var(--color-success-600); }
.rw-step { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
.rw-label { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-primary); }
.rw-hint { margin: 0; font-size: var(--font-size-xs); line-height: 1.6; color: var(--color-text-tertiary); }
.rw-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.rw-choices-wide { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.rw-choice {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
  padding: 10px 12px; text-align: left; cursor: pointer;
  background: var(--color-bg-secondary); border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md); color: var(--color-text-primary);
}
.rw-choice b { font-size: var(--font-size-sm); font-weight: 600; }
.rw-choice span { font-size: var(--font-size-xs); line-height: 1.5; color: var(--color-text-tertiary); }
.rw-choice.active { border-color: var(--color-primary-500); background: var(--color-primary-50); }
.rw-choice.active b { color: var(--color-text-brand); }
.rw-actions { display: flex; justify-content: space-between; gap: 8px; margin-top: 6px; }
.rw-actions-end { justify-content: flex-end; }
.rw-result { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
.rw-result-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.rw-result-title { margin: 2px 0 0; font-size: var(--font-size-lg); color: var(--color-text-primary); }
.rw-result-lead { margin: 0; font-size: var(--font-size-sm); line-height: 1.65; color: var(--color-text-secondary); }
.rw-local {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px 10px; font-size: var(--font-size-xs); line-height: 1.55;
  background: var(--color-bg-secondary); border-left: 3px solid var(--color-primary-500); border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
}
.rw-local b { color: var(--color-text-primary); }
.rw-local a { color: var(--color-text-brand); }
.rw-local-more { color: var(--color-text-tertiary); }
.rw-list { display: flex; flex-direction: column; gap: 10px; }
@media (max-width: 700px) {
  .rw-choices-wide { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  /* 移动端右下角有 AI 悬浮按钮：主操作按钮靠右会被它压住。
     留出 64px 安全区，按钮仍然可见可点。 */
  .rw-actions { padding-right: 64px; }
}
@media (max-width: 480px) {
  .rw-choices, .rw-choices-wide { grid-template-columns: 1fr; }
}
</style>
