<template>
  <div class="start">
    <PageHeading />

    <section class="start-hero">
      <span class="start-kicker">劳动者权益导航 · 办事入口</span>
      <h2 class="start-title">刚出社会，没人告诉你这些事该先办哪件</h2>
      <p class="start-lead">
        这个平台把「该做什么、能拿什么、去哪办」一条条摊开。先选一个入口，3 步给你 3–7 条清单；
        每条都写第一步、时限和官方入口。算收入只是下面的工具，不是主线。
      </p>
      <p class="start-facts">
        {{ RIGHTS_CATALOG.length }} 条权益 · {{ l2Count }} 条可办清单 · {{ CITY_CHANNELS.length }} 城本地入口已核验
      </p>
      <p class="start-disclaimer">
        不注册、不填身份证/工资；不代办、不代缴。具体金额、比例、截止日期以当地最新文件为准。
      </p>
    </section>

    <section v-if="myItems.length" class="start-mine" aria-label="我的清单">
      <div class="start-mine-head">
        <div>
          <span class="start-mine-kicker">保存在本机 · 不注册</span>
          <h3 class="start-mine-title">我的清单</h3>
        </div>
        <span class="start-mine-count">{{ myDone }} / {{ myItems.length }} 已办</span>
      </div>
      <div
        class="start-mine-progress"
        role="progressbar"
        aria-label="我的清单完成进度"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="myPct"
      ><i :style="{ width: `${myPct}%` }"></i></div>
      <p class="start-mine-desc">下次打开还在；不保存城市、身份、工资，也不上传。</p>
      <p v-if="deadlineItems.length" class="start-mine-deadline">
        <b>先看时限：</b>{{ deadlinePreview }}
      </p>
      <div class="start-mine-list">
        <span
          v-for="item in myItems"
          :key="item.id"
          class="start-mine-chip"
          :class="{ done: checklist.isDone(item.id) }"
        >
          <span class="start-mine-check">{{ checklist.isDone(item.id) ? '✓' : '○' }}</span>
          {{ item.title }}
        </span>
      </div>
      <div class="start-mine-actions">
        <button v-if="myDone" type="button" class="start-mine-btn" @click="checklist.clearDone()">清空已办状态</button>
        <button type="button" class="start-mine-btn" @click="scrollToList">继续看全部条目</button>
        <button type="button" class="start-mine-btn" @click="exportChecklist">导出清单</button>
        <button type="button" class="start-mine-btn" :disabled="sharingChecklist" @click="shareChecklist">
          {{ sharingChecklist ? '分享中…' : '分享清单' }}
        </button>
        <button type="button" class="start-mine-btn" @click="printChecklist">打印清单</button>
      </div>
      <div v-if="myUndone.length" class="start-remind">
        <div class="start-remind-head">
          <b>手机日历提醒</b>
          <span>可选 · 只写进你的日历</span>
        </div>
        <p class="start-remind-desc">给要办的条目选一个日期，导出 .ics；日历会在 3 天前和当天 9:00 提醒。</p>
        <div class="start-remind-list">
          <label v-for="item in myUndone" :key="item.id" class="start-remind-row">
            <span class="start-remind-item">{{ item.title }}</span>
            <input
              class="start-remind-input"
              type="date"
              :min="today"
              :value="checklist.remindAt(item.id) ?? ''"
              :aria-label="`${item.title} 的提醒日期`"
              @change="onReminderChange(item.id, $event)"
            />
          </label>
        </div>
        <div class="start-remind-actions">
          <button
            type="button"
            class="start-mine-btn"
            :disabled="!reminderItems.length"
            @click="exportCalendar"
          >加入手机日历</button>
          <button v-if="reminderItems.length" type="button" class="start-mine-btn" @click="clearReminders">清除全部提醒</button>
          <span v-if="!reminderItems.length" class="start-remind-hint">选了日期才能导出</span>
        </div>
      </div>
      <p v-if="actionNote" class="start-mine-note" role="status">{{ actionNote }}</p>
    </section>

    <div class="start-tabs" role="tablist" aria-label="四个办事入口">
      <button
        v-for="tab in entryTabs"
        :key="tab.key"
        type="button"
        role="tab"
        class="start-tab"
        :class="{ active: entry === tab.key }"
        :aria-selected="entry === tab.key"
        :title="tab.desc"
        @click="setEntry(tab.key)"
      >
        <span class="start-tab-index">{{ tab.index }}</span>
        <span>{{ tab.label }}</span>
      </button>
    </div>
    <p class="start-entry-hint">{{ activeEntry.desc }}</p>

    <section v-if="entry === 'tasks'" class="start-section">
      <RightsWizard @browse="scrollToList" @calc="router.push('/dashboard')" @policy="router.push('/policy')" @ask-ai="openAi" />
      <div ref="listEl" class="start-list-head">
        <h3 class="start-section-title">全部待办条目</h3>
        <p class="start-section-desc">按高频优先列；不是让你一次全办，先挑和你现在最相关的 1–2 条。</p>
      </div>
      <div class="start-list">
        <RightsItemCard v-for="item in list" :key="item.id" :item="item" />
      </div>
    </section>

    <section v-else-if="entry === 'benefits'" class="start-section">
      <div class="start-list-head">
        <h3 class="start-section-title">可能能领到的钱</h3>
        <p class="start-section-desc">先确认自己是否符合条件，再看当地标准。没有官方原文的条目不进来；金额一律写“按当地标准”。</p>
      </div>
      <n-alert type="info" :show-icon="true" style="margin-bottom: 10px">
        这些是“可能领到”，不是“人人都有”。先打 12333 或当地经办机构确认资格，再准备材料。
      </n-alert>
      <div class="start-list">
        <RightsItemCard v-for="item in list" :key="item.id" :item="item" />
      </div>
    </section>

    <section v-else-if="entry === 'social'" class="start-section">
      <div class="start-list-head">
        <h3 class="start-section-title">社保医保：先查状态，再办业务</h3>
        <p class="start-section-desc">参保、断缴、转移、异地就医、退休年限——先看自己缺哪一步，再点官方入口。</p>
      </div>
      <div class="start-quick">
        <button type="button" class="start-quick-card" @click="router.push('/policy?tab=manual')">
          <b>权益速查</b><span>{{ RIGHTS_CATALOG.length }} 条权益 + 官方原文</span>
        </button>
        <button type="button" class="start-quick-card" @click="router.push('/planning')">
          <b>养老测算</b><span>职工/灵活就业缴费与养老金对比</span>
        </button>
        <button type="button" class="start-quick-card" @click="router.push('/policy?tab=province')">
          <b>省级入口</b><span>31 省政务/人社/医保入口</span>
        </button>
      </div>
      <div class="start-list">
        <RightsItemCard v-for="item in list" :key="item.id" :item="item" />
      </div>
    </section>

    <section v-else class="start-section">
      <div class="start-list-head">
        <h3 class="start-section-title">遇到麻烦：先留证据，再走流程</h3>
        <p class="start-section-desc">欠薪、辞退、工伤、扣款——不要只和对方口头拉扯；先把证据固定下来，再找对部门。</p>
      </div>
      <div class="start-quick">
        <button type="button" class="start-quick-card" @click="router.push('/rights')">
          <b>补偿计算</b><span>经济补偿/赔偿金试算</span>
        </button>
        <button type="button" class="start-quick-card" @click="router.push('/rights')">
          <b>维权指南</b><span>5 步流程 + 法援/工会入口</span>
        </button>
        <button type="button" class="start-quick-card" @click="router.push('/rights')">
          <b>文书生成</b><span>仲裁申请书/被迫解除通知等</span>
        </button>
      </div>
      <div class="start-list">
        <RightsItemCard v-for="item in list" :key="item.id" :item="item" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NAlert } from 'naive-ui'
