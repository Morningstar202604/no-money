<template>
  <PageHeading />
  <div>
    <n-card title="政策百科 — 法规依据与维权指引" class="card">
      <p class="desc">
        本页四组：<b>政策原文</b>、<b>数据溯源</b>、<b>现实与救济</b>、<b>手册与知识库</b>。
        每条政策均标注文件名、文号、施行状态与原文链接；标注「待核实」的条目尚无权威出处，请勿对外引用。
        办事清单、材料和教程先看「<router-link class="link-brand" to="/start">办事入口</router-link>」页，这里只负责查依据。
      </p>
    </n-card>

    <n-tabs type="line" v-model:value="activeTab" style="margin-top: 12px">
      <n-tab-pane name="policy" tab="政策原文">
        <h2 class="group-title">国家级</h2>
        <div class="policy-list">
          <FoldCard v-for="p in policies.national" :key="p.id">
            <template #header>
              <n-tag :type="statusType(p.status)" size="small" :bordered="false">{{ p.status }}</n-tag>
              <strong class="pi-title">{{ p.title }}</strong>
              <span v-if="p.docNo" class="pi-doc pi-doc-end">{{ p.docNo }}</span>
            </template>
            <div class="pi-meta">
              <span v-if="p.effectiveFrom">施行/报送：{{ p.effectiveFrom }}</span>
              <a v-if="p.url" :href="p.url" target="_blank" rel="noopener noreferrer" class="pi-link">原文</a>
            </div>
            <p class="pi-summary">{{ p.summary }}</p>
            <p v-if="p.caveat" class="pi-caveat">注意：{{ p.caveat }}</p>
          </FoldCard>
        </div>

        <h2 class="group-title">{{ provinceTabLabel }}</h2>
        <!-- 当前城市不在广东时，本页内容与用户所在省份无关，必须说明而不是默默展示 -->
        <n-alert v-if="currentProvince && currentProvince !== '广东'" type="info" :show-icon="true" style="margin-bottom: 10px">
          你当前测算城市是<b>{{ store.rule?.cityName }}</b>（{{ currentProvince }}）。
          本页收录的是<b>广东省</b>的地方性政策原文，与你所在省份的地区性规定不同，
          不能直接套用——请以{{ currentProvince }}人社/医保部门的现行文件为准。
          全国性政策见上方「国家级」。
        </n-alert>
        <div class="policy-list">
          <FoldCard v-for="p in policies.guangdong" :key="p.id">
            <template #header>
              <n-tag :type="statusType(p.status)" size="small" :bordered="false">{{ p.status }}</n-tag>
              <strong class="pi-title">{{ p.title }}</strong>
              <span v-if="p.docNo" class="pi-doc pi-doc-end">{{ p.docNo }}</span>
            </template>
            <div class="pi-meta">
              <span v-if="p.effectiveFrom">施行/报送：{{ p.effectiveFrom }}</span>
              <a v-if="p.url" :href="p.url" target="_blank" rel="noopener noreferrer" class="pi-link">原文</a>
            </div>
            <p class="pi-summary">{{ p.summary }}</p>
            <p v-if="p.caveat" class="pi-caveat">注意：{{ p.caveat }}</p>
          </FoldCard>
        </div>

        <h2 class="group-title">本省政策核查清单</h2>
        <n-card class="card" style="margin-top: 0" :title="`${currentProvince || '你所在省'}：该查哪几份文件`">
          <p class="desc" style="margin-bottom:10px">
            本产品逐条核验并收录了<b>广东省</b>的地方文件；其余省份不编造文号与数值，而是列出
            <b>决定测算结果的六类文件</b>与检索路径。拿到原文后，填进左侧「本省法定参数」即可让测算锚定本省口径。
          </p>
          <div class="policy-list">
            <FoldCard v-for="item in provinceChecklist" :key="item.key">
              <template #header>
                <span class="src-key">{{ item.title }}</span>
              </template>
              <p class="src-note">{{ item.why }}</p>
            </FoldCard>
          </div>
          <n-alert type="info" :show-icon="true" style="margin-top: 10px">
            <div><b>检索路径（任选其一）</b></div>
            <div style="margin-top:4px">
              ① <b>{{ resolvedChannel?.services.social.name ?? '本省人社厅' }}</b>官网「政策文件/规范性文件」栏目；
              ② 本省政务服务网（{{ resolvedChannel?.portalName ?? '省级政务服务平台' }}）搜索文件名；
              ③ 拨 <b>12333</b> 直接问「本省今年灵活就业养老/医保缴费基数上下限是多少」。
            </div>
            <div v-if="resolvedChannel?.services.social.url || resolvedChannel?.portalUrl" style="margin-top:6px">
              官网入口：
              <a v-if="resolvedChannel?.services.social.url" :href="resolvedChannel.services.social.url" target="_blank" rel="noopener noreferrer" class="pi-link">{{ resolvedChannel.services.social.name }}</a>
              <span v-if="resolvedChannel?.services.social.url && resolvedChannel?.portalUrl"> · </span>
              <a v-if="resolvedChannel?.portalUrl" :href="resolvedChannel.portalUrl" target="_blank" rel="noopener noreferrer" class="pi-link">{{ resolvedChannel.portalName }}</a>
            </div>
          </n-alert>
        </n-card>
      </n-tab-pane>

      <n-tab-pane name="sources" tab="数据溯源">
        <n-card class="card" style="margin-top: 0" title="当前城市参数逐条溯源">
          <p class="desc" style="margin-bottom:10px">
            测算页的每个外部参数都来自左侧规则文件，此处展示其出处与置信度。
            <strong>official</strong>=已回溯官方原文；<strong>derived</strong>=据官方口径推算；<strong>unverified</strong>=无权威来源，仅作占位。
          </p>
          <n-empty v-if="!rule" description="规则文件未加载" />
          <div v-else class="policy-list">
            <FoldCard v-for="(s, key) in rule.sources" :key="key">
              <template #header>
                <n-tag :type="s.confidence === 'official' ? 'success' : s.confidence === 'derived' ? 'warning' : 'error'"
                       size="small" :bordered="false">{{ s.confidence }}</n-tag>
                <span class="src-key">{{ FIELD_LABELS[key] || key }}</span>
              </template>
              <div class="src-title">{{ s.title }}<span v-if="s.docNo" class="pi-doc">{{ s.docNo }}</span></div>
              <div class="src-meta">
                <span v-if="s.issuedBy">{{ s.issuedBy }} · </span>
                <span v-if="s.effectiveFrom">生效：{{ s.effectiveFrom }} · </span>
                <span>{{ s.confidence === 'unverified' ? '登记于' : '核对于' }} {{ s.retrievedAt }}</span>
              </div>
              <p v-if="s.note" class="src-note">{{ s.note }}</p>
              <a v-if="s.url" :href="s.url" target="_blank" rel="noopener noreferrer" class="pi-link">查看原文 ↗</a>
            </FoldCard>
          </div>
        </n-card>
      </n-tab-pane>

      <n-tab-pane name="reality" tab="现实与救济">
        <h2 class="group-title">现实与口径</h2>
        <n-card class="card" style="margin-top: 0" title="这些差距，比文件本身更影响你的到手金额">
          <p class="desc">
            以下条目按证据等级标注：<b>法律条文 / 官方文件</b> ＞ <b>媒体报道</b> ＞ <b>经验·待自验</b>（无权威统计，给出自行核实的方法）。
            本项目不把「感觉」当事实——凡无法回溯到出处的量化断言一律不写；标「经验·待自验」的，请按给出的方法核实后再引用。
          </p>
        </n-card>
        <n-card
          v-for="g in realityGroups"
          :key="g.key"
          class="card"
          style="margin-top: 12px"
          :title="g.label"
        >
          <RealityList :facts="g.facts" />
        </n-card>

        <h2 class="group-title">权益救济</h2>
        <n-grid :x-gap="12" cols="1 s:2" responsive="screen" style="margin-top: 0">
          <n-gi v-for="(item, i) in reliefGuide" :key="i">
            <n-card class="card" style="height: 100%">
              <template #header>
                <span class="pi-title">{{ item.title }}</span>
              </template>
              <n-steps :current="item.steps.length" size="small" vertical>
                <n-step v-for="(step, j) in item.steps" :key="j" :title="`步骤 ${j+1}`">
                  <span class="step-text">{{ step }}</span>
                </n-step>
              </n-steps>
              <p v-if="item.note" class="step-note">{{ item.note }}</p>
            </n-card>
          </n-gi>
        </n-grid>
      </n-tab-pane>

      <n-tab-pane name="manual-kb" tab="手册与知识库">
        <h2 class="group-title">民生手册</h2>
        <n-card class="card" style="margin-top: 0" title="办事速查：社保 · 医保 · 养老 · 保险税优">
          <p class="desc">
            每条一个实际问题、一句人话结论、关键数字与办理步骤，并附
            <strong>官方原文链接</strong>（gov.cn 政策库 / 部委官网逐个核验，可点开对照）。
            数字若与参保地口径不同，以当地经办机构为准；拨 <strong>12333</strong> 能一次问清。
          </p>
        </n-card>
        <n-card
          v-for="g in guideGroups"
          :key="g.key"
          class="card"
          style="margin-top: 12px"
          :title="g.label"
        >
          <GuideCard v-for="item in g.items" :key="item.id" :item="item" />
        </n-card>

        <h2 class="group-title">知识库</h2>
        <n-card class="card" style="margin-top: 0" title="统一知识库 — 本地检索，AI 可直接摄取">
          <p class="desc">
            当前城市视图聚合成 <b>{{ kbTotal }} 条</b>结构化条目（政策 {{ kbCounts.policy }} / 手册 {{ kbCounts.guide }} / 现实 {{ kbCounts.reality }} / 本城溯源 {{ kbCounts.source }}）。
            <b>官方条目均带原文链接</b>；<code>unverified</code> 的占位条目没有公开来源，其说明里会写明「未回溯、不可引用」，不能当官方口径使用。
            检索在本地完成、不联网；AI 助手在离线模式下也会用它作答，在线模式下作为检索上下文注入。
            全量导出（34 城，供外部 Agent / RAG 摄取）：<a class="kb-file-link" :href="kbJsonUrl" target="_blank" rel="noopener noreferrer">/knowledge/kb.json</a>
            ·
            <a class="kb-file-link" :href="kbReadmeUrl" target="_blank" rel="noopener noreferrer">摄取说明</a>
          </p>
          <div class="kb-stats">
            <span v-for="(label, key) in KB_TYPE_LABELS" :key="key" class="kb-stat">
              {{ label }} <b>{{ kbCounts[key] }}</b>
            </span>
          </div>
          <div class="kb-search">
            <n-input
              v-model:value="kbQuery"
              clearable
              size="small"
              placeholder="搜索：个人养老金 / 医保断缴 / 延迟退休 / 工伤 / 专项附加扣除…"
            />
            <n-radio-group v-model:value="kbFilter" size="small">
              <n-radio-button value="all">全部</n-radio-button>
              <n-radio-button value="guide">手册</n-radio-button>
              <n-radio-button value="reality">现实</n-radio-button>
              <n-radio-button value="policy">政策</n-radio-button>
              <n-radio-button value="source">溯源</n-radio-button>
            </n-radio-group>
          </div>
          <div v-if="!kbQuery.trim()" class="kb-hot">
            <span class="kb-hot-label">试试：</span>
            <n-tag
              v-for="q in KB_HOT_QUERIES"
              :key="q"
              size="small"
              class="kb-hot-tag"
              @click="kbQuery = q"
            >{{ q }}</n-tag>
          </div>
          <template v-else>
            <p class="kb-count">命中 {{ kbHits.length }} 条{{ kbHits.length === 12 ? '（仅显示前 12 条）' : '' }}</p>
            <div class="kb-results">
              <KbResultCard v-for="h in kbHits" :key="h.entry.id" :hit="h" />
            </div>
            <n-empty v-if="!kbHits.length" description="没有命中：换个关键词，或看上方「民生手册」按分类浏览" style="padding: 16px 0" />
          </template>
        </n-card>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>


