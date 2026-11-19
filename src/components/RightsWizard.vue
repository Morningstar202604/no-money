<template>
  <section class="rw" aria-label="三步办事向导">
    <header class="rw-head">
      <span class="rw-kicker">3 步向导 · 不注册</span>
      <h2 class="rw-title">先搞清楚你该办哪几件事</h2>
      <p class="rw-lead">只选城市、身份、想解决的事；不填身份证、不填工资。清单 3–7 条，第一条先告诉你第一步做什么。</p>
      <div v-if="!generated && step === 1" class="rw-quick" role="group" aria-label="常见情况一键清单">
        <span class="rw-quick-label">不知道怎么选？点一个，直接出清单（城市用当前测算城市）：</span>
        <div class="rw-quick-grid">
          <button
            v-for="o in QUICK_OPTIONS"
            :key="o.value"
            type="button"
            class="rw-quick-card"
            @click="quickStart(o.value)"
          >
            <b>{{ o.label }}</b>
            <span>{{ o.hint }}</span>
          </button>
        </div>
      </div>
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
        共 {{ result.length }} 条。先办第 1 件，其余按顺序来；不用一次全做完。每条都写了第一步、时限和官方入口。具体金额/比例以你当地最新文件为准，本平台不代办、不代缴。
      </p>

      <CityServiceLinks v-if="resolvedChannel" :city="city" />
      <p v-else class="rw-local">
        还没收录这个城市的省级入口。先拨 <b>12333</b> 问当地社保/医保经办地址，
        或打开「国家社会保险公共服务平台」查全国入口；本平台不代办。
      </p>

      <div class="rw-list">
        <RightsItemCard v-for="(item, index) in result" :key="item.id" :item="item" :rank="index + 1" />
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
  getRightsForSituation,
  type RightsIdentity,
  type RightsItem,
  type RightsSituation,
} from '../data/rights/catalog'
import { resolveServiceChannel } from '../data/cityChannels'

const emit = defineEmits<{ browse: [] }>()
const store = useMainStore()

const step = ref<1 | 2 | 3>(1)
const generated = ref(false)
const city = ref<string | null>(store.work.city || 'guangzhou')
const identity = ref<RightsIdentity>('unsure')
const situation = ref<RightsSituation>('first-job')
const result = ref<RightsItem[]>([])

const QUICK_OPTIONS: { value: RightsSituation; label: string; hint: string }[] = [
  { value: 'first-job', label: '刚入职', hint: '合同、社保、社保卡' },
  { value: 'unemployment', label: '刚离职', hint: '失业登记、失业金、接续' },
  { value: 'social', label: '换城市', hint: '转移、异地就医、公积金' },
  { value: 'trouble', label: '被欠薪/辞退', hint: '取证、监察、仲裁' },
]

const progress = [
  { n: 1, label: '城市' },
  { n: 2, label: '身份' },
  { n: 3, label: '要办的事' },
]

const resolvedChannel = computed(() => resolveServiceChannel(city.value))

const identityLabel = computed(() => IDENTITY_OPTIONS.find((o) => o.value === identity.value)?.label ?? '')
const situationLabel = computed(() => SITUATION_OPTIONS.find((o) => o.value === situation.value)?.label ?? '')
const resultTitle = computed(() =>
  identity.value === 'unsure' ? situationLabel.value : `${identityLabel.value} · ${situationLabel.value}`,
)

function quickStart(value: RightsSituation) {
  situation.value = value
  identity.value = value === 'first-job' ? 'new-grad' : 'unsure'
  generate()
}

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
.rw-quick { margin-top: 10px; padding: 10px 12px; border: 1px dashed var(--color-border-primary); border-radius: var(--radius-md); background: var(--color-bg-secondary); }
.rw-quick-label { display: block; margin-bottom: 7px; font-size: var(--font-size-xs); line-height: 1.5; color: var(--color-text-tertiary); }
.rw-quick-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.rw-quick-card {
  display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
  padding: 8px 9px; text-align: left; cursor: pointer;
  background: var(--color-bg-primary); border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-sm); color: var(--color-text-primary);
}
.rw-quick-card b { font-size: var(--font-size-xs); font-weight: 650; }
.rw-quick-card span { font-size: 10px; line-height: 1.45; color: var(--color-text-tertiary); }
.rw-quick-card:hover { border-color: var(--color-primary-500); background: var(--color-primary-50); }
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
.rw-list { display: flex; flex-direction: column; gap: 10px; }
@media (max-width: 700px) {
  .rw-quick-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rw-choices-wide { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  /* 移动端右下角有 AI 悬浮按钮：主操作按钮靠右会被它压住。
     留出 64px 安全区，按钮仍然可见可点。 */
  .rw-actions { padding-right: 64px; }
}
@media (max-width: 480px) {
  .rw-choices, .rw-choices-wide { grid-template-columns: 1fr; }
}
</style>
