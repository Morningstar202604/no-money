<template>
  <n-modal
    v-if="visible"
    :show="visible"
    preset="card"
    class="onb-modal"
    title="先看这里：你该办哪几件事？"
    :style="{ width: 'min(620px, 94vw)', maxHeight: 'calc(100dvh - 32px)', display: 'flex', flexDirection: 'column' }"
    :closable="true"
    content-style="overflow-y: auto; min-height: 0; flex: 1 1 auto;"
    @update:show="(v: boolean) => !v && closeOnce()"
  >
    <div class="onb">
      <p class="onb-lead">
        这个平台先帮你搞清楚<strong>「该做什么、能拿什么、去哪办」</strong>。下面的收入数字只是工具，
        默认值<strong>不是你的真实数据</strong>；先办事，再算钱。
      </p>

      <ol class="onb-steps">
        <li>
          <b>选城市、身份、最近想解决的事</b>
          <span>3 步生成 3–7 条清单；不注册、不填身份证、不填工资。</span>
        </li>
        <li>
          <b>每条清单都有第一步、时限、官方入口</b>
          <span>社保、医保、公积金、补贴、工伤、欠薪——按清单点进官方入口自己办。</span>
        </li>
        <li>
          <b>想算收入，再改左侧参数</b>
          <span>默认 {{ d.hours }}h、{{ d.orders }}单、{{ d.days }}天只是示例；算出来的钱是<strong>假设</strong>，不是工资承诺。</span>
        </li>
      </ol>

      <n-alert type="info" :show-icon="true" style="margin-top: 4px">
        <div><b>平台不做什么</b></div>
        <div style="margin-top:4px">不代办、不代缴、不承诺结果；没有官方依据的金额一律不写，具体标准以当地最新文件为准。</div>
      </n-alert>

      <n-alert type="warning" :show-icon="true" style="margin-top: 8px">
        <div><b>招聘广告上的数字先别信</b></div>
        <div style="margin-top:4px">
          去「方案对比 → 收支明细 → 广告口径校验」输入对方给的月收入，它会按本城计价反算出需要日均多少单、多少小时才能达到。
        </div>
      </n-alert>

      <p class="onb-foot">
        想先看数字，点「开始调整参数」；想先办事，点「去生成办事清单」。
      </p>
    </div>

    <template #footer>
      <div class="onb-actions">
        <!-- 两个按钮行为必须区分：此前都写 seen=1，用户点「开始调整参数」
             也会被永久静默，想再看一次引导没有任何入口 -->
        <n-button text size="small" @click="dismissForever">不再提示</n-button>
        <div class="onb-cta">
          <n-button size="small" @click="closeOnce">开始调整参数</n-button>
          <n-button type="primary" size="small" @click="goStart">去生成办事清单</n-button>
        </div>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { NModal, NButton, NAlert } from 'naive-ui'
import { useRouter } from 'vue-router'
import { useMainStore } from '../stores/main'

const STORAGE_KEY = 'nomoney_onboarding_v1'
const store = useMainStore()
const router = useRouter()

function readSeen(): boolean {
  // 存储不可用（隐私模式）时按「没看过」处理：宁可多提示一次，
  // 也不要把首次用户直接扔进一个全是假设值的界面
  try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
}

const visible = ref(!readSeen())

const d = computed(() => ({
  hours: store.work.dailyHours,
  orders: store.work.dailyOrders,
  days: store.work.workDaysMonth,
}))

/** 「不再提示」：永久静默 */
function dismissForever() {
  visible.value = false
  try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* 隐私模式下不持久化，只影响下次是否再弹 */ }
}

/** 「开始调整参数」：只关本次，下次打开仍会提示 */
function closeOnce() {
  visible.value = false
}

/** 首次用户的主路径：直接进办事入口，不再先教填参数 */
function goStart() {
  visible.value = false
  void router.push('/start')
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
.onb-actions { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.onb-cta { display: flex; gap: 8px; flex-wrap: wrap; }
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

/* 引导弹窗打开时隐藏所有浮动按钮
   --------------------------------------------------------------------------
   移动端 401px 屏上，右下角的 AI 按钮与反馈按钮都会压住弹窗底部的
   「开始调整参数」主按钮——用户第一次打开应用就点不到主 CTA。
   这不是某一个按钮的问题，是"浮层 + 浮层"的通用冲突：
   引导是模态的，模态期间任何常驻浮层都应该让位。
   用 body:has() 判断弹窗是否存在，关闭后自动恢复。 */
body:has(.onb-modal) .chat-fab,
body:has(.onb-modal) .feedback {
  display: none !important;
}
</style>
