<template>
  <div>
    <n-alert v-if="incomeOverridden" type="success" :show-icon="true" style="margin-bottom: 12px">
      <div><strong>计价参数已按你填写的实际值计算</strong>：下方拆解里的单价与倍率均为你在「我的计价」中填写的数值，
      不是本城占位值，也不是官方发布数据。</div>
    </n-alert>
    <n-alert v-else-if="incomeUnverified" type="warning" :show-icon="true" style="margin-bottom: 12px">
      <div><strong>{{ rule?.cityName }}的计价参数未核实</strong>：平台单价与计价系数属平台商业规则，无跨平台权威数据源，
      当前多数城市共用同一套占位值，<strong>不代表本城真实单价</strong>。</div>
      <div style="margin-top:4px">请在左侧「我的计价」填入你 APP 内的实际单价与倍率，否则整条收入链都是假设。</div>
    </n-alert>

    <n-grid :x-gap="12" cols="1 m:2" responsive="screen">
      <n-gi>
        <n-card title="收入结构拆解" class="card">
          <n-skeleton v-if="!s" height="200px" />
          <div v-else class="detail-block">
            <div class="d-row"><span>基础配送费 ({{ s.work.dailyOrders }}单 × ¥{{ effectivePrice.basePricePerOrder }} × {{ s.work.workDaysMonth }}天)</span><b>¥{{ s.income.basePay.toLocaleString() }}</b></div>
            <div class="d-row"><span>距离加价 ({{ s.work.dailyOrders }}单 × {{ s.work.avgDistance }}km × ¥{{ effectivePrice.distanceRate }} × {{ s.work.workDaysMonth }}天)</span><b>¥{{ s.income.distancePay.toLocaleString() }}</b></div>
            <div v-if="s.income.weightPay > 0" class="d-row"><span>超重件加价 ({{ s.work.dailyOrders }}单 × 超重 {{ overweightKg.toFixed(1) }}kg × ¥{{ rule?.income.weightSurcharge.rate }} × {{ s.work.workDaysMonth }}天)</span><b>¥{{ s.income.weightPay.toLocaleString() }}</b></div>
            <div class="d-row"><span>时段补贴 (高峰 × {{ effectivePrice.peakMultiplier }})</span><b>¥{{ s.income.subsidyPay.toLocaleString() }}</b></div>
            <div v-if="s.income.bonusPay > 0" class="d-row"><span>冲单奖励</span><b>¥{{ s.income.bonusPay }}</b></div>
            <div class="d-row total"><span>月总收入 <SourceTag source-key="income" /></span><b>¥{{ s.income.grossIncome.toLocaleString() }}</b></div>
            <div class="d-row"><span>日均收入</span><b>¥{{ safeDiv(s.income.grossIncome, s.work.workDaysMonth, 0) }}</b></div>
            <div class="d-row"><span>时均收入</span><b>¥{{ safeDiv(s.income.grossIncome, s.work.dailyHours * s.work.workDaysMonth, 1) }}/h</b></div>
          </div>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card title="成本结构拆解" class="card">
          <n-skeleton v-if="!s" height="240px" />
          <div v-else class="detail-block">
            <!-- 必须读 costBreakdown（已按车型过滤），不能读 s.costs（原始输入）：
                 电动车用户看不到的油费此前仍被加进这一行，与月总成本对不上 -->
            <div class="d-row"><span>油费/电费</span><b>¥{{ (s.costBreakdown.fuelCostMonth + s.costBreakdown.electricityCostMonth).toLocaleString() }}</b></div>
            <div class="d-row"><span>车辆维护</span><b>¥{{ s.costBreakdown.maintenanceMonth.toLocaleString() }}</b></div>
            <div class="d-row"><span>保险</span><b>¥{{ s.costBreakdown.insuranceMonth.toLocaleString() }}</b></div>
            <div class="d-row"><span>通讯</span><b>¥{{ s.costBreakdown.phoneCostMonth.toLocaleString() }}</b></div>
            <div class="d-row"><span>餐饮</span><b>¥{{ s.costBreakdown.foodCostMonth.toLocaleString() }}</b></div>
            <div class="d-row"><span>交通罚款</span><b>¥{{ s.costBreakdown.trafficFineMonth.toLocaleString() }}</b></div>
            <div class="d-row"><span>车辆折旧</span><b>¥{{ s.costBreakdown.vehicleDepreciationMonth.toLocaleString() }}</b></div>
            <div class="d-row"><span>其他</span><b>¥{{ s.costBreakdown.otherCostMonth.toLocaleString() }}</b></div>
            <div class="d-row total"><span>月总成本</span><b class="danger">¥{{ s.costBreakdown.total.toLocaleString() }}</b></div>
            <div class="d-row"><span>每单成本</span><b>¥{{ safeDiv(s.costBreakdown.total, s.work.dailyOrders * s.work.workDaysMonth, 2) }}/单</b></div>
          </div>

          <n-divider style="margin: 10px 0" />
          <!-- 单位经济学：把成本拆成「固定 + 每公里」，才能回答「多跑一单多赚多少」 -->
          <div v-if="unitEconomics" class="detail-block">
            <div class="ue-title">按里程的成本模型（车辆单位经济学）</div>
            <!-- 这些参数必须可校准：README 承诺「可用自己的账本校准」，
                 但此前全是硬编码默认值，用户无法输入 -->
            <div class="ue-controls">
              <div class="ue-ctl">
                <span class="ue-ctl-label">空驶率</span>
                <n-slider :value="Math.round(deadheadRatio * 100)" :min="0" :max="60" :step="5" style="flex:1;min-width:110px"
                  @update:value="(v: number) => store.personal.deadheadRatio = v / 100" />
                <span class="ue-ctl-value">{{ (deadheadRatio * 100).toFixed(0) }}%</span>
              </div>
              <div class="ue-ctl">
                <span class="ue-ctl-label">{{ store.costs.vehicleType === 'fuel' ? '百公里油耗' : '百公里电耗' }}</span>
                <n-input-number
                  :value="store.personal.vehicleProfile?.energyPer100km ?? vehicleProfile.energyPer100km"
                  :min="0" :max="50" :step="0.1" size="small" style="width:84px"
                  @update:value="(v: number | null) => setVehicleProfile('energyPer100km', v)" />
                <span class="ue-ctl-label">{{ store.costs.vehicleType === 'fuel' ? 'L/100km' : 'kWh/100km' }}</span>
              </div>
              <div class="ue-ctl">
                <span class="ue-ctl-label">能源单价</span>
                <n-input-number
                  :value="store.personal.vehicleProfile?.energyPrice ?? vehicleProfile.energyPrice"
                  :min="0" :max="20" :step="0.1" size="small" style="width:84px"
                  @update:value="(v: number | null) => setVehicleProfile('energyPrice', v)" />
                <span class="ue-ctl-label">{{ store.costs.vehicleType === 'fuel' ? '元/L' : '元/kWh' }}</span>
              </div>
            </div>
            <div class="d-row"><span>月行驶里程（含 {{ (deadheadRatio * 100).toFixed(0) }}% 空驶）</span><b>{{ unitEconomics.monthlyKm.toLocaleString() }} km</b></div>
            <div class="d-row"><span>每公里变动成本</span><b>¥{{ unitEconomics.variablePerKm.toFixed(3) }}/km</b></div>
            <div class="d-row note"><span>能耗 ¥{{ unitEconomics.energyPerKm.toFixed(3) }} + 保养 ¥{{ unitEconomics.maintenancePerKm.toFixed(3) }} + 易损 ¥{{ unitEconomics.wearPerKm.toFixed(3) }} + 折旧 ¥{{ unitEconomics.depreciationPerKm.toFixed(3) }}</span><span></span></div>
            <div class="d-row"><span>月度变动成本</span><b>¥{{ unitEconomics.monthlyVariable.toLocaleString() }}</b></div>
            <div class="d-row total"><span>固定 + 变动合计</span><b>¥{{ unitEconomics.monthlyTotal.toLocaleString() }}</b></div>
            <!-- 两套口径并列必然出现差额，必须解释而不是让用户自己猜：
                 上方月总成本把维护/折旧按整月固定额计，这里改成按里程摊销 -->
            <div class="d-row note">
              <span>
                与上方月总成本相差 ¥{{ costModelGap.toLocaleString() }}：上方把维护与折旧按整月固定额计，
                此处按实际里程摊销。里程越低，按里程口径越省——两套口径都在，是为了让你看到
                「多跑单成本也会涨」这件事，净收入仍按上方固定额口径计算（更保守）。
              </span><span></span>
            </div>
            <div class="d-row"><span>每单边际成本（多跑一单多花）</span><b>¥{{ marginalCostPerOrder.toFixed(2) }}</b></div>
            <div class="d-row note">
              <span>
                多跑一单的收入约 ¥{{ marginalRevenuePerOrder.toFixed(2) }}，边际成本 ¥{{ marginalCostPerOrder.toFixed(2) }}，
                {{ marginalProfitPerOrder >= 0 ? '边际仍是正收益' : '边际已为负——多跑反而更亏' }}。
                成本项按「固定 + 每公里」建模，所以多跑单不会像固定成本模型那样「成本不变」。
              </span>
            </div>
          </div>
        </n-card>
      </n-gi>
    </n-grid>

    <!-- 广告口径校验：把招聘话术翻译成单量与工时 -->
    <FoldCard
      title="广告口径校验 — 招聘说月入过万，要跑成什么样？"
      summary="把宣传数字翻译成单量与工时"
      style="margin-top: 12px"
    >
      <div class="ad-claim">
        <div class="ac-row">
          <span class="ac-label">广告/招聘宣称的月收入（元）</span>
          <n-input-number v-model:value="adClaim" :min="1000" :max="50000" :step="1000" size="small" style="width: 160px" />
        </div>

        <p v-if="!store.rule" class="ac-note">规则文件加载中，稍后自动换算…</p>
        <template v-else-if="adSolve">
          <div class="ac-result">
            按本城计价与你的成本结构，达到 <b>¥{{ adClaim.toLocaleString() }}</b>/月净收入需要：
            日均 <b>{{ adSolve.ordersPerDay }} 单</b> / 约 <b>{{ adSolve.hoursPerDay }} 小时</b>，
            相当于当前强度的 <b>{{ adSolve.intensityRatio }}×</b>
            （当前 {{ store.work.dailyOrders }}单 · {{ store.work.dailyHours }}h × {{ store.work.workDaysMonth }}天）。
          </div>
          <n-alert v-if="adSolve.hoursPerDay >= 12 || adSolve.intensityRatio >= 1.8" type="warning" :show-icon="true">
            这个强度已超出常人体力可持续范围（行业普遍反映 12 小时以上连续跑单会显著抬升事故与健康风险）。
            广告数字能到，但它不是「常态收入」——是透支出来的上限。
          </n-alert>
          <p v-else class="ac-note">
            换算假设：全月 {{ store.work.workDaysMonth }} 天全勤、单量按同强度等比例增加、不含新增罚款与意外支出。
            实际达成难度只高不低。
          </p>
        </template>
        <n-alert v-else type="error" :show-icon="true">
          在本城计价与你当前成本下，即便把强度拉到 {{ adMax.hours }} 小时/天、日均 {{ adMax.orders }} 单（已超出工具滑块上限），也到不了这个数。
          这种广告通常意味着：其他城市/其他平台的计价、含未披露的补贴期、或发布方根本没跑过这一行。
          让对方提供「达成者的实际流水」再谈。
        </n-alert>
      </div>

      <n-divider style="margin: 12px 0" />
      <RealityList :facts="incomeFacts" />
    </FoldCard>

    <!-- 图表分析：默认收起 -->
    <FoldCard
      title="图表分析"
      summary="收支瀑布 · 成本占比 · 年度预测"
      style="margin-top: 12px"
    >
      <n-grid :x-gap="12" cols="1 m:2" responsive="screen">
        <n-gi>
          <n-card title="收入 vs 成本 vs 税后净收入" class="card">
            <ChartBox :option="waterfallOption" :height="320" />
          </n-card>
        </n-gi>
        <n-gi>
          <n-card title="成本占比" class="card">
            <ChartBox :option="costPieOption" :height="320" />
          </n-card>
        </n-gi>
      </n-grid>

      <n-card title="年度收支预测（行业季节性示意）" class="card" style="margin-top: 12px">
        <p class="yearly-note">
          下图的月度波动来自<strong>固定的行业季节性系数</strong>（春节前高峰、盛夏与年末回落），
          与你填写的「月雨天 / 月节假日」无关，也不是对你所在城市的预测——
          它只回答「同样月均收入下，一年里各月的相对起伏大概长什么样」。
        </p>
        <ChartBox :option="yearlyOption" :height="320" />
        <p class="yearly-note">
          图表中成本随收入同比例缩放，与左侧「成本按里程变动」的模型不同：固定成本不随单量下降，
          真实淡季的净收入会比这条曲线更差。
        </p>
      </n-card>
    </FoldCard>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EChartsCoreOption } from 'echarts/core'
