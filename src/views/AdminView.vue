<template>
  <div class="admin">
    <header class="admin-head">
      <div>
        <h1 class="admin-title">数据管理后台</h1>
        <p class="admin-sub">
          34 座城市规则的核验状态、字段覆盖率与一致性检查。本页只读，不修改任何规则。
        </p>
      </div>
      <div class="admin-actions">
        <n-button size="small" :loading="running" @click="runCheck">重新检查</n-button>
      </div>
    </header>

    <!-- 总览指标 -->
    <div class="metric-row">
      <div class="metric">
        <span class="metric-label">城市总数</span>
        <span class="metric-value">{{ cities.length }}</span>
      </div>
      <div class="metric">
        <span class="metric-label">已完全核验</span>
        <span class="metric-value ok">{{ fullyVerified }}</span>
      </div>
      <div class="metric">
        <span class="metric-label">部分待核实</span>
        <span class="metric-value warn">{{ cities.length - fullyVerified }}</span>
      </div>
      <div class="metric">
        <span class="metric-label">字段总数</span>
        <span class="metric-value">{{ totalFields }}</span>
      </div>
      <div class="metric">
        <span class="metric-label">官方来源占比</span>
        <span class="metric-value" :class="officialRatio >= 50 ? 'ok' : 'warn'">{{ officialRatio }}%</span>
      </div>
    </div>

    <!-- 置信度分布图 -->
    <div class="panel">
      <h2 class="panel-title">全库字段置信度分布</h2>
      <div class="bar-stack" role="img" :aria-label="`官方 ${confidenceCounts.official} 项，推算 ${confidenceCounts.derived} 项，未核实 ${confidenceCounts.unverified} 项`">
        <div class="bar official" :style="{ flexGrow: confidenceCounts.official || 0.001 }">
          <span v-if="confidenceCounts.official">{{ confidenceCounts.official }}</span>
        </div>
        <div class="bar derived" :style="{ flexGrow: confidenceCounts.derived || 0.001 }">
          <span v-if="confidenceCounts.derived">{{ confidenceCounts.derived }}</span>
        </div>
        <div class="bar unverified" :style="{ flexGrow: confidenceCounts.unverified || 0.001 }">
          <span v-if="confidenceCounts.unverified">{{ confidenceCounts.unverified }}</span>
        </div>
      </div>
      <div class="legend">
        <span><i class="dot official" /> 官方原文 {{ confidenceCounts.official }}</span>
        <span><i class="dot derived" /> 由官方数据推算 {{ confidenceCounts.derived }}</span>
        <span><i class="dot unverified" /> 未核实占位 {{ confidenceCounts.unverified }}</span>
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
              <th>覆盖率</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredRows" :key="row.id">
              <td>
                <b>{{ row.name }}</b>
                <span class="city-id">{{ row.id }}</span>
              </td>
              <td>{{ row.year }}</td>
              <td class="num">{{ row.total }}</td>
              <td class="num">{{ row.official }}</td>
              <td class="num">{{ row.derived }}</td>
              <td class="num">{{ row.unverified }}</td>
              <td>
                <div class="mini-bar">
                  <div class="mini-fill" :style="{ width: row.ratio + '%' }" />
                </div>
                <span class="mini-text">{{ row.ratio }}%</span>
              </td>
              <td>
                <span class="badge" :class="row.ratio >= 80 ? 'ok' : row.ratio >= 40 ? 'warn' : 'bad'">
                  {{ row.ratio >= 80 ? '良好' : row.ratio >= 40 ? '待补' : '缺口大' }}
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
 * 但它解决的问题是真实的：34 个城市 × 9 类字段 = 300+ 条溯源记录，
 * 光靠人眼看不出哪座城市缺哪一项。这个页面把覆盖率变成可比较的数字。
 */
import { ref, computed, onMounted } from 'vue'
import { NButton, NInput } from 'naive-ui'

interface CityRuleLike {
  city: string
  cityName: string
  year: number
  lastCheckedAt?: string
  verified?: boolean
  sources?: Record<string, { confidence?: string; title?: string }>
}

interface Row {
  id: string
  name: string
  year: number
  total: number
  official: number
  derived: number
  unverified: number
  ratio: number
}

const cities = ref<CityRuleLike[]>([])
const filter = ref('')
const running = ref(false)
const checkResult = ref<{ total: number; passed: number; failed: number; failures: string[] } | null>(null)

const rows = computed<Row[]>(() =>
  cities.value.map((c) => {
    const srcs = Object.values(c.sources ?? {})
    const official = srcs.filter((s) => s.confidence === 'official').length
    const derived = srcs.filter((s) => s.confidence === 'derived').length
    const unverified = srcs.filter((s) => s.confidence !== 'official' && s.confidence !== 'derived').length
    const total = srcs.length || 1
    return {
      id: c.city,
      name: c.cityName,
      year: c.year,
      total: srcs.length,
      official,
      derived,
      unverified,
      ratio: Math.round((official / total) * 100),
    }
  }),
)

