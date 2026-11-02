// @vitest-environment happy-dom

import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAIChat } from '../../src/composables/useAIChat'

const HISTORY_KEY = 'nomoney_chat_hist'
const CONFIG_KEY = 'nomoney_ai_cfg'
const LEGACY_HISTORY_KEY = 'flexcalc_chat_hist'
const KEY_STORE_KEY = 'nomoney_ai_key'
const LEGACY_KEY_STORE_KEY = 'flexcalc_ai_key'

const storedMessage = {
  id: 'stored-user',
  role: 'user' as const,
  content: '历史问题',
  timestamp: 1,
}

let scope: ReturnType<typeof effectScope> | undefined

function createChat() {
  scope = effectScope()
  let chat!: ReturnType<typeof useAIChat>
  scope.run(() => { chat = useAIChat() })
  return chat
}

async function sendOfflineMessage(chat: ReturnType<typeof useAIChat>) {
  const pending = chat.sendMessage('当前问题', [])
  await vi.advanceTimersByTimeAsync(700)
  await pending
}

describe('AI 对话历史隐私边界', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    scope?.stop()
    scope = undefined
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('流式回复完成后保存完整回复且重建会话不保留流式状态', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"完整"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"回复"}}]}\n\ndata: [DONE]\n\n'))
        controller.close()
      },
    })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200 }))
    const chat = createChat()
    expect(chat.updateConfig({ enabled: true, apiKey: 'test-key', endpoint: 'https://example.com/v1/chat/completions', rememberHistory: true })).toBe(true)
    chat.isOnline.value = true

    await chat.sendMessage('测试问题', [])

    expect(fetchMock).toHaveBeenCalledOnce()
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as Array<Record<string, unknown>>
    expect(saved).toContainEqual(expect.objectContaining({ role: 'assistant', content: '完整回复' }))
    expect(saved.every(message => !('isStreaming' in message))).toBe(true)
    scope?.stop()
    const restored = createChat()
    expect(restored.messages.value).toContainEqual(expect.objectContaining({ role: 'assistant', content: '完整回复' }))
    expect(restored.messages.value.every(message => !message.isStreaming)).toBe(true)
  })

  it('200 SSE 错误不泄露服务商敏感信息到消息、历史或控制台', async () => {
    const sensitive = 'SIMULATED_PRIVATE_PROVIDER_DETAIL_987654'
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: { message: sensitive } })}\n\n`))
        controller.close()
      },
    })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200 }))
    const consoleMocks = (['log', 'info', 'warn', 'error', 'debug'] as const).map(method => vi.spyOn(console, method).mockImplementation(() => {}))
    const chat = createChat()
    expect(chat.updateConfig({ enabled: true, apiKey: 'test-key', endpoint: 'https://example.com/v1/chat/completions', rememberHistory: true })).toBe(true)
    chat.isOnline.value = true

    await chat.sendMessage('测试问题', [])

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(chat.messages.value.some(message => message.content.includes('AI连接失败'))).toBe(true)
    expect(JSON.stringify(chat.messages.value)).not.toContain(sensitive)
    expect(localStorage.getItem(HISTORY_KEY)).not.toBeNull()
    expect(localStorage.getItem(HISTORY_KEY)).not.toContain(sensitive)
    expect(JSON.stringify(consoleMocks.flatMap(mock => mock.mock.calls))).not.toContain(sensitive)
  })

  it('默认不读取或写入对话历史，当前会话仍可继续', async () => {
    // happy-dom 把 Storage 方法绑定为实例自有属性，必须 spy 实例本身才能拦到调用
    const setItem = vi.spyOn(localStorage, 'setItem')
    localStorage.setItem(HISTORY_KEY, JSON.stringify([storedMessage]))
    setItem.mockClear()
    const getItem = vi.spyOn(localStorage, 'getItem')

    const chat = createChat()

    expect(chat.config.value.rememberHistory).toBe(false)
    expect(chat.messages.value).toHaveLength(1)
    expect(getItem).not.toHaveBeenCalledWith(HISTORY_KEY)

    await sendOfflineMessage(chat)

    expect(chat.messages.value.some(m => m.content === '当前问题')).toBe(true)
    expect(setItem).not.toHaveBeenCalledWith(HISTORY_KEY, expect.any(String))

    expect(chat.updateConfig({ rememberHistory: true })).toBe(true)
    const optedIn = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as Array<{ content: string }>
    expect(optedIn.some(m => m.content === '当前问题')).toBe(true)
  })

  it('用户显式启用后才加载并保存有界的历史', async () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ rememberHistory: true }))
    localStorage.setItem(HISTORY_KEY, JSON.stringify([storedMessage]))

    const chat = createChat()

    expect(chat.config.value.rememberHistory).toBe(true)
    expect(chat.messages.value).toContainEqual(storedMessage)

    await sendOfflineMessage(chat)

    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as Array<{ content: string }>
    expect(saved.some(m => m.content === '当前问题')).toBe(true)
  })

  it('关闭本地历史时删除已持久化的当前与旧品牌对话', () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ rememberHistory: true }))
    localStorage.setItem(HISTORY_KEY, JSON.stringify([storedMessage]))
    localStorage.setItem(LEGACY_HISTORY_KEY, JSON.stringify([storedMessage]))

    const chat = createChat()
    expect(chat.messages.value).toContainEqual(storedMessage)

    expect(chat.updateConfig({ rememberHistory: false })).toBe(true)

    expect(localStorage.getItem(HISTORY_KEY)).toBeNull()
    expect(localStorage.getItem(LEGACY_HISTORY_KEY)).toBeNull()
    expect(chat.messages.value).toContainEqual(storedMessage)
  })

  it('默认不触碰旧品牌对话，显式启用后才兼容迁移', () => {
    localStorage.setItem(LEGACY_HISTORY_KEY, JSON.stringify([storedMessage]))

    const chat = createChat()

    expect(chat.messages.value).not.toContainEqual(storedMessage)
    expect(localStorage.getItem(LEGACY_HISTORY_KEY)).not.toBeNull()

    expect(chat.updateConfig({ endpoint: 'https://example.com/v1/chat/completions' })).toBe(true)
    expect(localStorage.getItem(LEGACY_HISTORY_KEY)).not.toBeNull()

    expect(chat.updateConfig({ rememberHistory: true })).toBe(true)

    expect(chat.messages.value).toContainEqual(storedMessage)
    expect(localStorage.getItem(HISTORY_KEY)).not.toBeNull()
    expect(localStorage.getItem(LEGACY_HISTORY_KEY)).toBeNull()
  })

  it('本地存储写入失败时返回失败而不阻断当前会话', () => {
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('storage unavailable', 'QuotaExceededError')
    })
    const chat = createChat()

    expect(() => chat.updateConfig({ rememberHistory: true })).not.toThrow()
    expect(chat.updateConfig({ rememberHistory: true })).toBe(false)
    setItem.mockRestore()
  })

  it('旧 Key 写入新键失败时保留旧键', () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ rememberKey: true }))
    localStorage.setItem(LEGACY_KEY_STORE_KEY, 'legacy-key')
    const originalSet = localStorage.setItem.bind(localStorage)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === KEY_STORE_KEY) throw new DOMException('quota', 'QuotaExceededError')
      originalSet(key, value)
    })
    const chat = createChat()
    expect(chat.config.value.apiKey).toBe('legacy-key')
    expect(localStorage.getItem(LEGACY_KEY_STORE_KEY)).toBe('legacy-key')
    expect(chat.storageWarning.value).toBeTruthy()
    setItem.mockRestore()
  })

  it('配置写入失败时不写入新的对话历史', () => {
    const chat = createChat()
    const originalSet = localStorage.setItem.bind(localStorage)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === CONFIG_KEY) throw new DOMException('quota', 'QuotaExceededError')
      originalSet(key, value)
    })
    expect(chat.updateConfig({ rememberHistory: true })).toBe(false)
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull()
    expect(chat.config.value.rememberHistory).toBe(false)
    setItem.mockRestore()
  })

  it('新旧历史共存时显式启用后合并而不丢失', () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([storedMessage]))
    localStorage.setItem(LEGACY_HISTORY_KEY, JSON.stringify([{ ...storedMessage, id: 'legacy', content: '旧对话' }]))
    const chat = createChat()
    expect(chat.updateConfig({ rememberHistory: true })).toBe(true)
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as Array<{ content: string }>
    expect(history.map(item => item.content)).toEqual(expect.arrayContaining(['历史问题', '旧对话']))
    expect(localStorage.getItem(LEGACY_HISTORY_KEY)).toBeNull()
  })

  it('历史删除失败时反馈并保留警告', () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ rememberHistory: true }))
    localStorage.setItem(HISTORY_KEY, JSON.stringify([storedMessage]))
    const chat = createChat()
    const removeItem = vi.spyOn(localStorage, 'removeItem').mockImplementation((key) => {
      if (key === HISTORY_KEY) throw new DOMException('denied', 'SecurityError')
    })
    expect(chat.updateConfig({ rememberHistory: false })).toBe(false)
    expect(localStorage.getItem(HISTORY_KEY)).not.toBeNull()
    expect(chat.storageWarning.value).toContain('未能完全删除')
    removeItem.mockRestore()
  })

  it('关闭历史时删除失败，重建后仍检测残留历史并告警，且不改变已选偏好', () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ rememberHistory: true }))
    localStorage.setItem(HISTORY_KEY, JSON.stringify([storedMessage]))
    const chat = createChat()
    const removeItem = vi.spyOn(localStorage, 'removeItem').mockImplementation((key) => {
      if (key === HISTORY_KEY) throw new DOMException('denied', 'SecurityError')
    })

    expect(chat.updateConfig({ rememberHistory: false })).toBe(false)
    expect(chat.storageWarning.value).toContain('未能完全删除')
    expect(localStorage.getItem(HISTORY_KEY)).not.toBeNull()

    scope?.stop()
    // 重建时只能读「待删除标记」，不得为判断告警而读取历史内容本身
    const getItem = vi.spyOn(localStorage, 'getItem')
    const restored = createChat()
    expect(getItem).not.toHaveBeenCalledWith(HISTORY_KEY)
    expect(getItem).not.toHaveBeenCalledWith(LEGACY_HISTORY_KEY)

    expect(restored.config.value.rememberHistory).toBe(false)
    expect(restored.messages.value.some(message => message.id === storedMessage.id)).toBe(false)
    expect(restored.storageWarning.value).toContain('可能尚未清除')
    expect(localStorage.getItem(HISTORY_KEY)).not.toBeNull()
    removeItem.mockRestore()
  })

  it('清除 API Key 时删除当前与旧品牌存储键', () => {
    localStorage.clear()
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ rememberKey: true }))
    localStorage.setItem(KEY_STORE_KEY, 'stored-key')
    localStorage.setItem(LEGACY_KEY_STORE_KEY, 'legacy-key')

    const chat = createChat()
    expect(chat.config.value.apiKey).toBe('stored-key')

    expect(chat.updateConfig({ apiKey: '', rememberKey: false })).toBe(true)
    expect(localStorage.getItem(KEY_STORE_KEY)).toBeNull()
    expect(localStorage.getItem(LEGACY_KEY_STORE_KEY)).toBeNull()
    expect(chat.config.value.apiKey).toBe('')
  })

  it('清除 API Key 失败时不报告成功且保留失败证据', () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ rememberKey: true }))
    localStorage.setItem(KEY_STORE_KEY, 'stored-key')
    const chat = createChat()
    const removeItem = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('storage unavailable', 'QuotaExceededError')
    })

    expect(chat.updateConfig({ apiKey: '', rememberKey: false })).toBe(false)
    expect(localStorage.getItem(KEY_STORE_KEY)).toBe('stored-key')
    expect(chat.config.value.apiKey).toBe('')
    removeItem.mockRestore()
  })
})