import { NCard, NGrid, NGi, NInputNumber, NDivider, NAlert, NSlider, NSkeleton } from 'naive-ui'
import { useMainStore } from '../../stores/main'
import { formatDivide } from '../../domain/shared/number'
import {
  calcMonthlyCostByKm,
  estimateMonthlyKm,
  variableCostPerKm,
  DEFAULT_ELECTRIC_PROFILE,
  DEFAULT_FUEL_PROFILE,
} from '../../domain/income/vehicleCost'
import { axisX, axisY, GRID, chartColors } from '../../utils/chart'
import { solveAdClaim, realityFactsBy } from '../../utils/reality'
import { ScenarioService } from '../../application/scenario/ScenarioService'
import ChartBox from '../ChartBox.vue'
import SourceTag from '../SourceTag.vue'
import FoldCard from '../FoldCard.vue'
import RealityList from '../RealityList.vue'

const store = useMainStore()
const s = computed(() => store.scenarios[0])
const rule = computed(() => store.rule)

const incomeFacts = realityFactsBy(['ad-upper-bound', 'rookie-gap', 'penalty-reality', 'seasonal-gap'])

/** 本城计价参数是否已核实：unverified 时在页顶显著提示，避免用户把占位单价当真实收入 */
const incomeUnverified = computed(() => rule.value?.sources?.income?.confidence === 'unverified')

