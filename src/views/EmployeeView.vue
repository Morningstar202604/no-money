<template>
  <div class="employee-view">
    <PageHeading />

    <section class="ep-head surface-card">
      <div>
        <span class="ep-kicker">企业职工</span>
        <h2 class="ep-title">工资条到手</h2>
        <p class="ep-desc">
          按工资条填，不猜你的社保费率。这里只算「税前工资 − 个人五险一金 − 个税」，
          不算单位缴费、年终奖、报销和补贴。
        </p>
      </div>
      <router-link class="ep-back" to="/dashboard">灵活就业算一算 →</router-link>
    </section>

    <n-alert v-if="!rule && store.loadError" type="error" :show-icon="true" style="margin-bottom:12px">
      本城规则加载失败，暂时无法计算。请检查网络后回到总览重试。
    </n-alert>
    <n-card v-else-if="!rule" title="正在加载本城规则" class="card">
      <p class="ep-muted">加载完成后，工资条结果会自动出现。</p>
    </n-card>

    <n-card v-else title="按工资条填" class="card ep-form-card">
      <div class="ep-form-grid">
        <label class="ep-field">
          <span class="ep-label">参保城市</span>
          <n-select
            :value="store.work.city"
            :options="cityOptions"
            :loading="store.loading"
            size="large"
            @update:value="changeCity"
          />
        </label>

        <label class="ep-field">
          <span class="ep-label">税前月薪（应发）</span>
          <n-input-number
            v-model:value="monthlyGross"
            :min="0"
            :precision="2"
            :show-button="false"
            size="large"
            placeholder="例如 10000"
          />
        </label>

        <label class="ep-field">
          <span class="ep-label">个人五险一金合计</span>
          <n-input-number
            v-model:value="monthlySocialFund"
            :min="0"
            :precision="2"
            :show-button="false"
            size="large"
            placeholder="工资条上“个人”列合计"
          />
          <span class="ep-hint">只填个人扣款，不含单位缴的部分；不知道可先填 0，结果会偏高。</span>
        </label>

        <label class="ep-field">
          <span class="ep-label">专项附加扣除 / 月</span>
          <n-input-number
            v-model:value="monthlySpecialDeduction"
            :min="0"
            :precision="2"
            :show-button="false"
            size="large"
            placeholder="没有填 0"
          />
        </label>
      </div>

      <n-alert v-if="inputError" type="warning" :show-icon="true" style="margin-top:12px">
        {{ inputError }}
      </n-alert>
      <n-alert v-else-if="result?.deductionsExceedGross" type="warning" :show-icon="true" style="margin-top:12px">
        个人五险一金超过税前工资，请核对工资条；这不是正常月份的结构。
      </n-alert>
      <n-alert v-else-if="result && result.monthlySocialFund === 0" type="info" :show-icon="true" style="margin-top:12px">
        个人五险一金填了 0，到手会偏高。把工资条上「个人」列的养老、医疗、失业、公积金合计填进来，结果才有参考价值。
      </n-alert>
    </n-card>

    <n-card v-if="result" title="到手结果（年度汇算口径）" class="card">
      <div class="ep-kpis">
        <div class="ep-kpi">
          <span class="ep-kpi-label">月到手</span>
          <strong class="ep-kpi-value">{{ money(result.monthlyNet) }}</strong>
          <span class="ep-kpi-foot">年度税后 ÷ 12</span>
        </div>
        <div class="ep-kpi">
          <span class="ep-kpi-label">月均个税</span>
          <strong class="ep-kpi-value">{{ money(result.monthlyTaxAverage) }}</strong>
          <span class="ep-kpi-foot">年度税额 ÷ 12</span>
        </div>
        <div class="ep-kpi">
          <span class="ep-kpi-label">年度个税</span>
          <strong class="ep-kpi-value">{{ money(result.annualTax) }}</strong>
          <span class="ep-kpi-foot">综合所得年度汇算</span>
        </div>
        <div class="ep-kpi">
          <span class="ep-kpi-label">年度到手</span>
          <strong class="ep-kpi-value">{{ money(result.annualNet) }}</strong>
          <span class="ep-kpi-foot">税前 − 个税 − 个人五险一金</span>
        </div>
      </div>

      <div class="ep-breakdown">
        <span>年税前 <b>{{ money(result.annualGross) }}</b></span>
        <span>年应纳税所得额 <b>{{ money(result.annualTaxable) }}</b></span>
        <span>个人五险一金/月 <b>{{ money(result.monthlySocialFund) }}</b></span>
        <span>专项附加扣除/月 <b>{{ money(result.monthlySpecialDeduction) }}</b></span>
        <span>有效税率 <b>{{ result.effectiveRate.toFixed(2) }}%</b></span>
      </div>

      <n-alert type="info" :show-icon="true" style="margin-top:12px">
        个税按年度综合所得口径计算，月到手是年度结果 ÷ 12；公司每月实际预扣可能前低后高，年度合计以这里为准。
        本页不含年终奖、加班费、报销、补贴和单位缴费，也不替代税务师意见。
      </n-alert>
    </n-card>

    <div v-else-if="rule" class="ep-empty surface-card">
      先填税前月薪，结果会自动出现。想知道自己该拿哪些权益，回
      <router-link class="link-brand" to="/start">办事入口</router-link> 看清单。
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NCard, NAlert, NSelect, NInputNumber } from 'naive-ui'
import { createPageHeading } from '../components/PageHeading'
import { useMainStore } from '../stores/main'
import { CITY_REGISTRY } from '../data/cities'
import { calcEmployeePay } from '../application/employee/EmployeePayService'