const filteredRows = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((r) => r.id.includes(q) || r.name.includes(q))
})

const fullyVerified = computed(() => rows.value.filter((r) => r.unverified === 0).length)
const totalFields = computed(() => rows.value.reduce((s, r) => s + r.total, 0))

const confidenceCounts = computed(() => {
  const acc = { official: 0, derived: 0, unverified: 0 }
  for (const r of rows.value) {
    acc.official += r.official
    acc.derived += r.derived
    acc.unverified += r.unverified
  }
  return acc
})

const officialRatio = computed(() => {
  const total = confidenceCounts.value.official + confidenceCounts.value.derived + confidenceCounts.value.unverified
  return total ? Math.round((confidenceCounts.value.official / total) * 100) : 0
})

async function loadCities(): Promise<void> {
  // 索引放在 public/ 根下，不放 rules/ 里：rules/ 被多个测试当作「城市规则文件」
  // 整体扫描，塞一个 index.json 进去会让 34 城变成 35 个文件，门禁全红。
  const indexRes = await fetch(`${import.meta.env.BASE_URL}city-index.json`).catch(() => null)
  let ids: string[]
  if (indexRes?.ok) {
    ids = await indexRes.json()
  } else {
    // 没有索引文件时用已知的 34 城列表兜底
    ids = [
      'beijing','changchun','changsha','chengdu','chongqing','dalian','dongguan','fuzhou',
      'guangzhou','guiyang','haikou','hangzhou','harbin','hefei','hohhot','jinan','kunming',
      'lanzhou','lhasa','nanchang','nanjing','nanning','ningbo','qingdao','sanya','shanghai',
      'shenyang','shenzhen','shijiazhuang','suzhou','taiyuan','tianjin','urumqi','wuhan','xian','xining','yinchuan','zhengzhou',
    ]
  }

  const loaded: CityRuleLike[] = []
  for (const id of ids) {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}rules/${id}.json`)
      if (res.ok) loaded.push(await res.json())
    } catch {
      /* 单个城市失败不阻断整页 */
    }
  }
  cities.value = loaded
}

async function runCheck(): Promise<void> {
  running.value = true
  try {
    const { calculate } = await import('../kernel/calculate')
    const loader = async (city: string) => {
      const res = await fetch(`${import.meta.env.BASE_URL}rules/${city}.json`)
      if (!res.ok) throw new Error(`规则缺失：${city}`)
      return res.json()
    }

    let passed = 0
    const failures: string[] = []
    for (const c of cities.value) {
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
      total: cities.value.length,
      passed,
      failed: failures.length,
      failures,
    }
  } finally {
    running.value = false
  }
}

onMounted(async () => {
  await loadCities()
  await runCheck()
})
</script>

<style scoped>
.admin {
  padding: var(--space-6);
  max-width: 1200px;
  margin: 0 auto;
}

.admin-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.admin-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-1);
}

.admin-sub {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  max-width: 60ch;
  line-height: var(--line-height-relaxed);
}

.metric-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.metric {
  padding: var(--space-4);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.metric-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.metric-value {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  font-family: var(--font-family-num);
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}

.metric-value.ok { color: var(--color-success-600); }
.metric-value.warn { color: var(--color-warning-600); }

.panel {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  margin-bottom: var(--space-4);
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.panel-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-3);
}

.panel-head .panel-title { margin-bottom: 0; }

.panel-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  margin: 0 0 var(--space-2);
}

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
  color: #fff;
  transition: flex-grow var(--duration-slow) var(--ease-out);
  min-width: 2px;
}

.bar.official { background: var(--color-success-600); }
.bar.derived { background: var(--color-info-600); }
.bar.unverified { background: var(--color-warning-600); }

.legend {
  display: flex;
  gap: var(--space-5);
  margin-top: var(--space-3);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  flex-wrap: wrap;
}

.legend span { display: inline-flex; align-items: center; gap: var(--space-1); }

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.dot.official { background: var(--color-success-600); }
.dot.derived { background: var(--color-info-600); }
.dot.unverified { background: var(--color-warning-600); }

.table-wrap { overflow-x: auto; }

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

.num { text-align: right; font-variant-numeric: tabular-nums; }

.city-id {
  display: block;
  font-size: 10px;
  color: var(--color-text-tertiary);
  font-family: var(--font-family-mono);
}

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
  color: var(--color-danger-600);
}

@media (max-width: 900px) {
  .metric-row { grid-template-columns: repeat(2, 1fr); }
  .admin { padding: var(--space-4); }
}

@media (max-width: 640px) {
  .metric-row { grid-template-columns: 1fr; }
  .admin-head { flex-direction: column; }
}
</style>
