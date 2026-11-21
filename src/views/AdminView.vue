<template>
  <div class="data-page admin">
    <header class="data-head">
      <div>
        <h1 class="data-title">数据管理后台</h1>
        <p class="data-sub">
          34 座城市规则的核验状态、全库条目与 7 项核心字段的官方覆盖率，以及一致性检查。本页只读，不修改任何规则。
        </p>
      </div>
      <div class="admin-actions">
        <n-button size="small" :loading="running" @click="runCheck">重新检查</n-button>
      </div>
    </header>

    <p v-if="loadNotice" class="data-note">{{ loadNotice }}</p>

    <!-- 总览指标 -->
    <DataMetricGrid :items="metrics" />

    <!-- 置信度分布图 -->
    <div class="panel">
      <h2 class="panel-title">全库溯源条目置信度分布</h2>
      <div class="bar-stack" role="img" :aria-label="`官方 ${confidenceCounts.official} 条，推算 ${confidenceCounts.derived} 条，未核实 ${confidenceCounts.unverified} 条`">
        <div class="bar official" :style="{ flexGrow: confidenceCounts.official || 0.001 }">
          <span v-if="confidenceCounts.official" aria-hidden="true">{{ confidenceCounts.official }}</span>
        </div>
        <div class="bar derived" :style="{ flexGrow: confidenceCounts.derived || 0.001 }">
          <span v-if="confidenceCounts.derived" aria-hidden="true">{{ confidenceCounts.derived }}</span>
        </div>
        <div class="bar unverified" :style="{ flexGrow: confidenceCounts.unverified || 0.001 }">
          <span v-if="confidenceCounts.unverified" aria-hidden="true">{{ confidenceCounts.unverified }}</span>
        </div>
      </div>
      <div class="legend">
        <span><i class="dot official" /> 官方原文 {{ confidenceCounts.official }} 条</span>
        <span><i class="dot derived" /> 由官方数据推算 {{ confidenceCounts.derived }} 条</span>
        <span><i class="dot unverified" /> 未核实占位 {{ confidenceCounts.unverified }} 条</span>
      </div>
    </div>

    <!-- 城市表 -->
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">城市规则明细</h2>
        <n-input v-model:value="filter" size="small" placeholder="筛选城市…" style="max-width: 200px" />
      </div>
      <div class="table-wrap">
        <table class="city-table">
          <thead>
            <tr>
              <th>城市</th>
              <th>版本</th>
              <th class="num">字段数</th>
              <th class="num">官方</th>
              <th class="num">推算</th>
              <th class="num">未核实</th>
              <th>全库条目官方率</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredRows" :key="row.id">
              <td>
                <b>{{ row.name }}</b>
                <span class="city-id">{{ row.id }}</span>
              </td>
              <td>{{ row.year ?? "—" }}</td>
              <td class="num">{{ row.totalSources }}</td>
              <td class="num">{{ row.official }}</td>
              <td class="num">{{ row.derived }}</td>
              <td class="num">{{ row.unverified }}</td>
              <td>
                <div class="mini-bar">
                  <div class="mini-fill" :style="{ width: row.officialRatio + '%' }" />
                </div>
                <span class="mini-text">{{ row.official }}/{{ row.totalSources }} · {{ row.officialRatio }}%</span>
              </td>
              <td>
                <span class="badge" :class="row.officialRatio >= 80 ? 'ok' : row.officialRatio >= 40 ? 'warn' : 'bad'">
                  {{ row.officialRatio >= 80 ? '良好' : row.officialRatio >= 40 ? '待补' : '缺口大' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 一致性检查 -->
    <div class="panel">
      <h2 class="panel-title">一致性检查</h2>
      <p class="panel-hint">对每座城市跑一次真实测算，断言净收入为正、有限、且小于总收入。</p>
      <div v-if="!checkResult" class="panel-hint">尚未检查</div>
      <div v-else class="check-result">
        <div class="check-summary" :class="checkResult.failed === 0 ? 'ok' : 'bad'">
          {{ checkResult.passed }} / {{ checkResult.total }} 座城市通过
          <span v-if="checkResult.failed">（{{ checkResult.failed }} 个失败）</span>
        </div>
        <ul v-if="checkResult.failures.length" class="failure-list">
          <li v-for="f in checkResult.failures" :key="f">{{ f }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 数据管理后台
 *
 * 为什么放在前端而不是独立后台服务：
 * 本项目零后端、数据全在 public/rules 静态文件里。做一个需要登录的后台服务，
 * 等于为了"看起来专业"引入整套鉴权、部署、运维成本，而它管理的数据本来就是公开只读的。
 * 这里直接把规则文件当数据源，在浏览器里做统计——零部署、零账号、打开即用。
 *
 * 但它解决的问题是真实的：34 个城市 × 10–12 条来源 = 343 条溯源记录，
 * 光靠人眼看不出哪座城市缺哪一项。这个页面把覆盖率变成可比较的数字。
 */
import { ref, computed, onMounted } from 'vue'
import { NButton, NInput } from 'naive-ui'

import { summarizeCityRules } from '../data/cityRules'
import DataMetricGrid from '../components/DataMetricGrid.vue'
import { useCityRules } from '../composables/useCityRules'

const { rules, notice: loadNotice, load } = useCityRules()
const filter = ref('')
const running = ref(false)
const checkResult = ref<{ total: number; passed: number; failed: number; failures: string[] } | null>(null)

const summary = computed(() => summarizeCityRules(rules.value))
const rows = computed(() => summary.value.rows)
const sourceCoverage = computed(() => summary.value.sourceCoverage)
const coreCoverage = computed(() => summary.value.coreCoverage)
const fullyVerified = computed(() => rows.value.filter((r) => r.unverified === 0).length)
const totalFields = computed(() => summary.value.totals.sources)

const metrics = computed(() => [
  { label: '城市总数', value: rows.value.length },
  { label: '已完全核验', value: fullyVerified.value, tone: 'ok' as const },
  { label: '部分待核实', value: rows.value.length - fullyVerified.value, tone: 'warn' as const },
  { label: '字段总数', value: totalFields.value },
  {
    label: '全库条目官方占比',
    value: `${sourceCoverage.value.percent}%`,
    note: `${sourceCoverage.value.numerator} / ${sourceCoverage.value.denominator} 条`,
    tone: (sourceCoverage.value.percent >= 50 ? 'ok' : 'warn') as 'ok' | 'warn',
  },
  {
    label: '7 项核心字段官方率',
    value: `${coreCoverage.value.percent}%`,
    note: `${coreCoverage.value.numerator} / ${coreCoverage.value.denominator} 格`,
    tone: (coreCoverage.value.percent >= 50 ? 'ok' : 'warn') as 'ok' | 'warn',
  },
])

const filteredRows = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((r) => r.id.includes(q) || r.name.includes(q))
})

const confidenceCounts = computed(() => ({
  official: summary.value.totals.official,
  derived: summary.value.totals.derived,
  unverified: summary.value.totals.unverified,
}))

async function runCheck(): Promise<void> {
  running.value = true
  try {
    const { calculate } = await import('../kernel/calculate')
    // 复用 load() 已经拉过的规则：此前这里为每座城市重新 fetch 一遍，
    // 页面打开一次就把 34 份 JSON 下载两遍，且第二遍与矩阵可能读到不同版本。
    const byCity = new Map(rules.value.map((rule) => [rule.city, rule]))
    const loader = async (city: string) => {
      const rule = byCity.get(city)
      if (!rule) throw new Error(`规则缺失：${city}`)
      return rule
    }

    let passed = 0
    const failures: string[] = []
    for (const c of rules.value) {
      try {
        const r = await calculate({ city: c.city }, loader)
        if (!(r.netMonthly > 0)) throw new Error('净收入非正')
        if (r.netMonthly > r.grossMonthly) throw new Error('净收入大于总收入')
        if (!Number.isFinite(r.netAnnual)) throw new Error('年净收入非有限')
        passed++
      } catch (e) {
        failures.push(`${c.cityName}（${c.city}）：${(e as Error).message}`)
      }
    }
    checkResult.value = {
      total: rules.value.length,
      passed,
      failed: failures.length,
      failures,
    }
  } finally {
    running.value = false
  }
}

onMounted(async () => {
  await load()
  await runCheck()
})
</script>

<style scoped src="../styles/dataPage.css"></style>

<style scoped>
.bar-stack {
  display: flex;
  height: 40px;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--surface-2);
}