/** 用户是否已用自己的流水覆盖计价（覆盖后页顶应改为绿色确认，而非继续说"用占位值"） */
const incomeOverridden = computed(() => {
  const o = store.personal.incomeOverrides
  if (!o) return false
  return [o.basePricePerOrder, o.distanceRate, o.peakMultiplier, o.rainSurcharge, o.holidayMultiplier]
    .some(v => typeof v === 'number' && Number.isFinite(v) && v > 0)
})

/**
 * 拆解标题里展示的「实际生效单价」：有覆盖用覆盖值，否则用规则占位值。
 * 此前标题直接读 rule.income，覆盖后金额按覆盖值算、算式却显示占位值，
 * 同一行里出现两个单价。
 */
const effectivePrice = computed(() => {
  const o = store.personal.incomeOverrides
  const r = rule.value?.income
  return {
    basePricePerOrder: o?.basePricePerOrder ?? r?.basePricePerOrder ?? 0,
    distanceRate: o?.distanceRate ?? r?.distanceRate ?? 0,
    peakMultiplier: o?.peakMultiplier ?? r?.timeSubsidy.multiplier ?? 0,
  }
})

/** 超重公斤数：单均重量 − 阈值，负值按 0 */
const overweightKg = computed(() => {
  const weight = store.personal.incomeOverrides?.avgWeightKg ?? 0
  const threshold = rule.value?.income.weightSurcharge.threshold ?? 0
  return Math.max(0, weight - threshold)
})

