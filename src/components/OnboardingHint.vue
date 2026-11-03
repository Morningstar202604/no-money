<template>
  <n-modal
    v-if="visible"
    :show="visible"
    preset="card"
    class="onb-modal"
    title="先看这里：这些数字是谁的？"
    :style="{ width: 'min(620px, 94vw)', maxHeight: 'calc(100dvh - 32px)', display: 'flex', flexDirection: 'column' }"
    :closable="true"
    content-style="overflow-y: auto; min-height: 0; flex: 1 1 auto;"
    @update:show="(v: boolean) => !v && closeOnce()"
  >
    <div class="onb">
      <p class="onb-lead">
        页面上的收入、成本、社保数字，全部来自左侧参数栏的假设值——<strong>不是你的真实数据</strong>。
        先花两分钟把下面三项换成你自己的情况，结论才有意义。
      </p>

      <ol class="onb-steps">
        <li>
          <b>日均工时 / 日均接单 / 月工作天</b>
          <span>默认 {{ d.hours }}h、{{ d.orders }}单、{{ d.days }}天是常见全职强度。<strong>刚入行填低一些</strong>（新手期单量与效率都更低）。</span>
        </li>
        <li>
          <b>车辆与成本</b>
          <span>默认月支出约 ¥{{ d.cost }}（电动车的充电、维护、保险、折旧等）。租车的话把租金加进「维护费」。</span>
        </li>
        <li>
          <b>税务与社保</b>
          <span>默认<strong>未参保</strong>。参保会让净收入下降约 ¥{{ d.insurance }}，但医保断缴时住院费用要全额自付。</span>
        </li>
      </ol>

      <n-alert type="info" :show-icon="true" style="margin-top: 4px">
        <div><b>三步快速上手</b></div>
        <div style="margin-top:4px">① 左侧把参数改成你的情况 → ② 看「总览」的净收入与<strong>有效时薪</strong>（和当地最低工资对比）→ ③ 去「方案对比 → 收支明细」看钱的去向。</div>
      </n-alert>

      <n-alert type="warning" :show-icon="true" style="margin-top: 8px">
        <div><b>招聘广告上的数字先别信</b></div>
        <div style="margin-top:4px">
          去「方案对比 → 收支明细 → 广告口径校验」输入对方给的月收入，它会按本城计价反算出需要日均多少单、多少小时才能达到。
        </div>
      </n-alert>

      <p class="onb-foot">
        想先了解行业里的真实规则（押金、租车、合同、扣款），见「政策百科 → 民生手册 → 新人入门」。
      </p>
    </div>

    <template #footer>
      <div class="onb-actions">
        <!-- 两个按钮行为必须区分：此前都写 seen=1，用户点「开始调整参数」
             也会被永久静默，想再看一次引导没有任何入口 -->
        <n-button text size="small" @click="dismissForever">不再提示</n-button>
        <n-button type="primary" size="small" @click="closeOnce">开始调整参数</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { NModal, NButton, NAlert } from 'naive-ui'
import { useMainStore } from '../stores/main'

const STORAGE_KEY = 'nomoney_onboarding_v1'
const store = useMainStore()

function readSeen(): boolean {
  // 存储不可用（隐私模式）时按「没看过」处理：宁可多提示一次，
  // 也不要把首次用户直接扔进一个全是假设值的界面
  try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
}

const visible = ref(!readSeen())

const d = computed(() => {
  const c = store.costs
  const cost = c.electricityCostMonth + c.maintenanceMonth + c.insuranceMonth
    + c.phoneCostMonth + c.foodCostMonth + c.trafficFineMonth
    + c.vehicleDepreciationMonth + c.otherCostMonth + c.fuelCostMonth
  // 参保成本的正确口径：未参保时 totalMonthly 为 0，不能直接取它——
  // 否则会显示「参保让净收入下降约 ¥0」，把"每月要掏一两千"说成不花钱。
  const s0 = store.scenarios[0]
  const insurance = Math.round(s0?.benefit.totalMonthly || ((s0?.benefit.pensionMonthly ?? 0) + (s0?.benefit.medicalMonthly ?? 0)))
  return {
    hours: store.work.dailyHours,
    orders: store.work.dailyOrders,
    days: store.work.workDaysMonth,
    cost,
    insurance,
  }
})

/** 「不再提示」：永久静默 */
function dismissForever() {
  visible.value = false
  try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* 隐私模式下不持久化，只影响下次是否再弹 */ }
}

/** 「开始调整参数」：只关本次，下次打开仍会提示 */
function closeOnce() {
  visible.value = false
}

/** 供父组件调用：命令面板等全局浮层打开时，先收起引导，
    否则 naive-ui 的 modal 焦点陷阱会持续抢回焦点，用户按 Ctrl+K 后打不了字。 */
defineExpose({ dismiss: closeOnce })

// 监听全局事件：MainLayout 在打开命令面板前广播，引导自行收起
function onCloseRequest() {
  if (visible.value) visible.value = false
}
onMounted(() => window.addEventListener('app:close-onboarding', onCloseRequest))
onBeforeUnmount(() => window.removeEventListener('app:close-onboarding', onCloseRequest))

</script>

<style scoped>

.onb { display: flex; flex-direction: column; gap: 10px; overflow-y: auto; min-height: 0; }
.onb-lead { font-size: 13px; line-height: 1.7; color: var(--color-text-secondary); margin: 0; }
.onb-lead strong { color: var(--color-text-primary); }

.onb-steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; }
.onb-steps li { font-size: 12px; line-height: 1.7; color: var(--color-text-secondary); }
.onb-steps b { color: var(--color-text-primary); margin-right: 4px; }
.onb-steps span { display: block; }
.onb-steps span strong { color: var(--color-text-brand); }

.onb-foot { font-size: 12px; color: var(--color-text-tertiary); margin: 0; }
.onb-actions { display: flex; justify-content: space-between; align-items: center; }
</style>

<!-- 非 scoped：n-modal 被 Teleport 到 body，scoped 样式的作用域属性加不到那些节点上，
     只有全局样式能命中。把引导弹窗压到 header（z-index 200）之下，
     这样首次进入时头部仍然可点，用户不会被强制读完引导才能操作。 -->
<style>
/* 引导弹窗的层级与遮罩
   --------------------------------------------------------------------------
   naive-ui 的 n-modal-container 固定用 z-index: 2000，遮罩覆盖整个视口，
   连 header 上的主题切换、搜索、导航都拦住——用户必须先读完引导才能做任何事。

   但直接把整个 modal 压到 header(200) 之下会连带把遮罩也压下去，
   结果遮罩仍覆盖按钮、按钮却点不到（Playwright 实测：mask intercepts pointer events）。

   正确做法：
   1. 弹窗容器压到 header 之下（150），header 保持可交互
   2. 遮罩改为不接收指针事件（pointer-events: none）——
      它只是视觉上的「背景压暗」，不该拦任何点击。
      弹窗本身在容器内，仍然可点。 */
.n-modal-container:has(.onb-modal) {
  z-index: 150 !important;
}
.n-modal-container:has(.onb-modal) ~ .n-modal-mask,
.n-modal-mask {
  z-index: 149 !important;
  pointer-events: none !important;
}

/* 引导弹窗打开时隐藏 AI 悬浮按钮：移动端它固定在右下角，
   正好压住弹窗的「开始调整参数」主按钮，用户点不到。
   用 body:has() 判断弹窗是否存在，弹窗关闭后自动恢复。 */
body:has(.onb-modal) .chat-fab {
  display: none !important;
}
</style>
