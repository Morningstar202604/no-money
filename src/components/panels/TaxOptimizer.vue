<template>
  <div>
    <n-card title="税务优化分析 — 劳务报酬 vs 个体工商户" class="card">
      <n-alert type="warning" :show-icon="true" style="margin-bottom: 0">
        灵活就业者个人所得税按劳务报酬并入综合所得计税，适用税率表一（3%-45%）。
        注册个体工商户后会新增<strong>增值税</strong>与<strong>经营所得个税</strong>两个税种——原实现把增值税的 1% 优惠税率误当作个税税率，会严重低估个体户税负。
      </n-alert>
      <p class="tax-guide-link">
        税优速查：个人养老金 <b>12,000 元/年</b>、税优健康险 <b>2,400 元/年</b>、七项专项附加扣除均可税前扣除。
        前两项在左侧「税务与社保」填入实际年缴额后会参与本页与全站测算（个人养老金领取时按 3% 单独计税，本页仅算缴费期节税）——
        <RouterLink :to="{ path: '/policy', query: { tab: 'manual' } }">去「民生手册 · 保险与税优」看办理方式与原文 ↗</RouterLink>
      </p>
    </n-card>

    <n-grid :x-gap="12" cols="1 m:2" responsive="screen" style="margin-top: 12px">
      <n-gi>
        <n-card title="劳务报酬（当前）" class="card">
          <div class="tax-block">
            <div class="t-row"><span>年收入总额 <SourceTag source-key="taxPlatform" /></span><b>¥{{ labor.toLocaleString() }}</b></div>
            <div class="t-row"><span>费用减除 (20%)</span><span>-{{ (labor * 0.2).toFixed(0) }}</span></div>
            <div class="t-row"><span>基本减除</span><span>-60,000</span></div>
            <div class="t-row"><span>专项附加扣除</span><span>-{{ (store.personal.specialDeductionMonth * 12).toLocaleString() }}</span></div>
            <div v-if="extraAnnual > 0" class="t-row"><span>个人养老金 + 税优健康险</span><span>-{{ extraAnnual.toLocaleString() }}</span></div>
            <div class="t-row"><span>应纳税所得额</span><b>¥{{ taxableLabor.toLocaleString() }}</b></div>
            <div class="t-row danger"><span>年度个人所得税 <SourceTag source-key="tax" /></span><b>¥{{ laborTax.toLocaleString() }}</b></div>
            <div class="t-row danger"><span>实际税率</span><b>{{ laborRate }}%</b></div>
            <div class="t-row total"><span>全年税后收入</span><b class="ok">¥{{ afterLabor.toLocaleString() }}</b></div>
          </div>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card title="个体工商户（增值税 + 经营所得个税）" class="card">
          <div class="tax-block">
            <div class="t-row"><span>年营业额</span><b>¥{{ soleIncome.toLocaleString() }}</b></div>

            <div class="t-row" style="margin-top:6px"><span><b>一、增值税</b></span><span></span></div>
            <div class="t-row"><span>征收率（小规模减按）</span><b>{{ vatRatePct }}%</b></div>
            <div class="t-row"><span>月均是否达起征点</span><span>{{ aboveVatThreshold ? '是' : '否（免征）' }}</span></div>
            <div class="t-row"><span>年度增值税 <SourceTag source-key="soleVat" /></span><b>¥{{ vatTax.toLocaleString() }}</b></div>
            <div class="t-row note"><span>增值税起征点：月 {{ soleRule?.vatThresholdMonthly?.toLocaleString() ?? '—' }} 元；未达则免征</span><span></span></div>

            <div class="t-row" style="margin-top:6px"><span><b>二、经营所得个人所得税</b></span><span></span></div>
            <div class="t-row"><span>核定行业所得率 <SourceTag source-key="soleItr" /></span><b>{{ itrRatePct }}%<span v-if="!itrVerified" class="warn-tag">占位值</span></b></div>
            <template v-if="itrVerified">
              <div class="t-row"><span>核定应纳税所得额</span><b>¥{{ soleTaxable.toLocaleString() }}</b></div>
              <div class="t-row danger"><span>年度个人所得税</span><b>¥{{ itrTax.toLocaleString() }}</b></div>
              <div class="t-row total"><span>年度税费合计</span><b class="ok">¥{{ soleTotalTax.toLocaleString() }}</b></div>
              <div class="t-row total"><span>全年税后收入</span><b class="ok">¥{{ afterSole.toLocaleString() }}</b></div>
            </template>
            <div v-else class="t-row"><span>年度个人所得税</span><b class="text-warn">待核定，不可估算</b></div>
          </div>

          <n-alert v-if="saving > 0" type="success" :show-icon="true" style="margin-top: 10px">
            年节税：¥{{ saving.toLocaleString() }}（较劳务报酬省 {{ savingRate }}%）
          </n-alert>
            <n-alert v-else type="warning" :show-icon="true" style="margin-top: 10px">
              <div>暂无法给出个体户的节税结论。</div>
              <div v-if="!itrVerified" style="margin-top:4px">
                个税核定征收率<strong>因地区与行业而异</strong>，本产品尚未核到{{ store.rule?.cityName }}现行有效的行业所得率表，
                因此不拿占位值替你算"能省多少"——那样得到的数字不可靠，真实所得率更高时结论可能反转。
              </div>
              <div v-else style="margin-top:4px">按当前参数，注册个体工商户并不省税，反而要多缴增值税。</div>
            </n-alert>

            <n-alert type="error" :show-icon="true" style="margin-top: 8px">
              <div>核定征收率由主管税务机关按行业核定，<strong>不存在全国统一税率</strong>。</div>
              <div style="margin-top:4px">注册前请先确认两件事：① 你所属行业的实际核定率；② 你与平台的关系是否构成"经营"。</div>
              <div style="margin-top:4px">多数骑手与平台被认定为"不完全符合确立劳动关系情形"，若仍按劳务报酬计税，转换主体并不产生节税效果，却要额外承担增值税与账务合规成本。</div>
            </n-alert>
        </n-card>
      </n-gi>
    </n-grid>

    <!-- 预扣预缴 vs 年度汇算：当月现金流与次年退补 -->
    <n-card title="平台按次预扣会先扣多少钱？（与年度汇算并列的第二口径）" class="card" style="margin-top: 12px">
      <n-alert type="info" :show-icon="true" style="margin-bottom: 10px">
        本页上方算的是<strong>年度汇算清缴</strong>口径（税率表一，3%-45%）。但平台打款时通常按次
        <strong>预扣预缴</strong>（劳务报酬预扣率表二，20%/30%/40%），两者差额可能很大：
        当月到手更少，次年汇算再退。依据：国家税务总局公告2018年第61号附件2。
      </n-alert>

      <div class="t-row">
        <span>结算频率</span>
        <n-select v-model:value="paymentsPerMonth" :options="PAYMENT_OPTIONS" size="small" style="width: 190px" />
      </div>

      <div class="tax-block" style="margin-top: 8px">
        <div class="t-row"><span>月毛收入</span><b>¥{{ monthlyGross.toFixed(0) }}</b></div>
        <div class="t-row"><span>每次结算金额</span><span>¥{{ (monthlyGross / paymentsPerMonth).toFixed(0) }}</span></div>
        <div class="t-row danger"><span>当月预扣个税</span><b>¥{{ withholdingMonthlyCash.toFixed(0) }}</b></div>
        <div class="t-row"><span>预扣后当月到手（未扣社保）</span><b>¥{{ monthlyNetIfWithheld.toFixed(0) }}</b></div>
        <div class="t-row" style="margin-top:6px"><span>全年预扣合计</span><b>¥{{ withholdingAnnual.toFixed(0) }}</b></div>
        <div class="t-row"><span>年度汇算应缴</span><b>¥{{ laborTax.toFixed(0) }}</b></div>
        <div class="t-row total">
          <span>汇算后{{ refundOnSettlement >= 0 ? '可退' : '需补' }}</span>
          <b :class="refundOnSettlement >= 0 ? 'ok' : 'danger'">¥{{ Math.abs(refundOnSettlement).toFixed(0) }}</b>
        </div>
      </div>

      <div class="t-row note">
        <span>
          按日/按周结算时单笔更小，4000 元以下的 800 元定额减除可反复适用，总预扣反而更低——
          这正是「同样月入、结算方式不同、到手不同」的原因。
          预扣不是最终税负，次年 3-6 月汇算清缴多退少补。
        </span>
      </div>
    </n-card>

    <n-card title="不同收入下的税负对比" class="card" style="margin-top: 12px">
      <ChartBox :option="taxCompareOption" :height="360" />
    </n-card>

    <n-card title="个体工商户注册步骤" class="card" style="margin-top: 12px">
      <!-- 纵向排列：横向 5 步在窄屏会把整页撑出横向滚动条（其余页面的步骤条均为纵向） -->
      <n-steps :current="5" size="small" vertical>
        <n-step title="准备材料" description="身份证、经营场所证明（或电商网址）、手机号码" />
        <n-step title="线上申请" description="本省政务服务网 → 企业开办一网通办（如广东政务服务网、浙江政务服务网、上海一网通办）" />
        <n-step title="银行开户" description="选择银行预约个体户结算账户" />
        <n-step title="税务登记" description="电子税务局签三方协议，核定税种与实际经营行业" />
        <n-step title="定期申报" description="通过电子税务局按季度申报增值税与经营所得个税" />
      </n-steps>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EChartsCoreOption } from 'echarts/core'
