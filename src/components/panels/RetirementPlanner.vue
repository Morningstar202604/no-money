<template>
  <div>
    <n-card title="退休规划 — 社保缴纳策略与养老金测算" class="card">
      <p class="desc">
        以当前年龄 {{ store.personal.currentAge }} 岁起，测算不同缴费档次下的累计养老金。
        职工养老金 = 基础养老金 + 个人账户养老金。灵活就业者按基数的 20% 全额自缴，
        其中 12% 进统筹基金、8% 记入个人账户——只有 8% 参与账户滚存。
        年龄可在左侧参数栏「税务与社保」中调整。计发基数取本城口径
        （<b>{{ (store.rule?.retirement.benefitBaseMonthly ?? 0).toLocaleString() }}</b> 元/月）<SourceTag source-key="retirement" />，账户收益率
        {{ assumedReturnPct }}% 为假设值，实际由人社部门核算。
      </p>
      <!-- 未参保时本页仍会算出养老金，若不说明前提，用户会以为自己已经有这笔钱 -->
      <n-alert v-if="!store.personal.hasSocialInsurance" type="info" :show-icon="true" style="margin-top: 8px">
        你当前标记为<strong>未参保</strong>。以下数字是「假如从现在起按灵活就业身份连续缴费到
        {{ store.personal.expectedRetireAge }} 岁」的推演结果，<strong>不是已有权益</strong>，
        也不含你过去任何已缴年限或历史账户余额。缴满最低年限（2030 年起逐步提高到 20 年）
        才能按月领取。
      </n-alert>
      <!-- 记账利率是可调假设，不是官方数据：让用户能按自己的判断改，并明确当前口径 -->
      <div class="return-row">
        <span class="rr-label">个人账户记账利率假设</span>
        <n-input-number
          :value="assumedReturnPct"
          :min="-5" :max="10" :step="0.5" size="small" style="width:130px"
          @update:value="setReturn"
        />
        <span class="rr-unit">% / 年</span>
        <n-tag v-if="usingCustomReturn" size="tiny" type="success" :bordered="false">按你的假设</n-tag>
        <n-tag v-else size="tiny" :bordered="false">本项目默认假设</n-tag>
        <n-button v-if="usingCustomReturn" size="tiny" quaternary @click="setReturn(null)">恢复默认</n-button>
      </div>
      <p class="rr-note">
        这不是官方发布值，也没有任何人能保证未来记账利率。改动它会同时影响本页所有曲线与档位对比——
        想验证「利率低一点还够不够养老」时直接在这里调。
      </p>

      <!-- 明确当期基数来源，避免"选了高档但首屏没变"的困惑 -->
      <p class="base-note">
        测算基数：<b>¥{{ effectivePensionBase.toLocaleString() }}/月</b>
        <template v-if="usingChosenBase">（你在左侧自选的缴费基数，档位 {{ basePctLabel }}）</template>
        <template v-else>（本城法定下限，可在左侧「税务与社保」中上调档位）</template>
      </p>
    </n-card>

    <div class="kpi-row" style="margin-top: 12px">
      <div class="stat">
        <span class="stat-label">{{ store.personal.expectedRetireAge }}岁预估月养老金</span>
        <span class="stat-value">¥{{ retireResult.totalPension.toLocaleString() }}</span>
        <span class="stat-foot">基础 ¥{{ Math.round(retireResult.basePension).toLocaleString() }} + 个账 ¥{{ Math.round(retireResult.personalPension).toLocaleString() }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">个人账户累计</span>
        <span class="stat-value">¥{{ retireResult.personalAccount.toLocaleString() }}</span>
        <span class="stat-foot">{{ assumedReturnPct }}% 年化假设收益率</span>
      </div>
      <div class="stat">
        <span class="stat-label">缴费累计</span>
        <span class="stat-value">{{ Math.floor(retireResult.months / 12) }}年</span>
        <span class="stat-foot">{{ retireResult.months }}个月 · 计发月数 {{ issuanceMonths }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">替代率</span>
        <span class="stat-value">{{ replaceRate }}%</span>
        <span class="stat-foot">养老金 / 月收入</span>
      </div>
    </div>

    <!-- 分析图表：默认收起 -->
    <FoldCard
      title="养老金测算图表"
      summary="缴费档次对比 · 账户增长曲线"
      style="margin-top: 12px"
    >
      <n-grid :x-gap="12" cols="1 m:2" responsive="screen">
        <n-gi>
          <n-card title="不同缴费档次养老金对比" class="card">
            <ChartBox :option="tierOption" :height="340" />
          </n-card>
        </n-gi>
        <n-gi>
          <n-card title="个人账户余额增长曲线" class="card">
            <ChartBox :option="growthOption" :height="340" />
          </n-card>
        </n-gi>
      </n-grid>
    </FoldCard>

    <n-grid :x-gap="12" cols="1 m:2" style="margin-top: 12px">
      <n-gi>
        <FoldCard
          title="最低缴15年 vs 缴至退休"
          :summary="`缴至退休月领 ¥${Math.round(retireResult.totalPension).toLocaleString()}`"
        >
          <p class="retire-caveat">
            注意：2030 年起领取养老金的最低缴费年限将从 15 年逐步提高到 20 年（2024-09 全国人大常委会决定）。
            「缴满 15 年」不再是长期标准，本表「缴15年」档仅供对比。
          </p>
          <n-table :bordered="false" :single-line="false" size="small">
            <thead><tr><th>缴费年限</th><th>月养老金</th><th>个人账户总额</th><th>回本年限</th></tr></thead>
            <tbody>
              <tr v-for="row in compareYears" :key="row.years">
                <td>{{ row.label }}</td>
                <td class="text-safe">¥{{ row.pension.toLocaleString() }}</td>
                <td>¥{{ row.account.toLocaleString() }}</td>
                <td>{{ row.yearsToBreakEven }}年</td>
              </tr>
            </tbody>
          </n-table>
        </FoldCard>
      </n-gi>
      <n-gi>
        <FoldCard title="决策建议" :summary="`替代率 ${replaceRate}%`">
          <ul class="advice-list">
            <li>养老替代率达 40% 才满足基本退休生活。当前方案仅 <b>{{ replaceRate }}%</b>，建议额外自行储蓄。</li>
            <li>以灵活就业缴满 15 年社保，按最低基数约需 <b>{{ fifteenYearCost }}</b> 总投入；缴至 {{ store.personal.expectedRetireAge }} 岁约需 <b>{{ totalCostWan }}</b>。</li>
            <li>不满 15 年退出，只能取回个人账户的那 8%（约为总缴费的 40%），12% 的统筹部分不退（人社部令第 13 号）——已缴年限越接近 15 年，越不该断缴。</li>
            <li>建议配置个人养老金账户（每年 12,000 限额，享税收优惠），作为第三支柱储备。<RouterLink :to="{ path: '/policy', query: { tab: 'manual' } }">开户与税优细节 →</RouterLink></li>
          </ul>
        </FoldCard>
      </n-gi>
    </n-grid>

    <FoldCard
      title="社保与养老的现实核查"
      summary="断缴、退出与延迟退休的代价"
      style="margin-top: 12px"
    >
      <RealityList :facts="socialFacts" />
    </FoldCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EChartsCoreOption } from 'echarts/core'
import { NCard, NGrid, NGi, NTable, NAlert, NInputNumber, NTag, NButton } from 'naive-ui'
import { useMainStore } from '../../stores/main'
import { BenefitEngine } from '../../engine/BenefitEngine'
import { issuanceMonthsForAge } from '../../utils/issuanceMonths'
import { buildPensionGrowthSeries, buildPensionTiers, socialAverageWage } from '../../utils/pensionSeries'
import { axisX, axisY, GRID, legend, chartColors } from '../../utils/chart'
import ChartBox from '../ChartBox.vue'
import SourceTag from '../SourceTag.vue'
import FoldCard from '../FoldCard.vue'
import RealityList from '../RealityList.vue'
import { realityFactsBy } from '../../utils/reality'

const store = useMainStore()
const engine = computed(() => store.rule ? new BenefitEngine(store.rule.benefit, store.rule.retirement) : null)
/**
 * 个人账户记账利率：用户设定优先，否则用本城规则里的默认假设。
 * 此前本文件各处兜底值不一致（0.05 / 0.03 混用），同一页面不同图表
 * 会按不同收益率算——统一到这一个解析函数。
 */
const DEFAULT_RETURN = 0.03
const annualReturn = computed(() =>
  typeof store.personal.assumedAnnualReturn === 'number' && Number.isFinite(store.personal.assumedAnnualReturn)
    ? store.personal.assumedAnnualReturn
    : (store.rule?.retirement.assumedAnnualReturn ?? DEFAULT_RETURN),
)
const assumedReturnPct = computed(() => Math.round(annualReturn.value * 1000) / 10)
const usingCustomReturn = computed(() => typeof store.personal.assumedAnnualReturn === 'number')
function setReturn(pct: number | null) {
  store.personal.assumedAnnualReturn = (pct === null || !Number.isFinite(pct)) ? undefined : pct / 100
}

const socialFacts = realityFactsBy(['refund-only-personal', 'delay-retirement', 'medical-lapse', 'employment-injury-gap'])

/**
 * 首屏测算用的养老缴费基数：用户自选优先，未选时按下限（与 ParamSidebar 的
 * autoPensionBase 同口径）。
 * 旧实现恒取 baseMin：用户在左侧选了 100%/200% 档，本页仍按下限出养老金，
 * 首屏数字与用户实际选择脱钩。
 */
const effectivePensionBase = computed(() => {
  const chosen = store.personal.pensionBase
  const min = store.rule?.benefit.pension.baseMin ?? 5000
  const max = store.rule?.benefit.pension.baseMax ?? min
  if (typeof chosen === 'number' && Number.isFinite(chosen) && chosen > 0) {
    return Math.min(Math.max(chosen, min), max)
  }
  return min
})

/** 是否已按用户自选基数测算（用于文案区分「按下限」与「按你选的档」） */
const usingChosenBase = computed(() => store.personal.pensionBase !== undefined)

/** 当前基数对应的档位百分比（60% 档即法定下限） */
const basePctLabel = computed(() => {
  const social = socialAverageWage(
    store.rule?.benefit.pension.baseMin ?? 0,
    store.rule?.benefit.pension.baseMax,
  )
  if (!social) return '—'
  return Math.round((effectivePensionBase.value / social) * 100) + '%'
})

/** 月缴费总额（灵活就业自缴全部 20%），用于成本展示 */
const monthlyContribution = computed(() => {
  const rate = store.rule?.benefit.pension.rate || 0.2
  return Math.round(effectivePensionBase.value * rate)
})

/**
 * 记入个人账户的月金额 = 基数 × 8%（粤人社规〔2026〕14号第七条：20% 中 12% 进统筹、8% 记个账）。
 * 账户滚存只能用这一部分，把全额 20% 记进个账会让个账养老金虚高约 2.5 倍。
 */
const accountMonthly = computed(() => {
  const rate = store.rule?.retirement.personalAccountRate ?? 0.08
  return Math.round(effectivePensionBase.value * rate)
})

/**
 * 首屏口径 = 从当前年龄连续缴到退休年龄。
 * 旧版这里写死 15 年，却用 (退休年龄-当前年龄) 的月数滚个人账户，
 * 等于"基础养老金按 15 年算、账户按 35 年攒"两套年限混用，
 * 首屏数字与右侧增长曲线/档次对比图也对不上。此处统一为缴至退休。
 */
const contributionYears = computed(() => Math.max(1, store.personal.expectedRetireAge - store.personal.currentAge))

const retireResult = computed(() => {
  if (!engine.value) return { totalPension: 0, personalAccount: 0, basePension: 0, personalPension: 0, months: 0 }
  // 缴费指数必须与当前测算基数一致：不传时引擎按法定下限 0.6 兜底，
  // 选了 100%/200% 档的用户首屏基础养老金被大幅低估，且与下方档次对比图互相打架
  const socialAvg = socialAverageWage(
    store.rule?.benefit.pension.baseMin ?? 0,
    store.rule?.benefit.pension.baseMax,
  )
  return engine.value.projectRetirement(
    store.personal.currentAge, store.personal.expectedRetireAge,
    accountMonthly.value, contributionYears.value,
    annualReturn.value,
    effectivePensionBase.value / socialAvg,
  )
})

const issuanceMonths = computed(() => issuanceMonthsForAge(store.personal.expectedRetireAge))

const replaceRate = computed(() => {
  const income = store.scenarios[0]?.income.grossIncome || 1
  return (retireResult.value.totalPension / income * 100).toFixed(1)
})

const totalCost = computed(() => retireResult.value.months * monthlyContribution.value)
const totalCostWan = computed(() => (totalCost.value / 10000).toFixed(1) + '万元')
const fifteenYearCost = computed(() => {
  const wan = (15 * 12 * monthlyContribution.value) / 10000
  return wan.toFixed(1) + '万元'
})

const tierOption = computed<EChartsCoreOption>(() => {
  void store.isDark // 主题依赖：浅深切换后重算配色
  if (!engine.value) return {}
  const P = chartColors()
  const baseMin = store.rule?.benefit.pension.baseMin || 5000
  const baseMax = store.rule?.benefit.pension.baseMax || 26000
  const rate = store.rule?.benefit.pension.rate || 0.2
  // 档位基数按法定 60%~300% 口径换算（见 utils/pensionSeries）。
  // 旧的线性插值系数与档位标签脱钩，200% 档基数反而低于 150% 档，
  // 图上出现"缴得越多、养老金越少"的反向结论
  const tiers = buildPensionTiers(baseMin, baseMax)
  const annualReturnVal = annualReturn.value
  const accountRate = store.rule?.retirement.personalAccountRate ?? 0.08
  const contribData = tiers.map(t => Math.round(t.base * rate))
  // 各档基础养老金必须按该档自身的缴费指数算（指数 = 基数 ÷ 社平）。
  // 不传指数时引擎按法定下限 0.6 兜底，会让 100%/200% 档养老金被大幅低估
  // （200%档少约 ¥2,300/月），图上呈现"多缴并不划算"的错误结论。
  const socialAvg = socialAverageWage(baseMin, baseMax)
  const pensionData = tiers.map(t => engine.value!.projectRetirement(
    store.personal.currentAge, store.personal.expectedRetireAge,
    Math.round(t.base * accountRate), store.personal.expectedRetireAge - store.personal.currentAge,
    annualReturnVal, t.base / socialAvg,
  ).totalPension)
  return {
    tooltip: { trigger: 'axis' },
    legend: legend(['月养老金', '月缴费额'], P),
    grid: GRID,
    xAxis: axisX(tiers.map(t => t.label), P),
    yAxis: axisY(P),
    series: [
      { name: '月缴费额', type: 'bar', data: contribData, itemStyle: { color: P.light }, barWidth: '25%' },
      { name: '月养老金', type: 'line', data: pensionData, smooth: true, lineStyle: { color: P.primary, width: 2 }, itemStyle: { color: P.primary } }
    ]
  }
})

const growthOption = computed<EChartsCoreOption>(() => {
  void store.isDark
  if (!engine.value) return {}
  const P = chartColors()
  const annualReturnVal = annualReturn.value
  // 取数逻辑抽到 utils/pensionSeries（纯函数），保证本图每个点与退休引擎同口径；
  // 内联复利循环曾与引擎漂移约 9000 倍，且组件内无法被单测发现
  const points = buildPensionGrowthSeries({
    engine: engine.value,
    currentAge: store.personal.currentAge,
    retireAge: store.personal.expectedRetireAge,
    accountMonthly: accountMonthly.value,
    annualReturn: annualReturnVal,
  })
  const labels = points.map(p => p.label)
  const data = points.map(p => p.balance)
  return {
    tooltip: { trigger: 'axis' },
    grid: GRID,
    xAxis: axisX(labels, P),
    yAxis: axisY(P),
    series: [{
      type: 'line', data, smooth: true,
      areaStyle: { color: P.areaSoft },
      lineStyle: { color: P.primary, width: 2 },
      itemStyle: { color: P.primary }
    }]
  }
})

const compareYears = computed(() => {
  if (!engine.value) return []
  const annualReturnVal = annualReturn.value
  const rate = store.rule?.benefit.pension.rate || 0.2
  // 与首屏同一基数口径：用户自选优先，未选按下限
  const base = effectivePensionBase.value
  const monthly = Math.round(base * rate)
  const accountRate = store.rule?.retirement.personalAccountRate ?? 0.08
  const accountMo = Math.round(base * accountRate)
  const retireAge = store.personal.expectedRetireAge
  const full = Math.max(1, retireAge - store.personal.currentAge)
  // 该基数对应的缴费指数（基数 ÷ 社平）：不传的话引擎按 0.6 下限兜底，
  // 选了高档位的用户在这一栏会看到被低估的基础养老金
  const socialAvg = socialAverageWage(
    store.rule?.benefit.pension.baseMin ?? base,
    store.rule?.benefit.pension.baseMax,
  )
  const paymentIndex = socialAvg > 0 ? base / socialAvg : undefined
  const list = [15, 20, 25, 30].filter(y => y < full)
  list.push(full)
  return list.map(years => {
    // 缴满 N 年后停缴，养老金仍在法定退休年龄领取：
    // 缴费年限只影响基础养老金与账户累积，不改变领取时点（缴 15 年不等于 40 岁退休）。
    // 成本按全额 20% 缴费计；账户滚存只用其中 8% 的个账部分。
    const r = engine.value!.projectRetirement(store.personal.currentAge, retireAge, accountMo, years, annualReturnVal, paymentIndex)
    const paid = years * 12 * monthly
    const label = years === full ? `缴至退休（${retireAge}岁）` : `缴${years}年`
    return {
      years, label,
      pension: r.totalPension,
      account: r.personalAccount,
      yearsToBreakEven: r.totalPension > 0 ? Math.round((paid / (r.totalPension * 12)) * 10) / 10 : 0,
    }
  })
})
</script>

<style scoped>
.advice-list { margin: 0; padding-left: 18px; }
.advice-list li { font-size: 12px; color: var(--color-text-secondary); line-height: 1.7; margin-bottom: 4px; }
.advice-list a { color: var(--color-text-brand); }
.base-note {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin: 8px 0 0;
  line-height: 1.6;
}
.retire-caveat {
  font-size: 11px;
  color: var(--color-text-warning);
  background: var(--color-warning-50);
  border-left: 2px solid var(--color-text-warning);
  border-radius: 0 3px 3px 0;
  padding: 6px 8px;
  margin: 0 0 8px;
  line-height: 1.6;
}
.return-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.rr-label { font-size: 12px; color: var(--color-text-secondary); }
.rr-unit { font-size: 12px; color: var(--color-text-tertiary); }
.rr-note { font-size: 11px; color: var(--color-text-tertiary); line-height: 1.6; margin: 4px 0 0; }
</style>