<script setup lang="ts">
import { createPageHeading } from '../components/PageHeading'
const PageHeading = createPageHeading('policy')

import { computed, ref } from 'vue'
import { NCard, NTabs, NTabPane, NGrid, NGi, NTag, NSteps, NStep, NEmpty, NInput, NRadioGroup, NRadioButton, NAlert } from 'naive-ui'
import { useMainStore } from '../stores/main'
import { CITY_REGISTRY } from '../data/cities'
import { SOURCE_LABELS } from '../utils/sources'
import { assetUrl } from '../utils/asset'
import FoldCard from '../components/FoldCard.vue'
import RealityList from '../components/RealityList.vue'
import GuideCard from '../components/GuideCard.vue'
import KbResultCard from '../components/KbResultCard.vue'
import { useTabQuery } from '../composables/useTabQuery'
import { REALITY_FACTS, REALITY_CATEGORY_ORDER, REALITY_CATEGORY_LABELS } from '../utils/reality'
import { GUIDE_ITEMS, GUIDE_GROUP_ORDER, GUIDE_GROUP_LABELS } from '../utils/livingGuide'
import { POLICIES, RELIEF_GUIDE, PROVINCE_POLICY_CHECKLIST, type PolicyStatus } from '../data/policies'
import { resolveServiceChannel } from '../data/cityChannels'
import {
  buildStaticKbEntries,
  citySourceEntries,
  searchKnowledge,
  KB_TYPE_LABELS,
  type KbEntryType,
} from '../utils/knowledge'

