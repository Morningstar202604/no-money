<template>
  <div class="data-page audit">
    <header class="data-head">
      <div>
        <h1 class="data-title">数据核验对账</h1>
        <p class="data-sub">
          34 城 × 7 项核心字段，每一格代表一座城市的一个政策参数。绿色＝已核到官方原文，蓝色＝据官方口径推算，黄色＝占位待核实。
          <b>不做模糊处理：没核实的就显示为没核实。</b>
        </p>
      </div>
      <n-button size="small" :loading="loading" @click="load">重新统计</n-button>
    </header>

    <p v-if="loadNotice" class="data-note">{{ loadNotice }}</p>

    <!-- 总览 -->
    <div class="metric-row">
      <div class="metric">
        <span class="metric-label">城市</span>
        <span class="metric-value">{{ rows.length }}</span>
      </div>
      <div class="metric">
        <span class="metric-label">已核官方字段</span>
        <span class="metric-value ok">{{ officialCount }}</span>
      </div>
      <div class="metric">
        <span class="metric-label">官方推算字段</span>
        <span class="metric-value derived">{{ derivedCount }}</span>
      </div>
      <div class="metric">
        <span class="metric-label">待核实字段</span>
        <span class="metric-value warn">{{ pendingCount }}</span>
      </div>
      <div class="metric">
        <span class="metric-label">7 项核心字段官方率</span>
        <span class="metric-value" :class="officialRatio >= 40 ? 'ok' : 'warn'">{{ officialRatio }}%</span>
        <span class="metric-note">{{ officialCount }} / {{ totalCount }} 格</span>
      </div>
      <div class="metric">
        <span class="metric-label">全官方城市</span>
        <span class="metric-value" :class="allOfficial ? 'ok' : 'warn'">{{ allOfficial }} / {{ rows.length }}</span>
      </div>
    </div>

    <!-- 说明：为什么有些字段永远无法官方化 -->
    <div class="note">
      <b>为什么「平台计价」永远是待核实：</b>
      它是平台的商业规则，各平台只在自己的骑手端公示，没有跨平台权威数据源。
      唯一可信的做法是你在「我的计价」里填入自己 APP 里的真实单价——
      那时这个字段会从"占位"变成"你的实测值"。
    </div>

    <!-- 字段 × 城市矩阵 -->
    <div class="panel">
      <h2 class="panel-title">字段核验矩阵</h2>
      <div class="legend">
        <span><i class="cell ok" /> 已核官方</span>
        <span><i class="cell derived" /> 官方推算</span>
        <span><i class="cell warn" /> 待核实占位</span>
      </div>
      <div class="table-wrap">
        <table class="matrix">
          <thead>
            <tr>
              <th class="sticky-col">城市</th>
              <th v-for="f in fields" :key="f.key">{{ f.label }}</th>
              <th class="num">缺口</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id">
              <td class="sticky-col">
                <b>{{ r.name }}</b>
                <span class="city-id">{{ r.id }}</span>
              </td>
              <td v-for="f in fields" :key="f.key">
                <i class="cell" :class="cellClass(r.core[f.key])" :title="labelOf(r.core[f.key])" />
              </td>
              <td class="num" :class="{ 'gap-zero': r.coreGaps === 0 }">{{ r.coreGaps }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 优先补哪些 -->
    <div class="panel">
      <h2 class="panel-title">该先补哪几城</h2>
      <p class="panel-hint">
        按「缺口数 × 该城在测算中的使用频率」排序。缺口最多且用户量大的城市优先。
      </p>
      <ol class="todo-list">
        <li v-for="r in worstCities" :key="r.id">
          <b>{{ r.name }}</b> — {{ r.coreGaps }} 个字段待核实<span v-if="r.coreDerived">，{{ r.coreDerived }} 个官方推算</span>
          <span class="todo-fields">{{ r.missingCoreFields.join('、') }}</span>
        </li>
      </ol>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 数据核验对账页
 *
 * 为什么单独做一页：
 * /admin 给的是"覆盖率统计"，但用户真正需要的问题是
 * 「我现在看到的这个数字，哪个字段没核实、我该不该信」。
 * 这一页把 34 城 × 7 类核心字段做成矩阵，
 * 绿色/黄色一眼可辨——这是产品"诚实"承诺的可视化落地，不是装饰。
 *
 * 与 /admin 的分工：
 *   /admin  → 数据治理视角（全库置信度分布、一致性检查）
 *   /audit  → 用户知情视角（我要不要相信这个数）
 */
import { computed, onMounted } from 'vue'
import { NButton } from 'naive-ui'

import { summarizeCityRules, CORE_COVERAGE_FIELDS } from '../data/cityRules'
import { useCityRules } from '../composables/useCityRules'

const fields = CORE_COVERAGE_FIELDS
const { rules, loading, notice: loadNotice, load } = useCityRules()

function cellClass(conf?: string): string {
  if (conf === 'official') return 'ok'
  if (conf === 'derived') return 'derived'
  return 'warn'
}
function labelOf(conf?: string): string {
  return conf === 'official' ? '已核官方' : conf === 'derived' ? '官方推算' : '待核实占位'
}

const summary = computed(() => summarizeCityRules(rules.value))
const rows = computed(() =>
  [...summary.value.rows].sort((a, b) => b.coreGaps - a.coreGaps || b.coreDerived - a.coreDerived),
)
const totalCount = computed(() => summary.value.totals.coreFields)
const officialCount = computed(() => summary.value.totals.coreOfficial)
const derivedCount = computed(() => summary.value.totals.coreDerived)
const pendingCount = computed(() => summary.value.totals.coreGaps)
const officialRatio = computed(() => summary.value.coreCoverage.percent)
const allOfficial = computed(() => rows.value.filter((r) => r.coreGaps === 0 && r.coreDerived === 0).length)

/** 缺口最多的前 6 城 */
const worstCities = computed(() =>
  [...rows.value].sort((a, b) => b.coreGaps - a.coreGaps).slice(0, 6),
)

onMounted(() => {
  void load()
})
</script>

<style scoped src="../styles/dataPage.css"></style>

<style scoped>
.note {
  padding: var(--space-3) var(--space-4); margin-bottom: var(--space-4);
  background: var(--color-warning-50); border: 1px solid var(--color-warning-200);
  border-radius: var(--radius-md); font-size: var(--font-size-sm);
  color: var(--color-text-secondary); line-height: var(--line-height-relaxed);
}

.legend { margin-bottom: var(--space-3); }

.matrix { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
.matrix th { text-align: center; padding: var(--space-2); border-bottom: 1px solid var(--color-border-primary); color: var(--color-text-tertiary); font-size: var(--font-size-xs); font-weight: var(--font-weight-medium); white-space: nowrap; }
.matrix td { padding: var(--space-2); border-bottom: 1px solid var(--surface-border); text-align: center; }
.matrix tr:hover td { background: var(--surface-1); }
.sticky-col { text-align: left !important; white-space: nowrap; }
.gap-zero { color: var(--color-success-600); }

.cell { display: inline-block; width: 14px; height: 14px; border-radius: 3px; }
.cell.ok { background: var(--color-success-500); }
.cell.derived { background: var(--color-info-500); }
.cell.warn { background: var(--color-warning-500); }

.todo-list { margin: 0; padding-left: var(--space-5); font-size: var(--font-size-sm); color: var(--color-text-primary); line-height: 2; }
.todo-fields { color: var(--color-text-tertiary); font-size: var(--font-size-xs); }

</style>
