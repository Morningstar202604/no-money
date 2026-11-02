// @vitest-environment happy-dom

import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAIChat } from '../../src/composables/useAIChat'

let scope: ReturnType<typeof effectScope>

function createChat() {
  scope = effectScope()
  return scope.run(() => useAIChat())!
}

describe('对话请求竞态', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    scope?.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('旧请求停止后完成，不会解除新请求的流式状态或阻止其取消', async () => {
    const rejects: Array<(reason: unknown) => void> = []
    const signals: AbortSignal[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      signals.push(init!.signal as AbortSignal)
      return new Promise((_resolve, reject) => { rejects.push(reject) })
    })
    const chat = createChat()
    chat.updateConfig({ enabled: true, apiKey: 'test-key', endpoint: 'https://example.com/v1/chat/completions' })
    chat.isOnline.value = true
    const oldRequest = chat.sendMessage('旧问题', [])
    chat.stopStreaming()
    const newRequest = chat.sendMessage('新问题', [])
    rejects[0](new DOMException('aborted', 'AbortError'))
    await oldRequest
    expect(chat.isStreaming.value).toBe(true)
    chat.stopStreaming()
    expect(signals[1].aborted).toBe(true)
    rejects[1](new DOMException('aborted', 'AbortError'))
    await newRequest
  })

  it('离线等待时清空历史，旧回复不会写回内存或本地历史', async () => {
    const chat = createChat()
    expect(chat.updateConfig({ rememberHistory: true })).toBe(true)
    const pending = chat.sendMessage('旧问题', [])
    expect(chat.clearHistory()).toBe(true)
    await vi.advanceTimersByTimeAsync(700)
    await pending
    expect(chat.messages.value.map(message => message.id)).toEqual(['welcome2'])
    expect(localStorage.getItem('nomoney_chat_hist')).toBeNull()
  })
})