/**
 * 车辆单位经济学：按里程的成本模型。默认参数是行业量级假设，
 * 用于展示「多跑一单的边际成本」，与上方月度固定额成本并列不冲突
 * （固定额仍用于净收入计算，两者口径不同，界面分开标注）。
 */
const deadheadRatio = computed(() => store.personal.deadheadRatio ?? 0.25)
/** 车辆档案：车型默认值 + 用户按自己账本填的覆盖（能耗/保养/购车价等） */
const vehicleProfile = computed(() => {
  const base = store.costs.vehicleType === 'fuel' ? DEFAULT_FUEL_PROFILE : DEFAULT_ELECTRIC_PROFILE
  const o = store.personal.vehicleProfile
  if (!o) return base
  return {
    energyPer100km: o.energyPer100km ?? base.energyPer100km,
    energyPrice: o.energyPrice ?? base.energyPrice,
    maintenanceIntervalKm: o.maintenanceIntervalKm ?? base.maintenanceIntervalKm,
    maintenanceCostPerService: o.maintenanceCostPerService ?? base.maintenanceCostPerService,
    wearPerKm: o.wearPerKm ?? base.wearPerKm,
    purchasePrice: o.purchasePrice ?? base.purchasePrice,
    lifetimeKm: o.lifetimeKm ?? base.lifetimeKm,
    residualRate: o.residualRate ?? base.residualRate,
  }
})
const unitEconomics = computed(() => {
  const v = s.value
  if (!v) return null
  const km = estimateMonthlyKm(v.work.dailyOrders, v.work.avgDistance, v.work.workDaysMonth, deadheadRatio.value)
  return calcMonthlyCostByKm(store.costs, km, vehicleProfile.value)
})
const marginalCostPerOrder = computed(() => {
  const v = s.value
  if (!v) return 0
  const perKm = variableCostPerKm(vehicleProfile.value).variablePerKm
  const kmPerOrder = v.work.avgDistance * (1 + deadheadRatio.value)
  return kmPerOrder * perKm
})
const marginalRevenuePerOrder = computed(() => {
  const v = s.value
  if (!v || v.work.dailyOrders <= 0) return 0
  return v.income.grossIncome / (v.work.dailyOrders * v.work.workDaysMonth)
})
const marginalProfitPerOrder = computed(() => marginalRevenuePerOrder.value - marginalCostPerOrder.value)
/** 两套成本口径的差额（见模板说明）：固定额口径 − 按里程口径 */
const costModelGap = computed(() => {
  const v = s.value
  if (!v || !unitEconomics.value) return 0
  return Math.max(0, Math.round(v.costBreakdown.total - unitEconomics.value.monthlyTotal))
})