const store = useMainStore()
const rule = computed(() => store.rule)
const kbJsonUrl = assetUrl('knowledge/kb.json')
const kbReadmeUrl = assetUrl('knowledge/README.md')

/**
 * 省级页签标题跟随当前城市：本页只收录了广东省地方政策，
 * 写死「广东省 / 广州」会让北京/上海用户以为这里的内容适用于自己。
 */
const currentProvince = computed(() => {
  const city = store.work.city
  return CITY_REGISTRY.find(c => c.value === city)?.province ?? ''
})
const resolvedChannel = computed(() => resolveServiceChannel(currentProvince.value))
const provinceChecklist = computed(() => PROVINCE_POLICY_CHECKLIST)
const provinceTabLabel = computed(() => {
  // 规则文件未加载时退回中性标题，避免用 work.city 猜出错误的省份
  if (!currentProvince.value) return '地方政策（广东）'
  if (currentProvince.value === '广东') {
    const name = store.rule?.cityName ?? '广州'
    return `广东省 / ${name}`
  }
  return `地方政策（广东，非你所在省）`
})

/**
 * 页签与 URL 双向同步：/policy?tab=manual 可深链进入，切换页签也会写回地址栏。
 * 具体 getter/setter 规则统一在 useTabQuery，避免三个页面各写一份后漂移。
 */