.bar {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  /* 白字压 success-600 / warning-600 只有 3.3 / 3.2:1；深色字两档都过 4.5。 */
  color: var(--color-text-on-primary);
  transition: flex-grow var(--duration-slow) var(--ease-out);
  min-width: 2px;
}

.bar.official { background: var(--color-success-600); }
.bar.derived { background: var(--color-info-600); color: #fff; }
.bar.unverified { background: var(--color-warning-600); }

.legend { margin-top: var(--space-3); }

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.dot.official { background: var(--color-success-600); }
.dot.derived { background: var(--color-info-600); }
.dot.unverified { background: var(--color-warning-600); }

.city-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.city-table th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border-primary);
  color: var(--color-text-tertiary);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.city-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--surface-border);
  color: var(--color-text-primary);
  vertical-align: middle;
}

.city-table tr:hover td { background: var(--surface-1); }

.mini-bar {
  display: inline-block;
  width: 64px;
  height: 6px;
  background: var(--surface-2);
  border-radius: var(--radius-full);
  overflow: hidden;
  vertical-align: middle;
}

.mini-fill {
  height: 100%;
  background: var(--color-primary-500);
  border-radius: var(--radius-full);
}

.mini-text {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-left: var(--space-2);
  font-variant-numeric: tabular-nums;
}

.badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: var(--font-weight-medium);
}

.badge.ok { background: var(--color-success-100); color: var(--color-success-700); }
.badge.warn { background: var(--color-warning-100); color: var(--color-warning-700); }
.badge.bad { background: var(--color-danger-100); color: var(--color-danger-700); }

.check-summary {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  padding: var(--space-3);
  border-radius: var(--radius-md);
}

.check-summary.ok { background: var(--color-success-50); color: var(--color-success-700); }
.check-summary.bad { background: var(--color-danger-50); color: var(--color-danger-700); }

.failure-list {
  margin: var(--space-2) 0 0;
  padding-left: var(--space-5);
  font-size: var(--font-size-sm);
  color: var(--color-text-danger);
}

</style>