import { NCard, NGrid, NGi, NAlert, NSteps, NStep, NSelect, NTag } from 'naive-ui'
import { useMainStore } from '../../stores/main'
import { TaxEngine, type TaxEngineConfig } from '../../engine/TaxEngine'
import { round2 } from '../../utils/number'
import { axisX, axisY, GRID, legend, chartColors } from '../../utils/chart'
import ChartBox from '../ChartBox.vue'
import SourceTag from '../SourceTag.vue'
import { calcMonthlyWithholding, settlementDelta } from '../../domain/tax/withholding'
import { yuanToCent } from '../../domain/shared/value-objects'

const store = useMainStore()

// 复用 TaxEngine（税表来自城市规则文件），不再页面内重复实现税表
const taxEngine = computed(() => store.rule ? new TaxEngine({
  laborRemuneration: store.rule.tax.laborRemuneration,
  soleProprietorship: store.rule.soleProprietorship
} as TaxEngineConfig) : null)

/**
 * 月度税前扣除 = 专项附加扣除 + 个人养老金（年缴/12）+ 税优健康险（年缴/12）。
 * 与 ScenarioService 同一口径：页面自己算税时若只扣专项附加，
 * 用户填了税优额度后本页税额会与总览/收支明细打架。
 */
const extraAnnual = computed(() =>
  (store.personal.personalPensionAnnual ?? 0) + (store.personal.taxHealthInsuranceAnnual ?? 0))