const PageHeading = createPageHeading('employee')
const store = useMainStore()
const rule = computed(() => store.rule)
const cityOptions = CITY_REGISTRY.map(c => ({ label: `${c.label} · ${c.province}`, value: c.value }))

const monthlyGross = ref<number | null>(null)
const monthlySocialFund = ref<number | null>(0)
const monthlySpecialDeduction = ref<number | null>(0)

function changeCity(city: string) {
  void store.setCity(city)
}

const payResult = computed(() => {
  const gross = monthlyGross.value
  if (!rule.value || gross === null || gross <= 0) return null
  return calcEmployeePay({
    monthlyGross: gross,
    monthlySocialFund: monthlySocialFund.value ?? 0,
    monthlySpecialDeduction: monthlySpecialDeduction.value ?? 0,
  }, rule.value)
})
const result = computed(() => payResult.value?.ok ? payResult.value.value : null)
const inputError = computed(() => payResult.value && !payResult.value.ok ? payResult.value.error.message : null)

function money(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
</script>

<style scoped>
.employee-view { max-width: 840px; margin: 0 auto; }
.ep-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding: 18px 20px; margin-bottom: 12px; }
.ep-kicker { display: inline-block; font-size: 11px; color: var(--color-text-brand); background: var(--color-primary-50); border: 1px solid var(--color-primary-100); border-radius: var(--radius-full); padding: 2px 8px; }
.ep-title { margin: 7px 0 4px; font-size: var(--font-size-xl); color: var(--color-text-primary); }
.ep-desc { margin: 0; max-width: 600px; font-size: var(--font-size-sm); line-height: 1.7; color: var(--color-text-secondary); }
.ep-back { flex: none; display: inline-flex; align-items: center; min-height: 24px; color: var(--color-text-brand); font-size: var(--font-size-xs); text-decoration: none; white-space: nowrap; }
.ep-back:hover { text-decoration: underline; }
.ep-form-card { margin-bottom: 12px; }
.ep-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.ep-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ep-label { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-primary); }
.ep-hint { font-size: 11px; line-height: 1.55; color: var(--color-text-tertiary); }
.ep-muted { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-secondary); }
.ep-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.ep-kpi { padding: 12px; border: 1px solid var(--color-border-primary); border-radius: var(--radius-md); background: var(--color-bg-secondary); }
.ep-kpi-label { display: block; font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.ep-kpi-value { display: block; margin: 4px 0; font-family: var(--font-family-num); font-variant-numeric: tabular-nums; font-size: 21px; color: var(--color-text-primary); }
.ep-kpi-foot { display: block; font-size: 10px; line-height: 1.45; color: var(--color-text-tertiary); }
.ep-breakdown { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 14px; font-size: var(--font-size-xs); line-height: 1.7; color: var(--color-text-secondary); }
.ep-breakdown b { color: var(--color-text-primary); font-family: var(--font-family-num); }
.ep-empty { padding: 14px 16px; font-size: var(--font-size-sm); line-height: 1.7; color: var(--color-text-secondary); }
@media (max-width: 640px) {
  .employee-view { padding-bottom: 76px; }
  .ep-head { flex-direction: column; }
  .ep-form-grid, .ep-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ep-kpis { gap: 8px; }
  .ep-kpi { padding: 10px; }
  .ep-kpi-value {
    font-size: clamp(16px, 4.4vw, 19px);
    letter-spacing: -0.02em;
    white-space: nowrap;
  }
}
</style>