import { createPageHeading } from '../components/PageHeading'
import RightsWizard from '../components/RightsWizard.vue'
import RightsItemCard from '../components/RightsItemCard.vue'
import { RIGHTS_ENTRIES, type RightsEntryKey } from '../data/rights/entries'
import { RIGHTS_CATALOG, rightsForEntry, type RightsItem } from '../data/rights/catalog'
import { CITY_CHANNELS } from '../data/cityChannels'
import { useRightsChecklistStore } from '../stores/rightsChecklist'
import { downloadTextFile } from '../utils/download'
import { buildChecklistIcs } from '../utils/checklistCalendar'
import { buildChecklistHtml, buildChecklistShareText, buildChecklistText } from '../utils/checklistExport'
import { localDateString } from '../utils/localDate'
import { shareErrorMessage, shareRightsText } from '../utils/rightsShare'

const PageHeading = createPageHeading('start')

type EntryKey = RightsEntryKey

const router = useRouter()
const route = useRoute()

const entryTabs = RIGHTS_ENTRIES.map(({ key, index, title, desc }) => ({ key, index, label: title, desc }))

function readEntry(): EntryKey {
  const q = route.query.entry
  return typeof q === 'string' && RIGHTS_ENTRIES.some((item) => item.key === q) ? (q as EntryKey) : 'tasks'
}

