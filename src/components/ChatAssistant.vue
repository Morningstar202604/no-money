<template>
  <div>
    <!-- Floating trigger -->
    <button class="chat-fab" @click="open = !open" :class="{ active: open }" aria-label="AI 助手" :aria-expanded="open">
      <svg v-if="!open" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>

    <!-- Chat panel -->
    <transition name="panel">
      <div v-if="open" class="chat-panel">
        <div class="chat-head">
          <span class="ch-title">AI 助手</span>
          <n-tag v-if="isOnline && config.enabled && config.apiKey" size="small" type="success" :bordered="false">在线</n-tag>
          <n-tag v-else-if="config.enabled && !config.apiKey" size="small" type="warning" :bordered="false">已启用 · 未填 Key</n-tag>
          <n-tag v-else size="small" :bordered="false">离线模式</n-tag>
        </div>

        <n-divider style="margin:6px 0" />

        <div class="chat-body" ref="bodyRef" aria-live="polite" aria-label="对话消息">
          <div v-if="!messages.length" class="chat-empty">
            询问关于收入、税务、社保的任何问题
          </div>
          <div v-for="msg in messages" :key="msg.id" class="msg" :class="msg.role">
            <div class="msg-bubble">
              <div class="msg-text">{{ msg.content }}<span v-if="msg.isStreaming" class="cursor">|</span></div>
              <div v-if="msg.source === 'kb' && !msg.isStreaming" class="msg-src">本地知识库 · 离线检索</div>
            </div>
          </div>
        </div>

        <div class="quick-row">
          <n-tag v-for="q in quickQuestions" :key="q" size="small" class="qq" role="button" tabindex="0" @click="ask(q)" @keydown.enter.prevent="ask(q)" @keydown.space.prevent="ask(q)">{{ q }}</n-tag>
        </div>

        <div class="chat-input">
          <n-input v-model:value="input" type="textarea" :autosize="{ minRows: 1, maxRows: 3 }" placeholder="输入问题，Shift+Enter 换行…" :disabled="isStreaming" @keydown.enter="onEnter" />
          <n-button v-if="isStreaming" size="small" @click="stopStreaming">停止</n-button>
          <n-button v-else type="primary" size="small" @click="sendChat">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </n-button>
        </div>

        <div class="chat-foot">
          <n-button text size="tiny" @click="showSettings = true">API 设置</n-button>
          <n-button text size="tiny" @click="clearHistory">清除对话</n-button>
        </div>
      </div>
    </transition>

    <!-- Settings modal -->
    <n-modal v-model:show="showSettings" preset="dialog" title="AI 连接设置" :style="{ width: '460px' }">
      <n-space vertical :size="12" style="padding-top:10px">
        <n-alert type="warning" :show-icon="true">
          <div>启用 AI 后，以下数据会发送到你填写的第三方模型接口：</div>
          <ul class="exfil-list">
            <li>城市、日工时、日单量、月工作天</li>
            <li>月收入、月成本、月个税、净收入、时薪、权益评分</li>
            <li>最近 6 条对话内容</li>
          </ul>
          <div>本应用自身没有后端，不另存这些数据；关闭 AI 即完全离线。</div>
        </n-alert>

        <n-form-item label="启用 AI"><n-switch v-model:value="config.enabled" /></n-form-item>
        <n-form-item label="Endpoint">
          <n-input v-model:value="config.endpoint" placeholder="https://api.deepseek.com/v1/chat/completions" />
        </n-form-item>
        <div v-if="endpointHost" class="host-line">API Key 将发送至：<b>{{ endpointHost }}</b></div>
        <n-alert v-if="endpointError" type="error" :show-icon="true">{{ endpointError }}</n-alert>

        <n-form-item label="API Key">
          <n-input v-model:value="config.apiKey" type="password" placeholder="sk-…" show-password-on="click" />
        </n-form-item>
        <n-form-item>
          <n-checkbox v-model:checked="rememberKey">在本机记住 API Key</n-checkbox>
          <div class="ps-note-sm">默认不记住：Key 只存在于内存，关闭标签页即失效。勾选后会以明文写入本浏览器 localStorage，同源脚本与浏览器扩展均可读取。</div>
        </n-form-item>

        <n-form-item label="模型"><n-select v-model:value="config.model" :options="modelOptions" /></n-form-item>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <n-button @click="testConnection" :loading="testing">测试连接</n-button>
          <n-button type="primary" @click="saveAndClose">保存</n-button>
        </div>
      </n-space>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue'
