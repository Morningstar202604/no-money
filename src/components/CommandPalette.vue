<template>
  <Teleport to="body">
    <!--
      不用 <Transition>：Teleport + Transition + v-if 三者组合时，Vue 在
      某些时序下会残留 enter-from / leave-from 类名，面板 opacity 归零却仍占据
      全屏遮罩，表现为"命令执行了但面板不消失、页面点不动"。
      改用 CSS animation 做进场，关闭时直接卸载节点，行为确定。
    -->
    <div
      v-if="props.open"
      class="palette-backdrop"
      role="presentation"
      @click.self="close"
    >
        <div
          ref="panelRef"
          class="palette"
          role="dialog"
          aria-modal="true"
          aria-label="命令面板"
        >
          <div class="palette-input-row">
            <svg class="palette-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" stroke-linecap="round" />
            </svg>
            <input
              ref="inputRef"
              v-model="query"
              class="palette-input"
              type="text"
              role="combobox"
              :aria-expanded="true"
              aria-controls="palette-results"
              :aria-activedescendant="activeId"
              placeholder="搜索页面、城市或操作…"
              autocomplete="off"
              spellcheck="false"
              @keydown="onKeydown"
            />
            <kbd class="palette-kbd">ESC</kbd>
          </div>

          <div id="palette-results" class="palette-results" role="listbox" aria-label="命令列表">
            <template v-if="grouped.length">
              <div v-for="section in grouped" :key="section.group" class="palette-group">
                <div class="palette-group-title" role="presentation">{{ section.group }}</div>
                <button
                  v-for="item in section.items"
                  :id="`palette-item-${item.command.id}`"
                  :key="item.command.id"
                  class="palette-item"
                  :class="{ active: item.command.id === activeCommand?.command.id }"
                  role="option"
                  :aria-selected="item.command.id === activeCommand?.command.id"
                  @click="run(item.command)"
                  @mousemove="setActiveById(item.command.id)"
                >
                  <span class="palette-item-label" v-html="highlight(item)" />
                  <span v-if="item.command.hint" class="palette-item-hint">{{ item.command.hint }}</span>
                  <span class="palette-item-kind">{{ KIND_LABEL[item.command.kind] }}</span>
                </button>
              </div>
            </template>
            <div v-else class="palette-empty">
              <p>没有匹配的命令</p>
              <p class="palette-empty-hint">试试输入城市名（如「深圳」）或页面名（如「税务」）</p>
            </div>
          </div>

          <div class="palette-footer">
            <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
            <span><kbd>↵</kbd> 执行</span>
            <span><kbd>ESC</kbd> 关闭</span>
          </div>
        </div>
      </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * 命令面板（⌘K / Ctrl+K）
 *
 * 为什么做这个：
 * 本项目有 5 个页面、34 座城市、十几项参数。侧边栏能覆盖页面，但「切到深圳」
 * 要打开地图 → 找城市 → 点击，三步；熟练用户一天要切好几次城市对比。
 * 命令面板把这两类高频操作压到「敲两个键 + 回车」。
 *
 * 无障碍要点：
 * - 用 combobox + listbox 语义，方向键移动时同步 aria-activedescendant
 * - 焦点锁在输入框，Tab 不逃出面板
 * - 打开时记住原来的焦点元素，关闭后还回去
 */
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { rankCommands, groupCommands, type Command } from '../utils/commandPalette'

const props = defineProps<{
  commands: Command[]
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

/**
 * 显式 emit 而非 defineModel：
 * defineModel 在 Teleport + Transition 组合下，关闭时父组件更新有延迟，
 * 实测出现"命令已执行但面板还挂在屏幕上"。直接 emit 让关闭是同步的。
 */
function setOpen(value: boolean) {
  emit('update:open', value)
}

const KIND_LABEL: Record<Command['kind'], string> = {
  navigate: '页面',
  city: '城市',
  action: '操作',
}

const query = ref('')
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

const ranked = computed(() => rankCommands(query.value, props.commands))
const grouped = computed(() => groupCommands(ranked.value))
/** 扁平顺序，用于方向键索引；分组只影响渲染，不影响移动 */
const flat = computed(() => grouped.value.flatMap((g) => g.items))
const activeCommand = computed(() => flat.value[activeIndex.value] ?? null)
const activeId = computed(() =>
  activeCommand.value ? `palette-item-${activeCommand.value.command.id}` : undefined,
)

watch(query, () => {
  activeIndex.value = 0
})

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    previouslyFocused = document.activeElement as HTMLElement | null
    query.value = ''
    activeIndex.value = 0
    await nextTick()
    inputRef.value?.focus()
  } else {
    previouslyFocused?.focus?.()
    previouslyFocused = null
  }
})

function close() {
  setOpen(false)
}