const monthlyDeduction = computed(() => store.personal.specialDeductionMonth + extraAnnual.value / 12)
/** 个体户税负参数：增值税与个税是两个税种，取自规则文件而非页面硬编码 */
const soleRule = computed(() => store.rule?.soleProprietorship)

const labor = computed(() => {
  const s = store.scenarios[0]
  return s ? s.income.grossIncome * 12 : 0
})
const laborTax = computed(() => {
  if (!taxEngine.value) return 0
  return taxEngine.value.calcLaborAnnual(labor.value, monthlyDeduction.value).annualTax
})
const taxableLabor = computed(() => Math.max(0, labor.value * 0.8 - 60000 - monthlyDeduction.value * 12))
const laborRate = computed(() => labor.value > 0 ? (laborTax.value / labor.value * 100).toFixed(1) : '0')
const afterLabor = computed(() => labor.value - laborTax.value)

/** 每月发放/结算次数：平台按月合并结算为 1，按周约 4，按日约 26 */
const paymentsPerMonth = ref(1)
const PAYMENT_OPTIONS = [
  { label: '按月结算（1 次/月）', value: 1 },
  { label: '按周结算（4 次/月）', value: 4 },
  { label: '按日结算（26 次/月）', value: 26 },
]

/**
 * 预扣预缴 vs 年度汇算：这是「当月能不能拿到钱」与「全年到底缴多少」的差额。
 * 主口径仍是汇算清缴（laborTax），此处并列展示平台按次预扣会先扣多少、
 * 次年能退多少——只给汇算口径会让用户严重低估现金流压力。
 */
const monthlyGross = computed(() => labor.value / 12)
const withholding = computed(() =>
  calcMonthlyWithholding(yuanToCent(monthlyGross.value), paymentsPerMonth.value))
const withholdingAnnual = computed(() => Number(withholding.value.annualWithheld) / 100)
const refundOnSettlement = computed(() => Number(settlementDelta(
  withholding.value.annualWithheld,
  yuanToCent(laborTax.value),
)) / 100)
const withholdingMonthlyCash = computed(() => Number(withholding.value.monthlyWithheld) / 100)
const monthlyNetIfWithheld = computed(() => monthlyGross.value - withholdingMonthlyCash.value)

const soleIncome = computed(() => labor.value)
const monthlyTurnover = computed(() => soleIncome.value / 12)
const vatRatePct = computed(() => ((soleRule.value?.vatRate ?? 0) * 100).toFixed(2).replace(/\.?0+$/, ''))
const itrRatePct = computed(() => ((soleRule.value?.itrIncomeRate ?? 0) * 100).toFixed(2).replace(/\.?0+$/, ''))