import { NButton, NInput, NTag, NDivider, NModal, NSpace, NFormItem, NSelect, NSwitch, NAlert, NCheckbox, useMessage } from 'naive-ui'
import { useAIChat } from '../composables/useAIChat'
import { useMainStore } from '../stores/main'
import { validateEndpoint, deriveModelsUrl } from '../utils/endpoint'
import type { ScenarioResult } from '../types'

const props = defineProps<{ scenarios: ScenarioResult[] }>()
const message = useMessage()
const store = useMainStore()

const { config, messages, isStreaming, isOnline, showSettings, sendMessage, stopStreaming, clearHistory, updateConfig } = useAIChat()

const open = ref(false)
const input = ref('')
const bodyRef = ref<HTMLElement>()
const testing = ref(false)

/** 实时显示 Key 将发往哪个主机；非 https 或非法地址直接标红 */
const endpointCheck = computed(() => validateEndpoint(config.value.endpoint))
const endpointHost = computed(() => endpointCheck.value.ok ? endpointCheck.value.host : '')
const endpointError = computed(() => endpointCheck.value.ok ? '' : endpointCheck.value.error)
const rememberKey = computed({
  get: () => config.value.rememberKey,
  set: (v: boolean) => { config.value.rememberKey = v },
})

const modelOptions = [
  { label: 'DeepSeek Chat', value: 'deepseek-chat' },
  { label: 'DeepSeek Coder', value: 'deepseek-coder' },
  { label: 'Qwen Turbo', value: 'qwen-turbo' },
  { label: 'Qwen Plus', value: 'qwen-plus' },
  { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
  { label: 'GLM-4', value: 'glm-4' },
]

const quickQuestions = [
  '怎么合法省税？',
  '社保怎么缴划算？',
  '当前风险高吗？',
  '3个优化建议',
]

function ask(q: string) { input.value = q; sendChat() }

function onEnter(e: KeyboardEvent) {
  // Shift+Enter 换行；n-input 的 textarea 上 @keydown.enter 默认不拦截，只处理无修饰键回车
  if (e.shiftKey || isStreaming.value) return
  e.preventDefault()
  sendChat()
}

async function sendChat() {
  const q = input.value.trim()
  if (!q || isStreaming.value) return
  input.value = ''
  await sendMessage(q, props.scenarios, store.rule?.minimumWage.monthly, store.rule)
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => { bodyRef.value?.scrollTo({ top: bodyRef.value.scrollHeight, behavior: 'smooth' }) })
}

watch(messages, scrollToBottom, { deep: true })

async function testConnection() {
  if (!config.value.apiKey) { message.warning('请先填入 API Key'); return }
  // 原来的两次 replace 链不可靠：第二次永远匹配不到，且 Azure 的 deployments 形态会被改坏
  const derived = deriveModelsUrl(config.value.endpoint)
  if (!derived.ok) { message.error(derived.error ?? '无法推导测试地址'); return }
  testing.value = true
  try {
    const resp = await fetch(derived.url!, { headers: { Authorization: `Bearer ${config.value.apiKey}` } })
    if (!resp.ok) { message.error(`连接失败：HTTP ${resp.status}`); return }
    // 200 不代表 Key 有效：部分 OpenAI 兼容网关对无效 Key 也回 200 + {error:…}，
    // 必须解析响应体确认真的列出了模型才报告成功
    let body: unknown = null
    try { body = await resp.json() } catch { /* 非 JSON 体按结构异常处理 */ }
    const errObj = body as { error?: { message?: string } } | null
    if (errObj?.error) { message.error(`网关返回错误：${errObj.error.message ?? '未知错误'}`); return }
    const list = body as { data?: unknown[]; object?: string } | null
    if (Array.isArray(list?.data)) {
      message.success(`连接成功（可用模型 ${list!.data!.length} 个）`)
    } else {
      message.error('响应结构异常（未返回模型列表），请核对 Endpoint 是否为 OpenAI 兼容接口')
    }
  } catch (e: unknown) {
    message.error(`连接失败：${e instanceof Error ? e.message : '未知错误'}`)
  } finally { testing.value = false }
}

