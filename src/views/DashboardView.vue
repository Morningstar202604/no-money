<template>
  <div class="dashboard">
    <OnboardingHint />

    <!-- 规则未就绪（加载中/加载失败）时不得显示 0 值：¥0/0分 会被读成真实结论 -->
    <n-alert v-if="!store.rule" :type="store.loadError ? 'error' : 'info'" :show-icon="true" style="margin-bottom: 12px">
      <template v-if="store.loadError">
        本城规则加载失败，以下数字无法计算。请用顶部提示的「重新加载」重试，或切换城市。
      </template>
      <template v-else>正在加载本城政策规则，测算数字稍后显示……</template>
    </n-alert>

    <!-- 占位数据门禁：不挡住数字，但必须让用户知道这些结论建立在假设上 -->
    <n-alert v-else-if="provisional" type="warning" :show-icon="true" style="margin-bottom: 12px">
      <div><b>当前结论为假设测算，不能直接用于决策</b></div>
      <div style="margin-top:4px">
        以下参数尚未回溯官方来源：{{ unverifiedFields.join('、') }}。
        「最优方案」「推荐」只是按这些占位假设算出的排序——请先在左侧「我的计价」填入你 APP 里的真实单价与倍率再参考。
      </div>
    </n-alert>
    <!-- 用户已用自己的流水覆盖计价：如实说明这是「你的实测」，不是官方数据，也不再用占位值 -->
    <n-alert v-else-if="overriddenFields.length > 0" type="success" :show-icon="true" style="margin-bottom: 12px">
      计价参数已按你填写的实际值计算（{{ overriddenFields.join('、') }}）；这些是你自己的流水数据，非官方发布值。
    </n-alert>

    <!-- KPI Row -->
    <div class="kpi-row">
      <div class="stat">
        <span class="stat-label">月净收入{{ provisional ? '（假设）' : '' }}</span>
        <span class="stat-value">{{ dataReady ? '¥' + bestNetMonthly.toLocaleString() : '—' }}</span>
        <span class="stat-foot">{{ dataReady ? (store.comparison?.best?.name || '—') : '等待规则加载' }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">年净收入</span>
        <span class="stat-value">{{ dataReady ? '¥' + bestNetAnnual.toLocaleString() : '—' }}</span>
        <span class="stat-foot">含成本扣除</span>
      </div>
      <div class="stat">
        <span class="stat-label">有效时薪</span>
        <span class="stat-value">{{ dataReady ? '¥' + bestHourly : '—' }}</span>
        <span class="stat-foot">{{ dataReady ? (store.comparison?.best?.work.dailyHours ?? '—') + 'h/天' : '—' }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">权益评分</span>
        <span class="stat-value" :class="rightsScoreClass">{{ dataReady ? rightsScore + '/100' : '—' }}</span>
        <span class="stat-foot">{{ dataReady ? rightsLevel : '等待规则加载' }}</span>
      </div>
    </div>

    <!-- Rights Score Card -->
    <n-card title="权益保障评估" class="card" style="margin-top: 12px">
      <div class="rights-row">
        <div class="rights-score-box">
          <div class="rs-label">权益保护评分</div>
          <div class="rs-value" :class="rightsScoreClass">{{ rightsScore }}/100</div>
          <div class="rs-bar">
            <div class="rs-bar-fill" :style="{ width: rightsScore + '%', background: barColor }"></div>
          </div>
          <div class="rs-level">{{ rightsLevel }}</div>
        </div>
        <div class="rights-flags">
          <div class="rf-title">保障缺口</div>
          <div class="rf-list">
            <div v-for="(flag, i) in rightsFlags" :key="i" class="rf-item">
              <span class="rf-dot"></span>{{ flag }}
            </div>
          </div>
          <n-button size="small" @click="router.push('/rights')" ghost style="margin-top:8px">前往权益护航 →</n-button>
        </div>
      </div>
    </n-card>

    <!-- 图表分析：默认收起，点开才渲染 -->
    <FoldCard
      title="收入与结构图表"
      summary="净收入对比 · 收支结构"
      style="margin-top: 12px"
    >      <n-grid :x-gap="12" cols="1 m:2" responsive="screen">
        <n-gi>
          <n-card title="各方案净收入对比" class="card">
            <ChartBox :option="barOption" :height="300" />
          </n-card>
        </n-gi>
        <n-gi>
          <n-card title="收支结构分析" class="card">
            <ChartBox :option="pieOption" :height="300" />
          </n-card>
        </n-gi>
      </n-grid>
    </FoldCard>

    <!-- 收入波动与风险：单点数字会让人误以为是稳定现金流 -->
    <n-card v-if="volatility" title="这个收入有多稳？—— 收入波动与应急储备" class="card" style="margin-top: 12px">
      <n-alert type="info" :show-icon="true" style="margin-bottom: 10px">
        上面的 ¥{{ bestNetMonthly.toLocaleString() }} 是<strong>点估计</strong>。灵活就业的真实特征是波动，
        所以更该看「最差的月份能有多少」。下方按 {{ (volatilityCv * 100).toFixed(0) }}% 的月度波动率
        模拟 {{ volatility.sampleSize }} 个月（固定种子，可复现），模拟均值
        ¥{{ Math.round(volatility.mean).toLocaleString() }} 与点估计的微小差异来自抽样误差。
      </n-alert>

      <div class="vol-controls">
        <span class="vc-label">月度波动率假设</span>
        <n-slider :value="Math.round(volatilityCv * 100)" :min="5" :max="60" :step="5" style="flex:1;max-width:260px"
          @update:value="(v: number) => store.volatilityCv = v / 100" />
        <span class="vc-value">{{ (volatilityCv * 100).toFixed(0) }}%</span>
      </div>

      <n-grid :x-gap="12" cols="2 m:4" responsive="screen" style="margin-top: 8px">
        <n-gi>
          <div class="vol-stat"><span class="vs-label">最差 10% 月份</span><span class="vs-value danger">¥{{ Math.round(volatility.p10).toLocaleString() }}</span><span class="vs-foot">P10 分位</span></div>
        </n-gi>
        <n-gi>
          <div class="vol-stat"><span class="vs-label">中位数月份</span><span class="vs-value">¥{{ Math.round(volatility.p50).toLocaleString() }}</span><span class="vs-foot">P50 分位</span></div>
        </n-gi>
        <n-gi>
          <div class="vol-stat"><span class="vs-label">最好 10% 月份</span><span class="vs-value ok">¥{{ Math.round(volatility.p90).toLocaleString() }}</span><span class="vs-foot">P90 分位</span></div>
        </n-gi>
        <n-gi>
          <div class="vol-stat"><span class="vs-label">收入不够覆盖成本的月份</span><span class="vs-value danger">{{ (volatility.belowCostMonthRatio * 100).toFixed(1) }}%</span><span class="vs-foot">低于生存线</span></div>
        </n-gi>
      </n-grid>

      <n-alert type="warning" :show-icon="true" style="margin-top: 10px">
        <div><b>应急储备建议：¥{{ Math.round(buffer.recommendedBuffer).toLocaleString() }}</b></div>
        <div style="margin-top:4px;font-size:12px">{{ buffer.rationale }}</div>
      </n-alert>
      <p class="vol-boundary">
        模型边界：乘性波动假设（收入恒为正、波动幅度与收入成比例），未建模封号/伤病等断流事件；
        波动率是假设，请按自己的实际流水调整。此处的储备建议不含社保断缴与债务月供。
      </p>
    </n-card>

    <!-- 洞察 + 排行：默认收起 -->
    <FoldCard
      title="决策洞察与方案排行"
      :summary="`${insights.length} 条洞察 · ${rankedScenarios.length} 个方案`"
      style="margin-top: 12px"
    >
      <n-grid :x-gap="12" cols="1 m:3" responsive="screen">
        <n-gi :span="1">
          <n-card title="决策洞察" class="card">
            <ul class="insight-list">
              <li v-for="(insight, i) in insights" :key="i">{{ insight }}</li>
            </ul>
            <n-empty v-if="!insights.length" description="调整参数后生成决策建议" style="padding: 20px 0" />
          </n-card>
        </n-gi>
        <n-gi :span="2">
          <n-card title="方案排行榜" class="card">
            <n-data-table :data="rankedScenarios" :columns="rankCols" :bordered="false" :single-line="false" size="small" />
          </n-card>
        </n-gi>
      </n-grid>
    </FoldCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { EChartsCoreOption } from 'echarts/core'
import { NCard, NGrid, NGi, NEmpty, NDataTable, NButton, NAlert, NSlider, type DataTableColumns } from 'naive-ui'
import { useMainStore } from '../stores/main'
import { simulateIncomeDistribution, recommendBuffer } from '../domain/income/volatility'
import { axisX, axisY, GRID, chartColors } from '../utils/chart'
import { scoreTier, scoreLevel, TIER_COLORS } from '../utils/score'
import ChartBox from '../components/ChartBox.vue'
import FoldCard from '../components/FoldCard.vue'
import OnboardingHint from '../components/OnboardingHint.vue'

const router = useRouter()
const store = useMainStore()

/** 规则就绪才显示数字：加载中/失败时展示「—」，避免 0 被误读为真实结论 */
const dataReady = computed(() => !!store.rule && !!store.comparison?.best)

/** 占位数据门禁：最优方案建立在未核实参数上时，措辞降级为「假设测算」 */
const provisional = computed(() => store.comparison?.best?.dataQuality?.provisional === true)
const unverifiedFields = computed(() => store.comparison?.best?.dataQuality?.unverifiedFields ?? [])
const overriddenFields = computed(() => store.comparison?.best?.dataQuality?.overriddenFields ?? [])

/**
 * 收入波动：用当前方案的月净收入做乘性波动模拟。
 * 固定种子保证同一参数下结果稳定（不是每次刷新都跳）。
 */
const volatilityCv = computed(() => store.volatilityCv)
const volatility = computed(() => {
  const best = store.comparison?.best
  if (!best) return null
  return simulateIncomeDistribution(best.netMonthly, { cv: volatilityCv.value, months: 600, seed: 20260101 }, best.costBreakdown.total)
})
const buffer = computed(() => {
  const best = store.comparison?.best
  if (!best || !volatility.value) return { recommendedBuffer: 0, months: 3, rationale: '' }
  return recommendBuffer(best.netMonthly, best.costBreakdown.total, volatility.value)
})

const bestNetMonthly = computed(() => store.comparison?.best?.netMonthly || 0)
const bestNetAnnual = computed(() => store.comparison?.best?.netAnnual || 0)
const bestHourly = computed(() => store.comparison?.best?.netHourly.toFixed(1) || '0')

// 统一权益评分（越高越好）
const bestScenario = computed(() => store.comparison?.best)
const rightsScore = computed(() => bestScenario.value?.rightsScore ?? 0)
const rightsFlags = computed(() => bestScenario.value?.rightsFlags || [])
const rightsLevel = computed(() => scoreLevel(rightsScore.value))
const rightsScoreClass = computed(() => ({ good: 'text-safe', mid: 'text-warn', bad: 'text-danger' })[scoreTier(rightsScore.value)])
const barColor = computed(() => TIER_COLORS[scoreTier(rightsScore.value)])

const insights = computed(() => store.comparison?.best?.keyInsights || [])

interface RankRow { rank: number; name: string; netAnnual: number; netMonthly: number; rights: number; tag: string }
const rankedScenarios = computed<RankRow[]>(() => {
  const comp = store.comparison
  if (!comp) return []
  return comp.ranking.map((r, i) => {
    const s = comp.scenarios.find(sc => sc.id === r.id)
    return { rank: i + 1, name: r.label, netAnnual: r.netAnnual, netMonthly: s?.netMonthly || 0, rights: s?.rightsScore || 0, tag: s?.recommendation || 'viable' }
  })
})

const rankCols: DataTableColumns<RankRow> = [
  { title: '#', key: 'rank', width: 48, align: 'center' },
  { title: '方案', key: 'name' },
  { title: '年净收入', key: 'netAnnual', align: 'right', render: (row) => '¥' + row.netAnnual.toLocaleString() },
  { title: '月净收入', key: 'netMonthly', align: 'right', render: (row) => '¥' + row.netMonthly.toLocaleString() },
  { title: '权益', key: 'rights', width: 60, align: 'center' },
  // 占位数据下把「推荐」换成「假设」：评级只是占位假设下的相对排序，不是真实建议
  { title: '评级', key: 'tag', width: 72, align: 'center', render: (row) => provisional.value ? '假设' : row.tag === 'recommended' ? '推荐' : row.tag === 'viable' ? '可行' : '有风险' },
]

const barOption = computed<EChartsCoreOption>(() => {
  void store.isDark // 主题依赖：切换深浅色时重算配色并触发图表重绘
  const comp = store.comparison
  if (!comp) return {}
  const P = chartColors()
  return {
    tooltip: { trigger: 'axis' },
    grid: { ...GRID, bottom: '14%' },
    xAxis: axisX(comp.ranking.map(r => r.label), P),
    yAxis: axisY(P),
    series: [{
      type: 'bar',
      data: comp.ranking.map((r, i) => ({ value: r.netAnnual, itemStyle: { color: P.series[i] || P.light } })),
      barWidth: '45%',
    }]
  }
})

const pieOption = computed<EChartsCoreOption>(() => {
  void store.isDark
  const best = store.comparison?.best
  if (!best) return {}
  const P = chartColors()
  return {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', right: '5%', top: 'center', textStyle: { fontSize: 11, color: P.legendText } },
    series: [{
      type: 'pie', radius: ['48%', '72%'], center: ['38%', '50%'], avoidLabelOverlap: false,
      label: { show: true, fontSize: 11, color: P.axisLabel },
      data: [
        { value: best.netMonthly, name: '实得净收入', itemStyle: { color: P.primary } },
        { value: best.costBreakdown.total, name: '运营成本', itemStyle: { color: P.warn } },
        { value: Math.round(best.tax.annualTax / 12), name: '个税', itemStyle: { color: P.gray } },
        { value: best.benefit.totalMonthly, name: '社保', itemStyle: { color: P.light } }
      ]
    }]
  }
})
</script>

<style scoped>
/* Rights Score */
.rights-row { display: flex; gap: 12px; align-items: stretch; }
.rights-score-box {
  width: 160px; flex-shrink: 0;
  display: flex; flex-direction: column; align-items: center;
  padding: 12px;
  border-right: 1px solid var(--color-border-primary);
}
.rs-label { font-size: 11px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; }
.rs-value { font-size: 28px; font-weight: 700; color: var(--color-text-primary); line-height: 1.2; margin: 4px 0; }
.rs-bar { width: 100%; height: 6px; background: var(--color-bg-tertiary); border-radius: 3px; overflow: hidden; margin: 4px 0; }
.rs-bar-fill { height: 100%; border-radius: 3px; transition: width 0.5s; }
.rs-level { font-size: 12px; color: var(--color-text-secondary); margin-top: 2px; }
.rights-flags { flex: 1; display: flex; flex-direction: column; }
.rf-title { font-size: 11px; font-weight: 600; color: var(--color-text-primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
.rf-list { flex: 1; display: flex; flex-direction: column; gap: 3px; max-height: 120px; overflow-y: auto; }
.rf-item { font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; display: flex; align-items: flex-start; gap: 6px; }
.rf-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--color-text-warning); flex-shrink: 0; margin-top: 7px; }
.vol-controls { display: flex; align-items: center; gap: 10px; }
.vc-label { font-size: 12px; color: var(--color-text-secondary); white-space: nowrap; }
.vc-value { font-size: 13px; font-weight: 600; color: var(--color-text-primary); min-width: 40px; }
.vol-stat { display: flex; flex-direction: column; gap: 2px; padding: 8px 0; }
.vs-label { font-size: 12px; color: var(--color-text-secondary); }
.vs-value { font-size: 20px; font-weight: 600; color: var(--color-text-primary); }
.vs-value.ok { color: var(--color-text-success); }
.vs-value.danger { color: var(--color-text-danger, #d03050); }
.vs-foot { font-size: 11px; color: var(--color-text-tertiary); }
.vol-boundary { font-size: 11px; color: var(--color-text-tertiary); line-height: 1.6; margin: 8px 0 0; }
</style>
