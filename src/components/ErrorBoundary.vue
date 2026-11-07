<template>
  <!-- 捕获子树渲染错误后展示降级 UI；slot 正常时原样渲染 -->
  <slot v-if="!captured" />

  <div v-else class="eb" role="alert">
    <div class="eb-card">
      <div class="eb-title">这一页显示出错了</div>
      <p class="eb-detail">
        页面其他部分不受影响。通常是某条数据触发了显示问题——
        重试或换个页面通常能恢复。
      </p>
      <!-- 展示 message 而非完整堆栈：堆栈对用户是噪音，对攻击者是信息 -->
      <code v-if="shortMessage" class="eb-code">{{ shortMessage }}</code>
      <div class="eb-actions">
        <button class="eb-btn primary" @click="retry">重试</button>
        <button class="eb-btn" @click="goHome">回总览</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 错误边界（ErrorBoundary）
 *
 * Vue 的 onErrorCaptured 只能捕获**子树**的渲染/生命周期错误，
 * 这正是我们要的隔离边界：RouterView 换到哪一页，边界就罩到哪一页。
 *
 * 与 main.ts 全局 handler 的分工：
 *   - 这里管「可恢复」的视图级错误：UI 降级 + 重试，应用其他部分照常
 *   - 全局 handler 管「兜不住」的错误（比如 app 级初始化失败）：整页提示
 *     全局 handler 需要放行这里已捕获的错误，否则会双重处理（见 return false 的注释）
 */
import { ref, onErrorCaptured } from 'vue'
import { useRouter } from 'vue-router'

const captured = ref(false)
const message = ref('')
const router = useRouter()
/** 重试计数：同一错误连续重试超过 3 次就不再自动重建，避免死循环 */
const attempts = ref(0)

const shortMessage = ref('')

onErrorCaptured((err) => {
  captured.value = true
  message.value = err instanceof Error ? err.message : String(err)
  // 只留首行与长度，错误消息可能内嵌用户可控数据（localStorage 原文等）
  shortMessage.value = message.value.split('\n')[0].slice(0, 140)
  // 返回 false 阻止错误继续向上传播到全局 handler（否则整页白屏卡会出现两次）
  return false
})

/** 强制重建子树：换 key 让 Vue 销毁并重新创建当前视图 */
function retry() {
  if (attempts.value >= 3) return
  attempts.value++
  captured.value = false
  message.value = ''
  // 重挂载：给 RouterView 一个变化的 key（通过重新导航到当前路由实现）
  void router.replace({ path: router.currentRoute.value.path, query: { ...router.currentRoute.value.query, _retry: String(attempts.value) } })
}

function goHome() {
  captured.value = false
  message.value = ''
  attempts.value = 0
  void router.push('/dashboard')
}
</script>

<style scoped>
.eb {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  padding: var(--space-6);
}

.eb-card {
  max-width: 460px;
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  text-align: center;
}

.eb-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.eb-detail {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-3);
}

.eb-code {
  display: block;
  padding: var(--space-2) var(--space-3);
  margin-bottom: var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--surface-border);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  word-break: break-all;
  text-align: left;
  max-height: 80px;
  overflow: auto;
}

.eb-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: center;
}

.eb-btn {
  padding: 6px 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--surface-border-strong);
  background: var(--surface-1);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-family: inherit;
  cursor: pointer;
  min-height: 32px;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.eb-btn:hover { border-color: var(--color-primary-500); }
.eb-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.eb-btn.primary {
  background: var(--color-primary-500);
  border-color: var(--color-primary-500);
  color: var(--color-text-on-primary);
  font-weight: var(--font-weight-medium);
}
</style>