const TAB_NAMES = [
  'policy', 'sources', 'reality', 'manual-kb',
  // 旧深链别名：仍能打开，归到对应的四组，不破坏已发出去的链接
  'national', 'guangdong', 'province', 'manual', 'kb', 'relief',
] as const
type TabName = typeof TAB_NAMES[number]
type TabGroup = 'policy' | 'sources' | 'reality' | 'manual-kb'
const TAB_GROUP: Record<TabName, TabGroup> = {
  policy: 'policy', sources: 'sources', reality: 'reality', 'manual-kb': 'manual-kb',
  national: 'policy', guangdong: 'policy', province: 'policy',
  manual: 'manual-kb', kb: 'manual-kb', relief: 'reality',
}
const tab = useTabQuery(TAB_NAMES, 'policy')
/** 四个外层页签；旧 ?tab=manual / national 等深链归到对应组。 */
const activeTab = computed<TabGroup>({
  get: () => TAB_GROUP[tab.value] ?? 'policy',
  set: (value) => { tab.value = value },
})

/* ---------- 知识库 ---------- */
const STATIC_KB = buildStaticKbEntries()
const KB_HOT_QUERIES = ['个人养老金', '医保断缴', '延迟退休', '灵活就业参保', '专项附加扣除', '工伤认定']
const kbQuery = ref('')
const kbFilter = ref<'all' | KbEntryType>('all')