function saveAndClose() {
  if (!endpointCheck.value.ok) { message.error(endpointError.value ?? 'Endpoint 不合法'); return }
  const ok = updateConfig({
    endpoint: config.value.endpoint, apiKey: config.value.apiKey,
    model: config.value.model, enabled: config.value.enabled, rememberKey: config.value.rememberKey,
  })
  // 隐私模式/配额耗尽时写盘会失败：不能假报「已保存」，刷新后配置全丢
  if (ok) message.success('已保存')
  else message.warning('当前浏览器禁止本地存储（可能处于隐私模式），配置仅本次会话有效')
  showSettings.value = false
}
</script>

<style scoped>
.chat-fab {
  position: fixed; bottom: 24px; right: 24px;
  width: 48px; height: 48px; border-radius: 12px;
  background: var(--color-primary-500); color: var(--color-text-inverse);
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(13,148,136,0.25);
  z-index: 9999;
  transition: background 0.15s, transform 0.15s;
}
.chat-fab:hover { background: var(--color-bg-brand-hover); }
.chat-fab:active { transform: scale(0.96); }
.chat-fab.active { background: var(--color-text-secondary); }

.chat-panel {
  position: fixed; bottom: 80px; right: 24px;
  width: 360px; max-height: 560px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary); border-radius: 8px;
  display: flex; flex-direction: column; z-index: 9999;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
}

.chat-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px 0;
}
.ch-title { font-weight: 600; color: var(--color-text-primary); font-size: 14px; }

.chat-body {
  flex: 1; overflow-y: auto; padding: 10px 14px;
  max-height: 280px; scroll-behavior: smooth;
}
.chat-body::-webkit-scrollbar { width: 4px; }
.chat-body::-webkit-scrollbar-track { background: transparent; }
.chat-body::-webkit-scrollbar-thumb { background: var(--color-border-primary); border-radius: 2px; }

.chat-empty {
  color: var(--color-text-tertiary); font-size: 13px; text-align: center;
  padding: 24px 0;
}

.msg { display: flex; margin-bottom: 10px; }
.msg.user { justify-content: flex-end; }
.msg.assistant { justify-content: flex-start; }

.msg-bubble {
  max-width: 85%; padding: 8px 12px;
  border-radius: 6px; font-size: 13px; line-height: 1.6;
  white-space: pre-wrap; word-break: break-word;
}
.msg.user .msg-bubble { background: var(--color-primary-500); color: var(--color-text-inverse); }
.msg.assistant .msg-bubble { background: var(--color-bg-tertiary); color: var(--color-text-primary); }

.cursor { animation: blink 0.8s infinite; }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

.quick-row { padding: 4px 12px 4px; display: flex; flex-wrap: wrap; gap: 4px; }
.qq { cursor: pointer; }
.qq:focus-visible { outline: 2px solid var(--color-primary-500); outline-offset: 1px; }

.chat-input {
  display: flex; gap: 6px; padding: 8px 12px;
  align-items: flex-end; border-top: 1px solid var(--color-border-primary);
}

.chat-foot {
  display: flex; justify-content: space-between;
  padding: 2px 12px 8px;
}

.panel-enter-active { transition: opacity 0.2s, transform 0.2s; }
.panel-leave-active { transition: opacity 0.15s, transform 0.15s; }
.panel-enter-from, .panel-leave-to { opacity: 0; transform: translateY(8px); }

.exfil-list { margin: 4px 0; padding-left: 18px; }
.exfil-list li { font-size: 12px; line-height: 1.6; }
.host-line { font-size: 12px; color: var(--color-text-secondary); padding: 0 0 4px; }
.host-line b { color: var(--color-text-brand); word-break: break-all; }
.ps-note-sm { font-size: 11px; color: var(--color-text-tertiary); line-height: 1.5; margin-top: 2px; }

.msg-src {
  margin-top: 4px;
  font-size: 10px;
  color: var(--color-text-tertiary);
  border-top: 1px dashed var(--color-border-primary);
  padding-top: 3px;
}
</style>