/** 未达月起征点的免征增值税（财政部 税务总局公告2026年第10号第一条） */
const aboveVatThreshold = computed(() => monthlyTurnover.value >= (soleRule.value?.vatThresholdMonthly ?? Infinity))
const vatTax = computed(() => aboveVatThreshold.value ? round2(soleIncome.value * (soleRule.value?.vatRate ?? 0)) : 0)

/**
 * 核定征收：应纳税所得额 = 经营额 × 行业所得率 − 费用减除（5000元/月×12）
 * 再套经营所得税率表。此处按占位行业所得率给出估算，
 * calcSoleProprietorship 统一处理取整与年度闭合，页面不再内联重算。
 */
const soleTaxable = computed(() => Math.max(0, soleIncome.value * (soleRule.value?.itrIncomeRate ?? 0) - 60000))
const itrTax = computed(() => {
  if (!taxEngine.value || soleTaxable.value <= 0) return 0
  return taxEngine.value.calcSoleProprietorship(soleIncome.value).annualTax
})

const soleTotalTax = computed(() => round2(vatTax.value + itrTax.value))
const afterSole = computed(() => soleIncome.value - soleTotalTax.value)

/**
 * 行业所得率是 unverified 的占位值，不是你实际会被核定的税率。
 * 用占位数得出"省税多少"的结论是不成立的——真实所得率更高时结论会反转，
 * 因此未核到本城现行有效税率表之前，只展示增值税（该税率有国家层面统一文号），
 * 个税部分明确标注为不可估算，不参与节税比较。
 */
const itrVerified = computed(() => store.rule?.sources.soleItr?.confidence === 'official')
const saving = computed(() => (itrVerified.value ? Math.max(0, laborTax.value - soleTotalTax.value) : 0))
const savingRate = computed(() => laborTax.value > 0 ? (saving.value / laborTax.value * 100).toFixed(0) : '0')

const taxCompareOption = computed<EChartsCoreOption>(() => {
  void store.isDark // 主题依赖：浅深切换后重算配色
  const incomes = [36000, 50000, 80000, 100000, 120000, 150000, 200000, 300000]
  if (!taxEngine.value) return {}
  const P = chartColors()
  const laborTaxes = incomes.map(inc => Math.round(taxEngine.value!.calcLaborAnnual(inc, monthlyDeduction.value).annualTax))
  // 个体户口径：增值税 + 核定个税，两者相加才与左侧的"劳务报酬个税"可比。
  // 核定所得率未核到本城有效税率表时，只画增值税，避免用占位数得出"省税"结论。
  const vatOnly = incomes.map(inc => (inc / 12 >= (soleRule.value?.vatThresholdMonthly ?? Infinity) ? Math.round(round2(inc * (soleRule.value?.vatRate ?? 0))) : 0))
  const soleTaxes = itrVerified.value
    ? incomes.map(inc => {
        const vat = inc / 12 >= (soleRule.value?.vatThresholdMonthly ?? Infinity) ? round2(inc * (soleRule.value?.vatRate ?? 0)) : 0
        const itr = taxEngine.value!.calcSoleProprietorship(inc).annualTax
        return Math.round(vat + itr)
      })
    : vatOnly
  return {
    tooltip: { trigger: 'axis' },
    legend: legend(['劳务报酬个税', itrVerified.value ? '个体户税费合计' : '个体户增值税（个税待核定）'], P),
    grid: GRID,
    xAxis: axisX(incomes.map(v => (v / 10000).toFixed(0) + '万'), P),
    yAxis: axisY(P),
    series: [
      { name: '劳务报酬个税', type: 'line', data: laborTaxes, smooth: true, lineStyle: { color: P.danger, width: 2 }, itemStyle: { color: P.danger } },
      { name: itrVerified.value ? '个体户税费合计' : '个体户增值税（个税待核定）', type: 'line', data: soleTaxes, smooth: true, lineStyle: { color: P.primary, width: 2, type: itrVerified.value ? 'solid' : 'dashed' }, itemStyle: { color: P.primary } }
    ]
  }
})
</script>

<style scoped>
.t-row.note { font-size: 11px; color: var(--color-text-tertiary); padding-top: 2px; padding-bottom: 2px; border-bottom: none; }
.warn-tag {
  font-size: 10px; font-weight: 600; color: var(--color-text-warning); margin-left: 6px;
  background: rgba(217,119,6,0.1); border: 1px solid rgba(217,119,6,0.25);
  border-radius: 3px; padding: 0 4px; letter-spacing: 0.3px;
}

.tax-guide-link {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--color-text-secondary);
}
.tax-guide-link b { color: var(--color-text-primary); }
.tax-guide-link a { color: var(--color-text-brand); }
</style>
