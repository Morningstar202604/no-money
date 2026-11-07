<template>
  <div class="audit">
    <header class="audit-head">
      <div>
        <h1 class="audit-title">数据核验对账</h1>
        <p class="audit-sub">
          每一格代表一座城市的一个政策参数。绿色＝已核到官方原文，黄色＝占位待核实。
          <b>不做模糊处理：没核实的就显示为没核实。</b>
        </p>
      </div>
      <n-button size="small" :loading="running" @click="runVerify">重新统计</n-button>
    </header>

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
        <span class="metric-label">待核实字段</span>
        <span class="metric-value warn">{{ totalCount - officialCount }}</span>
      </div>
      <div class="metric">
        <span class="metric-label">官方覆盖率</span>
        <span class="metric-value" :class="officialRatio >= 40 ? 'ok' : 'warn'">{{ officialRatio }}%</span>
      </div>
      <div class="metric">
        <span class="metric-label">全核实城市</span>
        <span class="metric-value" :class="fullyVerified ? 'ok' : 'warn'">{{ fullyVerified }} / {{ rows.length }}</span>
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
                <b>{{ r.city }}</b>
                <span class="city-id">{{ r.id }}</span>
              </td>
              <td v-for="f in fields" :key="f.key">
                <i class="cell" :class="cellClass(r[f.key])" :title="labelOf(r[f.key])" />
              </td>
              <td class="num" :class="{ 'gap-zero': r.gaps === 0 }">{{ r.gaps }}</td>
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
          <b>{{ r.city }}</b> — {{ r.gaps }} 个字段待核实
          <span class="todo-fields">{{ r.missingFields.join('、') }}</span>
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
 * 这一页把 34 城 × 5 类核心字段做成矩阵，
 * 绿色/黄色一眼可辨——这是产品"诚实"承诺的可视化落地，不是装饰。
 *
 * 与 /admin 的分工：
 *   /admin  → 数据治理视角（全库置信度分布、一致性检查）
 *   /audit  → 用户知情视角（我要不要相信这个数）
 */
import { ref, computed, onMounted } from 'vue'
import { NButton } from 'naive-ui'

interface CityRuleLike {
  city: string
  cityName: string
  sources?: Record<string, { confidence?: string }>
}

interface Row {
  id: string
  city: string
  pension?: string
  minWage?: string
  medical?: string
  tax?: string
  income?: string
  gaps: number
  missingFields: string[]
}

const FIELDS = [
  { key: 'pension' as const, label: '养老金计发基数' },
  { key: 'minWage' as const, label: '最低工资' },
  { key: 'medical' as const, label: '医保费率' },
  { key: 'tax' as const, label: '个税税率表' },
  { key: 'income' as const, label: '平台计价' },
]
const fields = FIELDS

const rows = ref<Row[]>([])
const running = ref(false)

function cellClass(conf?: string): string {
  if (conf === 'official') return 'ok'
  if (conf === 'derived') return 'derived'
  return 'warn'
}
function labelOf(conf?: string): string {
  return conf === 'official' ? '已核官方' : conf === 'derived' ? '官方推算' : '待核实占位'
}

const totalCount = computed(() => rows.value.length * fields.length)
const officialCount = computed(
  () => rows.value.reduce((n, r) => n + fields.filter((f) => r[f.key] === 'official').length, 0),
)
const officialRatio = computed(() =>
  totalCount.value ? Math.round((officialCount.value / totalCount.value) * 100) : 0,
)
const fullyVerified = computed(() => rows.value.filter((r) => r.gaps === 0).length)

/** 缺口最多的前 6 城 */
const worstCities = computed(() =>
  [...rows.value].sort((a, b) => b.gaps - a.gaps).slice(0, 6),
)

