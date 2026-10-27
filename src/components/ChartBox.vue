<template>
  <div class="chart-wrap">
    <div v-if="loading" class="chart-skeleton">
      <!-- 固定宽度序列：Math.random() 每次渲染都变，会造成骨架条抖动 -->
      <div class="sk-bar" v-for="(w, i) in [80, 65, 90, 70, 85]" :key="i" :style="{ width: w + '%', animationDelay: i*0.1 + 's' }" />
    </div>
    <div
      v-show="!loading"
      ref="el"
      class="chart-box"
      :style="{ height: h + 'px' }"
      role="img"
      :aria-label="label || '数据图表'"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed, shallowRef } from 'vue'
import type { EChartsCoreOption, EChartsType } from 'echarts/core'
import { ensureECharts } from '../utils/echarts'

const props = defineProps<{
  option: EChartsCoreOption
  height?: number
  loading?: boolean
  /** 读屏与无图场景的替代描述（图表数据无法被读屏读出） */
  label?: string
}>()

const el = ref<HTMLElement>()
const h = computed(() => props.height || 320)
const chart = shallowRef<EChartsType | null>(null)
let ro: ResizeObserver | null = null
/** 竞态防护：await ensureECharts() 空档可能发生第二次 render 或组件卸载 */
let renderSeq = 0
let disposed = false

async function render() {
  if (disposed || !el.value || props.loading || el.value.clientWidth === 0) return
  const seq = ++renderSeq
  if (!chart.value) {
    const { init } = await ensureECharts()
    // await 期间组件可能已卸载（chart 被置空）或发起了更新的 render：
    // 继续执行会对脱离文档的容器 init 出永不 dispose 的孤儿实例
    if (disposed || seq !== renderSeq || !el.value) return
    chart.value = init(el.value, undefined, { renderer: 'canvas' })
  }
  if (seq !== renderSeq || !chart.value) return
  // 统一挂「保存为图片」：图表结论（收入波动、税负对比、养老金档位）常被截图转发，
  // 浏览器自带截图分辨率不可控，用 ECharts 自带导出更清晰。调用方显式配置 toolbox 时不覆盖。
  const opt = props.option as Record<string, unknown>
  const withToolbox = opt && !('toolbox' in opt)
    ? { ...opt, toolbox: { right: 8, top: 0, feature: { saveAsImage: { title: '保存图片', pixelRatio: 2, backgroundColor: 'transparent' } } } }
    : props.option
  chart.value.setOption(withToolbox as EChartsCoreOption, true)
}

// ResizeObserver 在折叠卡片展开（display:none → block）时也会触发：
// 此时容器首次拿到宽度而 chart 尚未创建，必须补一次 render，
// 否则折叠内的图表展开后永远是空白。
function resize() {
  if (!el.value || el.value.clientWidth === 0) return
  if (!chart.value) { nextTick(render); return }
  chart.value.resize()
}

onMounted(() => {
  nextTick(render)
  if (typeof ResizeObserver !== 'undefined' && el.value) {
    ro = new ResizeObserver(resize)
    ro.observe(el.value)
  }
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  disposed = true
  renderSeq++
  window.removeEventListener('resize', resize)
  ro?.disconnect()
  ro = null
  chart.value?.dispose()
  chart.value = null
})

watch(() => props.option, () => nextTick(render))
watch(() => props.loading, (loading) => { if (!loading) nextTick(render) })
</script>

<style scoped>
.chart-wrap { position: relative; width: 100%; }
.chart-box { width: 100%; }
.chart-skeleton { display: flex; flex-direction: column; gap: 14px; padding: 10px 0; height: 100%; }
.sk-bar { height: 12px; border-radius: 3px; background: linear-gradient(90deg, var(--color-bg-tertiary) 0%, var(--color-border-primary) 50%, var(--color-bg-tertiary) 100%); animation: shimmer 1.5s ease-in-out infinite; }
@keyframes shimmer { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
</style>