/** 设置车辆档案字段：空值即恢复默认，不写入 undefined 键 */
function setVehicleProfile(key: 'energyPer100km' | 'energyPrice' | 'purchasePrice' | 'lifetimeKm' | 'wearPerKm' | 'residualRate' | 'maintenanceIntervalKm' | 'maintenanceCostPerService', v: number | null) {
  const next = { ...(store.personal.vehicleProfile ?? {}) }
  if (v === null || !Number.isFinite(v)) delete next[key]
  else next[key] = v
  store.personal.vehicleProfile = Object.keys(next).length > 0 ? next : undefined
}

/** 广告口径校验：用现有引擎做二分求解，单量与工时按同强度等比例放大 */
const AD_MAX_HOURS = 16
const adClaim = ref(10000)

const adMax = computed(() => ({
  hours: AD_MAX_HOURS,
  orders: Math.floor(store.work.dailyOrders * (AD_MAX_HOURS / Math.max(1, store.work.dailyHours))),
}))

const adSolve = computed(() => {
  if (!rule.value) return null
  // 必须带用户的实测计价：否则填了「我的计价」后，广告反算仍按占位单价，
  // 与页面其他数字口径不一致
  const svc = new ScenarioService(rule.value, store.personal.incomeOverrides)
  return solveAdClaim({
    targetNetMonthly: adClaim.value,
    currentOrdersPerDay: store.work.dailyOrders,
    currentHoursPerDay: store.work.dailyHours,
    maxHoursPerDay: AD_MAX_HOURS,
    netAt: (orders, hours) => {
      const r = svc.runScenario({
        id: 'ad-probe',
        name: 'ad-probe',
        work: { ...store.work, dailyOrders: Math.round(orders), dailyHours: hours },
        costs: store.costs,
        personal: store.personal,
      })
      return r.ok ? r.value.netMonthly : 0
    },
  })
})

// 安全除法（含格式化）：实现见 domain/shared/number.ts 的 formatDivide
const safeDiv = formatDivide

