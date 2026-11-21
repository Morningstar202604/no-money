<template>
  <button
    class="chat-fab"
    :class="{ active: open }"
    @click="open = !open"
    aria-label="AI 助手"
    :aria-expanded="open"
  >
    <svg v-if="!open" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  </button>

  <!-- AI 面板首次打开才下载：naive-ui 的输入框、弹窗、折叠面板都不进首屏 -->
  <NaiveShell v-if="open">
    <ChatAssistant embedded :scenarios="scenarios" :initial-prompt="pendingPrompt" @close="open = false" />
  </NaiveShell>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import type { ScenarioResult } from '../types'

const ChatAssistant = defineAsyncComponent(() => import('./ChatAssistant.vue'))
const NaiveShell = defineAsyncComponent(() => import('../app/NaiveShell.vue'))

defineProps<{ scenarios: ScenarioResult[] }>()
const open = ref(false)
// 0.1.0 起 ChatAssistant 只在点击后才挂载；「问 AI」事件必须先由这里接住，
// 否则事件发出时面板还不存在，预填的城市/清单问题会丢。
const pendingPrompt = ref('')

function openFromEvent(event: Event) {
  if (open.value) return // 已挂载时由 ChatAssistant 自己处理，避免重复预填
  const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt?.trim() ?? ''
  pendingPrompt.value = prompt
  open.value = true
}
watch(open, (value) => { if (!value) pendingPrompt.value = '' })
onMounted(() => window.addEventListener('app:open-ai', openFromEvent))
onUnmounted(() => window.removeEventListener('app:open-ai', openFromEvent))
</script>

<style scoped>
/* 与 ChatAssistant 内的悬浮按钮保持同一尺寸/位置；首屏视觉基线不变，但不再加载整套 naive-ui */
.chat-fab {
  position: fixed; bottom: 24px; right: 24px;
  width: 48px; height: 48px; border-radius: 12px;
  background: var(--color-primary-500); color: var(--color-text-inverse);
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(13,148,136,0.25);
  z-index: var(--z-sticky);
  transition: background 0.15s, transform 0.15s;
}
.chat-fab:hover { background: var(--color-bg-brand-hover); }
.chat-fab:active { transform: scale(0.96); }
.chat-fab.active { background: var(--color-text-secondary); }
</style>