const checklist = useRightsChecklistStore()
const entry = ref<EntryKey>(readEntry())
const activeEntry = computed(() => RIGHTS_ENTRIES.find((item) => item.key === entry.value) ?? RIGHTS_ENTRIES[0])
const listEl = ref<HTMLElement | null>(null)
const list = computed<RightsItem[]>(() => rightsForEntry(entry.value))
const l2Count = computed(() => RIGHTS_CATALOG.filter((item) => item.level === 'L2').length)
const myItems = computed<RightsItem[]>(() =>
  RIGHTS_CATALOG.filter((item) => checklist.isSaved(item.id) || checklist.isDone(item.id)),
)
const myDone = computed(() => myItems.value.filter((item) => checklist.isDone(item.id)).length)
const myUndone = computed(() => myItems.value.filter((item) => !checklist.isDone(item.id)))
const myPct = computed(() => (myItems.value.length ? Math.round((myDone.value / myItems.value.length) * 100) : 0))
const today = computed(() => localDateString())
const reminderItems = computed(() => myUndone.value.filter((item) => checklist.remindAt(item.id)))
const deadlineItems = computed(() => myItems.value.filter((item) => item.deadline && !checklist.isDone(item.id)))
const deadlinePreview = computed(() => {
  const shown = deadlineItems.value.slice(0, 3).map((item) => `${item.title}（${item.deadline}）`)
  return deadlineItems.value.length > shown.length ? `${shown.join('；')} 等 ${deadlineItems.value.length} 条` : shown.join('；')
})
const actionNote = ref('')
const sharingChecklist = ref(false)

watch(() => route.query.entry, () => { entry.value = readEntry() })

function setEntry(key: EntryKey) {
  entry.value = key
  void router.replace({ path: '/start', query: key === 'tasks' ? {} : { entry: key } })
}

