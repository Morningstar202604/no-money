<template>
  <div class="cmp">
    <div v-if="err" class="cmp-err">
      地图加载失败：{{ err }}
      <div class="cmp-err-tip">可直接点选下方城市名切换。</div>
    </div>
    <div v-show="!err" ref="el" class="cmp-map" :style="{ height: mapHeight + 'px' }" />

    <p class="cmp-note">
      <span class="cmp-legend"><i class="dot covered" />已收录（{{ defs.length }} 城，点击圆点即切换）</span>
      <span class="cmp-legend"><i class="dot todo" />暂未收录</span>
    </p>

    <div class="cmp-cities">
      <span
        v-for="c in defs"
        :key="c.value"
        class="cmp-city"
        :class="{ active: c.value === current }"
        @click="pick(c.value)"
      >{{ c.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import type { EChartsCoreOption } from 'echarts/core'
import { useMainStore } from '../stores/main'
import { CITY_REGISTRY, provinceCoverage, type CityDef } from '../data/cities'
import { ensureECharts } from '../utils/echarts'
import { assetUrl } from '../utils/asset'
import { chartColors } from '../utils/chart'
import type { EChartsType } from 'echarts/core'

// 不赋值给变量：props 在 <script setup> 模板里可直接用，赋值反而触发 noUnusedLocals
withDefaults(defineProps<{ current?: string; mapHeight?: number }>(), {
  current: '',
  mapHeight: 430,
})
const emit = defineEmits<{ select: [city: string] }>()

const store = useMainStore()
const defs: CityDef[] = CITY_REGISTRY
const el = ref<HTMLElement>()
const err = ref('')
let chart: EChartsType | null = null
let ro: ResizeObserver | null = null

/** 全国 GeoJSON 只取一次；失败时降级为下方城市按钮 */
let mapJsonPromise: Promise<unknown> | null = null
function loadChinaMap(): Promise<unknown> {
  if (!mapJsonPromise) {
    mapJsonPromise = fetch(assetUrl('maps/china.json'))
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .catch(e => { mapJsonPromise = null; throw e })
  }
  return mapJsonPromise
}

function buildOption(): EChartsCoreOption {
  const P = chartColors()
  const coverage = provinceCoverage(defs)
  const provinceNames = [...coverage.keys()]
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: { seriesType?: string; name?: string }) =>
        p.seriesType === 'scatter' ? `${p.name}（点击切换）` : `${p.name ?? ''}`,
    },
    geo: {
      map: 'china',
      roam: false,
      zoom: 1.02,
      top: 10,
      bottom: 10,
      itemStyle: { areaColor: P.splitLine, borderColor: P.axisLine },
      emphasis: { itemStyle: { areaColor: P.areaSoft } },
    },
    series: [
      {
        type: 'map',
        map: 'china',
        geoIndex: 0,
        data: provinceNames.map(name => ({
          name,
          itemStyle: { areaColor: P.areaSoft, borderColor: P.primary },
        })),
      },
      {
        type: 'scatter',
        coordinateSystem: 'geo',
        symbolSize: 9,
        itemStyle: { color: P.primary, borderColor: P.legendText, borderWidth: 1 },
        label: {
          show: true,
          position: 'right',
          formatter: '{b}',
          fontSize: 11,
          color: P.axisLabel,
        },
        data: defs.map(d => ({ name: d.label, value: [d.lng, d.lat], cityId: d.value })),
        emphasis: { scale: 1.4 },
      },
    ],
  }
}

async function render() {
  if (!el.value || err.value || el.value.clientWidth === 0) return
  const { init, registerMap } = await ensureECharts()
  const geo = await loadChinaMap()
  registerMap('china', geo as Parameters<typeof registerMap>[1])
  if (!chart) {
    chart = init(el.value, undefined, { renderer: 'canvas' })
    chart.on('click', (params) => {
      if (params.seriesType !== 'scatter') return
      const raw = params.data as { cityId?: string } | undefined
      if (raw?.cityId) pick(raw.cityId)
    })
  }
  chart.setOption(buildOption(), true)
}

function pick(city: string) {
  emit('select', city)
}

function onResize() {
  if (!el.value || el.value.clientWidth === 0) return
  chart?.resize()
}

onMounted(async () => {
  try {
    await render()
    if (typeof ResizeObserver !== 'undefined' && el.value) {
      ro = new ResizeObserver(onResize)
      ro.observe(el.value)
    }
    window.addEventListener('resize', onResize)
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e)
  }
})

// 主题切换重绘：scatter/省色都取自 token，需要重算 option
watch(() => store.isDark, () => { void render() })

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  ro?.disconnect()
  ro = null
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.cmp { display: flex; flex-direction: column; gap: 8px; }
.cmp-map { width: 100%; }

.cmp-note {
  display: flex;
  gap: 16px;
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin: 0;
}
.cmp-legend { display: inline-flex; align-items: center; gap: 5px; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot.covered { background: var(--color-primary-500); }
.dot.todo { background: var(--color-border-secondary); }

.cmp-cities { display: flex; flex-wrap: wrap; gap: 6px; }
.cmp-city {
  font-size: 12px;
  padding: 3px 10px;
  border: 1px solid var(--color-border-primary);
  border-radius: 9999px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.cmp-city:hover { border-color: var(--color-text-brand); color: var(--color-text-primary); }
.cmp-city.active {
  background: var(--color-bg-brand);
  border-color: var(--color-bg-brand);
  color: var(--color-text-inverse);
  font-weight: 600;
}

.cmp-err {
  font-size: 12px;
  color: var(--color-text-danger);
  background: var(--color-danger-50);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}
.cmp-err-tip { color: var(--color-text-secondary); margin-top: 4px; }
</style>