const kbEntries = computed(() => [...STATIC_KB, ...citySourceEntries(store.rule)])
const kbCounts = computed(() => {
  const counts: Record<KbEntryType, number> = { policy: 0, guide: 0, reality: 0, source: 0 }
  for (const e of kbEntries.value) counts[e.type]++
  return counts
})
const kbTotal = computed(() => kbEntries.value.length)
const kbHits = computed(() =>
  searchKnowledge(kbQuery.value, {
    entries: kbEntries.value,
    limit: 12,
    type: kbFilter.value === 'all' ? undefined : kbFilter.value,
  }),
)

const realityGroups = REALITY_CATEGORY_ORDER.map(key => ({
  key,
  label: REALITY_CATEGORY_LABELS[key],
  facts: REALITY_FACTS.filter(f => f.category === key),
}))

const guideGroups = GUIDE_GROUP_ORDER.map(key => ({
  key,
  label: GUIDE_GROUP_LABELS[key],
  items: GUIDE_ITEMS.filter(i => i.group === key),
}))

// 与面板上的「依据」chip 共用一份映射，避免两处漂移
const FIELD_LABELS = SOURCE_LABELS

type Status = PolicyStatus
const statusType = (s: Status) => s === '已施行' ? 'success' : s === '待核实' ? 'error' : 'warning'

// 数据层已抽到 src/data/policies.ts，由知识库与页面共用
const policies = POLICIES
const reliefGuide = RELIEF_GUIDE

</script>

<style scoped>

.policy-list { display: flex; flex-direction: column; gap: 8px; }
.group-title { margin: 18px 0 8px; font-size: var(--font-size-lg); color: var(--color-text-primary); }
.group-title:first-child { margin-top: 0; }
.pi-title { font-size: 14px; color: var(--color-text-primary); font-weight: 600; }
.pi-doc-end { margin-left: auto; }
.pi-summary { color: var(--color-text-secondary); font-size: 13px; line-height: 1.6; margin-bottom: 4px; }
.pi-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 11px; color: var(--color-text-tertiary); margin-bottom: 5px; }
.pi-doc { color: var(--color-text-brand); background: rgba(13,148,136,0.07); border-radius: 3px; padding: 1px 6px; font-weight: 600; }
.pi-link { color: var(--color-text-brand); text-decoration: none; border-bottom: 1px solid rgba(13,148,136,0.3); }
.pi-link:hover { border-bottom-color: var(--color-text-brand); }
.pi-caveat { font-size: 12px; color: var(--color-text-warning); background: var(--color-warning-50); border-left: 2px solid var(--color-text-warning); padding: 6px 8px; border-radius: 0 3px 3px 0; margin: 6px 0 0; line-height: 1.5; }

.src-key { font-size: 12px; font-weight: 600; color: var(--color-text-primary); }
.src-title { font-size: 12px; color: var(--color-text-primary); margin-bottom: 3px; }
.src-meta { font-size: 11px; color: var(--color-text-tertiary); margin-bottom: 3px; }
.src-note { font-size: 11px; color: var(--color-text-secondary); line-height: 1.5; margin: 0 0 6px; }

.step-text { color: var(--color-text-secondary); font-size: 12px; }
.step-note {
  margin: 10px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--color-text-warning);
  background: var(--color-warning-50);
  border-left: 2px solid var(--color-text-warning);
  padding: 6px 8px;
  border-radius: 0 3px 3px 0;
}

/* ---------- 知识库 ---------- */
.kb-file-link { color: var(--color-text-brand); }
.kb-stats { display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0 10px; }
.kb-stat { font-size: 11px; color: var(--color-text-tertiary); }
.kb-stat b { color: var(--color-text-primary); font-weight: 600; }
.kb-search { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.kb-search .n-input { max-width: 460px; }
.kb-hot { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.kb-hot-label { font-size: 11px; color: var(--color-text-tertiary); }
.kb-hot-tag { cursor: pointer; }
.kb-count { font-size: 11px; color: var(--color-text-tertiary); margin: 10px 0 2px; }
.kb-results { display: flex; flex-direction: column; }
</style>