const waterfallOption = computed<EChartsCoreOption>(() => {
  void store.isDark // 主题依赖：浅深切换后重算配色
  const v = s.value
  if (!v) return {}
  const P = chartColors()
  const gross = v.income.grossIncome
  const tax = Math.round(v.tax.annualTax / 12)
  const cost = v.costBreakdown.total
  const net = v.netMonthly
  return {
    tooltip: { trigger: 'axis' },
    grid: GRID,
    xAxis: axisX(['月总收入', '减税', '减成本', '减社保', '月净收入'], P),
    yAxis: axisY(P),
    series: [{
      type: 'bar', data: [
        { value: gross, itemStyle: { color: P.primary } },
        { value: -tax, itemStyle: { color: P.warn } },
        { value: -cost, itemStyle: { color: P.danger } },
        { value: -v.benefit.totalMonthly, itemStyle: { color: P.light } },
        { value: net, itemStyle: { color: P.safe } }
      ],
      barWidth: '40%'
    }]
  }
})

const costPieOption = computed<EChartsCoreOption>(() => {
  void store.isDark
  // 必须读 costBreakdown（已按车型过滤），不能读 s.costs 的原始输入：
  // 电动车用户看不到的油费此前仍被画进饼图，分片和与「月总成本」对不上
  const c = s.value?.costBreakdown
  if (!c) return {}
  const P = chartColors()
  const palette = [P.primary, P.warn, P.danger, P.safe, P.gray, P.light]
  const data = [
    { name: '油费/电费', value: c.fuelCostMonth + c.electricityCostMonth },
    { name: '维护', value: c.maintenanceMonth },
    { name: '保险', value: c.insuranceMonth },
    { name: '通讯', value: c.phoneCostMonth },
    { name: '餐饮', value: c.foodCostMonth },
    { name: '罚款', value: c.trafficFineMonth },
    { name: '折旧', value: c.vehicleDepreciationMonth },
    { name: '其他', value: c.otherCostMonth },
  ].filter(d => d.value > 0).map((d, i) => ({ ...d, itemStyle: { color: palette[i % palette.length] } }))
  return {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', right: '5%', top: 'center', textStyle: { fontSize: 11, color: P.legendText } },
    series: [{
      type: 'pie', radius: ['40%', '68%'], center: ['38%', '50%'],
      label: { show: true, fontSize: 11, color: P.axisLabel },
      data
    }]
  }
})

const yearlyOption = computed<EChartsCoreOption>(() => {
  void store.isDark
  const v = s.value
  if (!v) return {}
  const P = chartColors()
  const factors = [0.93, 0.88, 0.98, 1.03, 1.07, 1.10, 1.13, 1.10, 1.05, 0.97, 0.90, 0.85]
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
  const incomes = factors.map(f => Math.round(v.income.grossIncome * f))
  const costs = factors.map(f => Math.round(v.costBreakdown.total * f))
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['月收入', '运营成本', '净收入'], textStyle: { fontSize: 11, color: P.legendText } },
    grid: GRID,
    xAxis: axisX(months, P),
    yAxis: axisY(P),
    series: [
      { name: '月收入', type: 'bar', data: incomes, itemStyle: { color: P.primary }, barWidth: '25%' },
      { name: '运营成本', type: 'bar', data: costs, itemStyle: { color: P.warn }, barWidth: '25%' },
      { name: '净收入', type: 'line', data: incomes.map((inc, i) => inc - costs[i] - Math.round(v.tax.annualTax / 12)), smooth: true, lineStyle: { color: P.safe, width: 2 }, itemStyle: { color: P.safe } }
    ]
  }
})
</script>

<style scoped>
/* 单位经济学校准区：空驶率滑块 + 能耗/单价输入，窄屏必须换行，
   否则「25%百公里能耗」会粘在一起（此前没有任何样式定义，全靠默认行内流） */
.ue-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 6px;
}
.ue-controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  margin-bottom: 8px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
}
.ue-ctl {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ue-ctl-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}
.ue-ctl-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  min-width: 34px;
}
.yearly-note {
  margin: 0 0 8px;
  font-size: 11px;
  line-height: 1.65;
  color: var(--color-text-tertiary);
}
.ad-claim {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ac-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.ac-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}
.ac-result {
  font-size: 13px;
  line-height: 1.8;
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}
.ac-result b {
  color: var(--color-text-primary);
  font-family: var(--font-family-num);
}
.ac-note {
  font-size: 11px;
  color: var(--color-text-tertiary);
  line-height: 1.6;
  margin: 0;
}
</style>