function run(command: Command) {
  // 先执行再关闭：关闭会触发 watch 把焦点还回原处，
  // 若先关再执行，跳转过程中焦点争夺会让某些浏览器的点击丢失
  const action = command.run
  setOpen(false)
  action()
}

function setActiveById(id: string) {
  const idx = flat.value.findIndex((i) => i.command.id === id)
  if (idx >= 0) activeIndex.value = idx
}

function move(delta: number) {
  const total = flat.value.length
  if (!total) return
  activeIndex.value = (activeIndex.value + delta + total) % total
  nextTick(() => {
    const el = document.getElementById(`palette-item-${activeCommand.value?.command.id}`)
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function onKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      move(1)
      break
    case 'ArrowUp':
      e.preventDefault()
      move(-1)
      break
    case 'Home':
      e.preventDefault()
      activeIndex.value = 0
      break
    case 'End':
      e.preventDefault()
      activeIndex.value = Math.max(0, flat.value.length - 1)
      break
    case 'Enter':
      e.preventDefault()
      if (activeCommand.value) run(activeCommand.value.command)
      break
    case 'Escape':
      e.preventDefault()
      close()
      break
    case 'Tab':
      // 焦点锁在输入框，Tab 不逃出对话框
      e.preventDefault()
      break
  }
}

/** 把命中字符包成 <mark>；label 是本地注册的命令名，不含用户输入，可安全用 v-html */
function highlight(item: { command: Command; matches: number[] }): string {
  const label = item.command.label
  if (!item.matches.length) return escapeHtml(label)

  let out = ''
  let last = 0
  for (const idx of item.matches) {
    if (idx >= label.length) continue
    out += escapeHtml(label.slice(last, idx))
    out += `<mark>${escapeHtml(label[idx])}</mark>`
    last = idx + 1
  }
  out += escapeHtml(label.slice(last))
  return out
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

/** 点击面板外部关闭：移动端没有 ESC 键，必须能用手指退出 */
function onDocumentPointerDown(e: PointerEvent) {
  if (!props.open) return
  if (panelRef.value && !panelRef.value.contains(e.target as Node)) close()
}

document.addEventListener('pointerdown', onDocumentPointerDown)
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown))
</script>

<style scoped>
.palette-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-command-palette);
  background: rgba(2, 6, 23, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: clamp(12px, 8vh, 96px) 12px 12px;
}

.palette {
  width: min(640px, 100%);
  max-height: min(560px, calc(100dvh - 96px));
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--surface-border-strong);
  border-radius: var(--radius-xl);
  box-shadow: var(--color-shadow-xl);
  overflow: hidden;
}

.palette-input-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--surface-border);
  flex-shrink: 0;
}

.palette-search-icon {
  width: 18px;
  height: 18px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.palette-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-text-primary);
  font-size: var(--font-size-lg);
  font-family: inherit;
}

.palette-input::placeholder {
  color: var(--color-text-tertiary);
}

.palette-kbd,
.palette-footer kbd {
  font-family: var(--font-family-mono);
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--surface-border);
  color: var(--color-text-tertiary);
}

.palette-results {
  overflow-y: auto;
  padding: var(--space-2);
  flex: 1;
  min-height: 0;
}

.palette-group + .palette-group {
  margin-top: var(--space-2);
}

.palette-group-title {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-tertiary);
  padding: var(--space-2) var(--space-3);
}

.palette-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
}

.palette-item.active {
  background: var(--color-primary-50);
  box-shadow: inset 2px 0 0 var(--color-primary-500);
}

.palette-item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.palette-item-label :deep(mark) {
  background: transparent;
  color: var(--color-text-brand);
  font-weight: var(--font-weight-semibold);
}

.palette-item-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.palette-item-kind {
  font-size: 10px;
  color: var(--color-text-tertiary);
  padding: 1px 6px;
  border-radius: var(--radius-full);
  border: 1px solid var(--surface-border);
  flex-shrink: 0;
}

.palette-empty {
  padding: var(--space-10) var(--space-4);
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
}

.palette-empty-hint {
  margin-top: var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.palette-footer {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-5);
  border-top: 1px solid var(--surface-border);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.palette-footer span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

/* 进出场：从上方轻微下滑 + 淡入，符合"面板从顶部拉出"的直觉 */
/* 进场动画：遮罩淡入 + 面板自上方落下。
   关闭不做动画——命令已经执行完，用户注意力已经转移，拖 200ms 只会显得迟钝。 */
.palette-backdrop {
  animation: palette-fade-in var(--duration-fast) var(--ease-out);
}

.palette {
  animation: palette-drop-in var(--duration-normal) var(--ease-out);
}

@keyframes palette-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes palette-drop-in {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 640px) {
  .palette-backdrop {
    padding-top: 12px;
  }

  .palette-footer {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .palette-backdrop,
  .palette {
    animation: none;
  }
}
</style>