function scrollToList() {
  void nextTick(() => listEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

function openAi(prompt: string) {
  window.dispatchEvent(new CustomEvent('app:open-ai', { detail: { prompt } }))
}

async function shareChecklist() {
  if (!myItems.value.length || sharingChecklist.value) return
  sharingChecklist.value = true
  try {
    const mode = await shareRightsText(
      '我的办事清单',
      buildChecklistShareText(myItems.value, {
        done: checklist.isDone,
        date: localDateString(),
      }),
    )
    actionNote.value = mode === 'shared' ? '已打开系统分享，可直接发给工友。' : '已复制整张清单，可直接发给工友。'
  } catch (error) {
    const message = shareErrorMessage(error)
    if (message) actionNote.value = message
  } finally {
    sharingChecklist.value = false
  }
}

function exportChecklist() {
  const date = localDateString()
  const ok = downloadTextFile({
    filename: `没钱-我的清单-${date}.txt`,
    content: buildChecklistText(myItems.value, checklist.isDone, date),
  })
  actionNote.value = ok ? '已导出 txt，可打印或发给家人；不含身份证/工资。' : '当前浏览器不支持下载，可改用「打印清单」。'
}

function printChecklist() {
  const win = window.open('', '_blank')
  if (!win) {
    actionNote.value = '浏览器拦截了打印窗口，请允许弹窗，或先「导出清单」。'
    return
  }
  win.document.write(buildChecklistHtml(myItems.value, checklist.isDone))
  win.document.close()
  win.opener = null
  win.focus()
  window.setTimeout(() => win.print(), 200)
  actionNote.value = '已打开打印页；在打印窗口选「另存为 PDF」。'
}

function onReminderChange(id: string, event: Event) {
  const value = (event.target as HTMLInputElement).value
  const saved = checklist.setReminder(id, value)
  actionNote.value = saved
    ? `已设提醒：${saved}；导出日历后生效。`
    : '已清除这条提醒。'
}

function exportCalendar() {
  const content = buildChecklistIcs(myUndone.value, {
    remindAt: checklist.remindAt,
    done: checklist.isDone,
    generatedAt: new Date(),
  })
  if (!content) {
    actionNote.value = '先给至少一条要办的条目选日期，再导出日历。'
    return
  }
  const date = localDateString()
  const ok = downloadTextFile({
    filename: `没钱-办事提醒-${date}.ics`,
    content,
    mimeType: 'text/calendar;charset=utf-8',
  })
  actionNote.value = ok
    ? '已生成 .ics；打开文件后确认加入手机日历。'
    : '当前浏览器不支持下载，可换手机自带浏览器再试。'
}

function clearReminders() {
  for (const item of myUndone.value) checklist.setReminder(item.id, null)
  actionNote.value = '已清除本清单的全部提醒。'
}
</script>

<style scoped>
.start { display: flex; flex-direction: column; gap: 14px; padding-bottom: 8px; }
.start-hero {
  display: flex; flex-direction: column; gap: 8px;
  padding: 22px 24px;
  background: linear-gradient(135deg, var(--color-bg-brand-light), var(--color-bg-primary));
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
}
.start-kicker { font-size: var(--font-size-xs); color: var(--color-text-brand); letter-spacing: .08em; }
.start-title { margin: 0; font-size: calc(var(--font-size-xl) + 4px); line-height: 1.35; color: var(--color-text-primary); }
.start-lead { margin: 0; max-width: 760px; font-size: var(--font-size-md); line-height: 1.75; color: var(--color-text-secondary); }
.start-facts { margin: 6px 0 0; font-size: var(--font-size-xs); color: var(--color-text-brand); }
.start-disclaimer {
  margin: 2px 0 0; font-size: var(--font-size-xs); line-height: 1.6; color: var(--color-text-tertiary);
  border-top: 1px dashed var(--color-border-primary); padding-top: 8px;
}
.start-tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.start-entry-hint { margin: -2px 0 0; font-size: var(--font-size-xs); line-height: 1.6; color: var(--color-text-tertiary); }
.start-tab {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: pointer;
  background: var(--color-bg-primary); border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md); color: var(--color-text-secondary); font-size: var(--font-size-sm);
  text-align: left;
}
.start-tab-index { color: var(--color-text-tertiary); font-size: var(--font-size-xs); }
.start-tab.active { border-color: var(--color-primary-500); background: var(--color-primary-50); color: var(--color-text-primary); font-weight: 650; }
.start-section { display: flex; flex-direction: column; gap: 10px; }
.start-list-head { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; scroll-margin-top: 84px; }
.start-section-title { margin: 0; font-size: var(--font-size-lg); color: var(--color-text-primary); }
.start-section-desc { margin: 0; font-size: var(--font-size-sm); line-height: 1.6; color: var(--color-text-secondary); }
.start-list { display: flex; flex-direction: column; gap: 10px; }
.start-quick { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.start-quick-card {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
  padding: 10px 12px; text-align: left; cursor: pointer;
  background: var(--color-bg-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-md);
}
.start-quick-card b { font-size: var(--font-size-sm); color: var(--color-text-primary); }
.start-quick-card span { font-size: var(--font-size-xs); line-height: 1.5; color: var(--color-text-tertiary); }
.start-quick-card:hover { border-color: var(--color-primary-500); }
.start-mine {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-success-500);
  border-radius: var(--radius-lg);
}
.start-mine-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; }
.start-mine-kicker { font-size: 10px; color: var(--color-text-tertiary); }
.start-mine-title { margin: 0; font-size: var(--font-size-md); color: var(--color-text-primary); }
.start-mine-count { font-size: var(--font-size-xs); color: var(--color-success-700); font-weight: 650; }
.start-mine-progress { height: 6px; background: var(--color-bg-primary); border-radius: var(--radius-full); overflow: hidden; }
.start-mine-progress i { display: block; height: 100%; background: var(--color-success-500); border-radius: inherit; transition: width .2s; }
.start-mine-desc { margin: 0; font-size: var(--font-size-xs); color: var(--color-text-tertiary); line-height: 1.5; }
.start-mine-deadline {
  margin: 0; padding: 7px 9px; border: 1px solid var(--color-warning-500);
  border-radius: var(--radius-md); background: var(--color-bg-primary);
  font-size: var(--font-size-xs); line-height: 1.6; color: var(--color-text-secondary);
}
.start-mine-deadline b { color: var(--color-warning-700); }
.start-mine-note { margin: 0; font-size: var(--font-size-xs); color: var(--color-success-700); }
.start-mine-list { display: flex; flex-wrap: wrap; gap: 6px; }
.start-mine-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-full);
  background: var(--color-bg-primary);
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-secondary);
}
.start-mine-chip.done { border-color: var(--color-success-500); color: var(--color-success-700); }
.start-mine-check { font-size: 10px; }
.start-mine-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.start-mine-btn {
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-full);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  cursor: pointer;
}
.start-mine-btn:hover { border-color: var(--color-primary-500); color: var(--color-text-brand); }
.start-mine-btn:disabled { opacity: .55; cursor: wait; }
.start-remind {
  display: flex; flex-direction: column; gap: 8px;
  padding: 10px 12px;
  border: 1px dashed var(--color-border-primary);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
}
.start-remind-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.start-remind-head b { font-size: var(--font-size-xs); color: var(--color-text-primary); }
.start-remind-head span { font-size: 10px; color: var(--color-text-tertiary); }
.start-remind-desc { margin: 0; font-size: var(--font-size-xs); line-height: 1.6; color: var(--color-text-tertiary); }
.start-remind-list { display: flex; flex-direction: column; gap: 6px; }
.start-remind-row {
  display: grid; grid-template-columns: minmax(0, 1fr) 150px; gap: 8px; align-items: center;
  font-size: var(--font-size-xs);
}
.start-remind-item { min-width: 0; color: var(--color-text-secondary); line-height: 1.5; }
.start-remind-input {
  width: 100%; min-height: 32px; padding: 0 8px;
  border: 1px solid var(--color-border-primary); border-radius: var(--radius-sm);
  background: var(--color-bg-secondary); color: var(--color-text-secondary);
  font: inherit;
}
.start-remind-input:focus { outline: 2px solid var(--color-primary-500); outline-offset: 1px; }
.start-remind-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.start-remind-hint { font-size: 10px; color: var(--color-text-tertiary); }

@media (max-width: 700px) {
  .start-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .start-quick { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  .start-hero { padding: 16px; }
  .start-tabs { grid-template-columns: 1fr; }
  .start-remind-row { grid-template-columns: 1fr; gap: 2px; }
}
</style>
