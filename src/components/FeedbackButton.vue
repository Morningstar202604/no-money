<template>
  <div class="feedback">
    <button
      class="feedback-trigger"
      :aria-label="open ? '关闭反馈面板' : '反馈问题'"
      :aria-expanded="open"
      @click="open = !open"
    >
      <svg v-if="!open" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>

    <div v-if="open" class="feedback-panel" role="dialog" aria-label="反馈">
      <h3 class="fb-title">反馈</h3>
      <p class="fb-hint">没有后端，反馈直接走 GitHub Issue。会先在新标签页打开，你确认后才发出。</p>

      <a class="fb-item" :href="bugUrl" target="_blank" rel="noopener noreferrer">
        <span class="fb-icon">🐛</span>
        <span class="fb-body">
          <b>报告问题</b>
          <small>算错了、页面坏了、按钮点不到</small>
        </span>
      </a>

      <a class="fb-item" :href="dataUrl" target="_blank" rel="noopener noreferrer">
        <span class="fb-icon">📋</span>
        <span class="fb-body">
          <b>纠正政策数据</b>
          <small>某个参数不对，附上官方文件更好</small>
        </span>
      </a>

      <a class="fb-item" :href="featureUrl" target="_blank" rel="noopener noreferrer">
        <span class="fb-icon">💡</span>
        <span class="fb-body">
          <b>提建议</b>
          <small>想要什么功能</small>
        </span>
      </a>

      <div class="fb-meta">
        <span>当前版本 {{ version }}</span>
        <button class="fb-copy" @click="copyDiagnostics">
          {{ copied ? '已复制' : '复制诊断信息' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 反馈入口
 *
 * 为什么不做"应用内表单提交"：那需要一个后端接收、存储、展示反馈，
 * 还要处理垃圾信息——与本项目「无后端」的架构承诺直接冲突，
 * 且会把用户的设备信息送到我们服务器。
 *
 * 用 GitHub Issue 预填链接：
 * - 零后端、零运维
 * - 用户能看到提交的全文，确认后才发出（不是偷偷上报）
 * - 公开可搜索，别人遇到同样问题能搜到
 *
 * 诊断信息只包含版本号、城市、浏览器 UA 这类公开信息，
 * 不含任何用户填写的收入/成本数据。
 */
import { ref, computed } from 'vue'
import { useMainStore } from '../stores/main'

const open = ref(false)
const copied = ref(false)
const store = useMainStore()

const version = '3.1.0'
const REPO = 'https://github.com/badhope/no-money/issues/new'

const bugUrl = computed(() =>
  `${REPO}?template=bug_report.md&title=${encodeURIComponent('[Bug] ')}`,
)
const dataUrl = computed(() =>
  `${REPO}?template=data_correction.md&title=${encodeURIComponent('[Data] ' + (store.rule?.cityName ?? '') + ' 参数纠正')}`,
)
const featureUrl = computed(() =>
  `${REPO}?template=feature_request.md&title=${encodeURIComponent('[Feature] ')}`,
)

async function copyDiagnostics(): Promise<void> {
  // 只收集排查必需的公开信息，绝不包含用户收入与成本
  const info = [
    `版本: ${version}`,
    `城市: ${store.rule?.cityName ?? '未加载'} (${store.rule?.city ?? '-'})`,
    `规则版本: ${store.rule?.year ?? '-'}`,
    `主题: ${store.isDark ? '深色' : '浅色'}`,
    `浏览器: ${navigator.userAgent}`,
    `语言: ${navigator.language}`,
    `视口: ${window.innerWidth}×${window.innerHeight}`,
    `离线: ${navigator.onLine ? '否' : '是'}`,
  ].join('\n')

  try {
    await navigator.clipboard.writeText(info)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // 剪贴板被拒（非 HTTPS 或权限拒绝）：退化为选中文本让用户手动复制
    copied.value = false
  }
}
</script>

<style scoped>
.feedback {
  /* 位置：右下角，靠 AI 悬浮按钮左侧。
     左下角被侧边栏的「重置为默认参数」占据（实测点击会被它拦截），
     右下角则要避开 AI 按钮（48px 宽 + 24px 右边距）。 */
  position: fixed;
  right: 84px;
  bottom: 26px;
  z-index: var(--z-sticky);
}

.feedback-trigger {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--surface-border-strong);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}

.feedback-trigger:hover {
  color: var(--color-text-primary);
  border-color: var(--color-primary-500);
}

.feedback-trigger:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.feedback-panel {
  position: absolute;
  right: 0;
  bottom: 52px;
  width: 300px;
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--surface-border-strong);
  box-shadow: var(--color-shadow-lg);
}

.fb-title {
  margin: 0 0 var(--space-1);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.fb-hint {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-relaxed);
  color: var(--color-text-tertiary);
}

.fb-item {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: inherit;
  transition: background var(--duration-fast) var(--ease-out);
}

.fb-item:hover {
  background: var(--surface-2);
}

.fb-icon {
  font-size: 16px;
  line-height: 1.4;
}

.fb-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.fb-body b {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.fb-body small {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.fb-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--surface-border);
  font-size: 10px;
  color: var(--color-text-tertiary);
}

.fb-copy {
  background: none;
  border: none;
  color: var(--color-text-brand);
  font-size: 10px;
  cursor: pointer;
  padding: 2px 4px;
  font-family: inherit;
}

.fb-copy:hover {
  text-decoration: underline;
}

/* 移动端：右下角 AI 按钮与反馈按钮必须都有位置，横向拉开 */
@media (max-width: 768px) {
  .feedback {
    right: 72px;
    bottom: 20px;
  }

  .feedback-panel {
    width: min(300px, calc(100vw - 24px));
    right: -8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .feedback-trigger,
  .fb-item {
    transition: none;
  }
}
</style>