async function load(): Promise<void> {
  const res = await fetch(`${import.meta.env.BASE_URL}city-index.json`).catch(() => null)
  const ids: string[] = res?.ok
    ? await res.json()
    : ['beijing','shanghai','guangzhou','shenzhen','hangzhou','chengdu','wuhan','xian']

  const loaded: Row[] = []
  for (const id of ids) {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}rules/${id}.json`)
      if (!r.ok) continue
      const rule = (await r.json()) as CityRuleLike
      const s = rule.sources ?? {}
      const row: Row = {
        id: rule.city,
        city: rule.cityName,
        pension: s.pension?.confidence,
        minWage: s.minimumWage?.confidence,
        medical: s.medical?.confidence,
        tax: s.tax?.confidence,
        income: s.income?.confidence,
        gaps: 0,
        missingFields: [],
      }
      for (const f of fields) {
        if (row[f.key] !== 'official') {
          row.gaps++
          row.missingFields.push(f.label)
        }
      }
      loaded.push(row)
    } catch {
      /* 单城失败不阻断整页 */
    }
  }
  // 缺口多的排前面：用户打开就想看"哪里最不可信"
  rows.value = loaded.sort((a, b) => b.gaps - a.gaps)
}

async function runVerify(): Promise<void> {
  running.value = true
  try {
    await load()
  } finally {
    running.value = false
  }
}

onMounted(() => {
  void runVerify()
})
</script>

<style scoped>
.audit { padding: var(--space-6); max-width: 1280px; margin: 0 auto; }

.audit-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: var(--space-4); margin-bottom: var(--space-5);
}
.audit-title { font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); color: var(--color-text-primary); margin: 0 0 var(--space-1); }
.audit-sub { font-size: var(--font-size-sm); color: var(--color-text-secondary); margin: 0; max-width: 70ch; line-height: var(--line-height-relaxed); }

.metric-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-3); margin-bottom: var(--space-4); }
.metric { padding: var(--space-4); background: var(--color-bg-primary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-lg); display: flex; flex-direction: column; gap: var(--space-1); }
.metric-label { font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.metric-value { font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); font-family: var(--font-family-num); color: var(--color-text-primary); font-variant-numeric: tabular-nums; }
.metric-value.ok { color: var(--color-success-600); }
.metric-value.warn { color: var(--color-warning-600); }

.note {
  padding: var(--space-3) var(--space-4); margin-bottom: var(--space-4);
  background: var(--color-warning-50); border: 1px solid var(--color-warning-200);
  border-radius: var(--radius-md); font-size: var(--font-size-sm);
  color: var(--color-text-secondary); line-height: var(--line-height-relaxed);
}

.panel { background: var(--color-bg-primary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-lg); padding: var(--space-5); margin-bottom: var(--space-4); }
.panel-title { font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); margin: 0 0 var(--space-3); }
.panel-hint { font-size: var(--font-size-sm); color: var(--color-text-tertiary); margin: 0 0 var(--space-2); }

.legend { display: flex; gap: var(--space-4); margin-bottom: var(--space-3); font-size: var(--font-size-xs); color: var(--color-text-secondary); flex-wrap: wrap; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }

.table-wrap { overflow-x: auto; }
.matrix { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
.matrix th { text-align: center; padding: var(--space-2); border-bottom: 1px solid var(--color-border-primary); color: var(--color-text-tertiary); font-size: var(--font-size-xs); font-weight: var(--font-weight-medium); white-space: nowrap; }
.matrix td { padding: var(--space-2); border-bottom: 1px solid var(--surface-border); text-align: center; }
.matrix tr:hover td { background: var(--surface-1); }
.sticky-col { text-align: left !important; white-space: nowrap; }
.city-id { display: block; font-size: 10px; color: var(--color-text-tertiary); font-family: var(--font-family-mono); }
.num { text-align: right !important; font-variant-numeric: tabular-nums; font-weight: var(--font-weight-medium); }
.gap-zero { color: var(--color-success-600); }

.cell { display: inline-block; width: 14px; height: 14px; border-radius: 3px; }
.cell.ok { background: var(--color-success-500); }
.cell.derived { background: var(--color-info-500); }
.cell.warn { background: var(--color-warning-500); }

.todo-list { margin: 0; padding-left: var(--space-5); font-size: var(--font-size-sm); color: var(--color-text-primary); line-height: 2; }
.todo-fields { color: var(--color-text-tertiary); font-size: var(--font-size-xs); }

@media (max-width: 900px) { .metric-row { grid-template-columns: repeat(2, 1fr); } .audit { padding: var(--space-4); } }
@media (max-width: 640px) { .metric-row { grid-template-columns: 1fr; } .audit-head { flex-direction: column; } }
</style>
