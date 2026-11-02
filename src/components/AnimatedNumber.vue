<template>
  <span class="animated-number" :class="{ counting: isCounting }">
    <span class="an-prefix" v-if="prefix">{{ prefix }}</span>
    <span class="an-value">{{ displayText }}</span>
    <span class="an-suffix" v-if="suffix">{{ suffix }}</span>
  </span>
</template>

<script setup lang="ts">
/**
 * 数字滚动动画
 *
 * 为什么值得做：
 * 侧边栏拖滑块时净收入会变，但数字是瞬间跳变的——用户看不出"刚才那一下变了多少"。
 * 数字滚动把变化过程显式化，用户能感知到因果：我拖了 → 数字动了。
 *
 * 实现要点：
 * - 用 requestAnimationFrame 而非 setInterval，跟随屏幕刷新率，不掉帧
 * - 尊重 prefers-reduced-motion：前庭功能敏感的用户不该被强制看动画
 * - 组件卸载时取消动画帧，避免内存泄漏与"动画还在跑但组件没了"
 * - 格式化交给外部传入的 formatter，金额/百分比/整数都能复用
 */
import { ref, watch, computed, onBeforeUnmount } from 'vue'

const props = withDefaults(
  defineProps<{
    value: number
    /** 动画时长（毫秒） */
    duration?: number
    /** 格式化函数，默认保留一位小数并加千分位（与页面其它金额口径一致） */
    formatter?: (n: number) => string
    prefix?: string
    suffix?: string
  }>(),
  {
    duration: 600,
    // 保留一位小数：页面正文按 ¥8,969.7 显示，KPI 若四舍五入成 ¥8,970
    // 就会出现同一笔钱两个数，用户会怀疑哪个是真的
    formatter: (n: number) =>
      n.toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    prefix: '',
    suffix: '',
  },
)

const current = ref(props.value)
const isCounting = ref(false)
let frame: number | null = null

const displayText = computed(() => props.formatter(current.value))

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 缓出曲线：开头快、结尾慢，符合"数字逐渐落定"的直觉 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function animateTo(target: number) {
  if (frame !== null) cancelAnimationFrame(frame)

  // 首次渲染或用户要求减少动效：直接落到终值，不做动画
  if (prefersReducedMotion() || props.duration <= 0) {
    current.value = target
    return
  }

  const from = current.value
  const delta = target - from
  // 变化极小（<0.5）时不值得动画，避免低幅度抖动看起来像故障
  if (Math.abs(delta) < 0.5) {
    current.value = target
    return
  }

  const start = performance.now()
  isCounting.value = true

  const step = (now: number) => {
    const elapsed = now - start
    const progress = Math.min(1, elapsed / props.duration)
    current.value = from + delta * easeOutCubic(progress)

    if (progress < 1) {
      frame = requestAnimationFrame(step)
    } else {
      current.value = target
      isCounting.value = false
      frame = null
    }
  }

  frame = requestAnimationFrame(step)
}

watch(
  () => props.value,
  (next) => animateTo(next),
)

onBeforeUnmount(() => {
  if (frame !== null) cancelAnimationFrame(frame)
})
</script>

<style scoped>
.animated-number {
  display: inline-flex;
  align-items: baseline;
  gap: 1px;
  /* 等宽数字：滚动过程中字符宽度不变，否则整行会左右抖动 */
  font-variant-numeric: tabular-nums;
}

.an-value {
  transition: color var(--duration-fast) var(--ease-out);
}

/* 滚动中轻微提亮，把注意力引到变化上；结束后自然回落 */
.counting .an-value {
  color: var(--color-text-brand);
}

@media (prefers-reduced-motion: reduce) {
  .an-value {
    transition: none;
  }
}
</style>
