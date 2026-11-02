// @vitest-environment happy-dom
import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAIChat } from '../../src/composables/useAIChat'

let scope: ReturnType<typeof effectScope>

function createChat() {
  scope = effectScope()
  return scope.run(() => useAIChat())!
}

function onlineChat() {
  const chat = createChat()
  expect(chat.updateConfig({ enabled: true, apiKey: 'test-key', rememberHistory: true })).toBe(true)
  chat.isOnline.value = true
  return chat
}

describe('对话隐私失败场景', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    scope?.stop()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it.each(['clear', 'stop'] as const)('%s 后旧请求以普通错误失败不污染当前消息', async action => {
    let reject!: (error: Error) => void
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise((_resolve, fail) => { reject = fail }))
    const chat = onlineChat()
    const pending = chat.sendMessage('旧问题', [])
    if (action === 'clear') chat.clearHistory()
    else chat.stopStreaming()
    const before = JSON.stringify(chat.messages.value)
    const historyBefore = localStorage.getItem('nomoney_chat_hist')
    reject(new Error('network failure'))
    await pending
    expect(JSON.stringify(chat.messages.value)).toBe(before)
    expect(localStorage.getItem('nomoney_chat_hist')).toBe(historyBefore)
  })

  it('清空后忽略延迟到达的在线响应', async () => {
    let resolve!: (response: Response) => void
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(done => { resolve = done }))
    const chat = onlineChat()
    const pending = chat.sendMessage('旧问题', [])
    chat.clearHistory()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"旧回复"}}]}\n\n'))
        controller.close()
      },
    })
    resolve(new Response(stream, { status: 200 }))
    await pending
    expect(chat.messages.value.map(message => message.id)).toEqual(['welcome2'])
    expect(localStorage.getItem('nomoney_chat_hist')).toBeNull()
  })

  it('历史保存失败且设置回滚不可用时，重建不会启用或读取历史', () => {
    const oldHistory = JSON.stringify([{ id: 'old', role: 'user', content: '私密历史', timestamp: 1 }])
    localStorage.setItem('nomoney_chat_hist', oldHistory)
    const chat = createChat()
    const originalSet = localStorage.setItem.bind(localStorage)
    let configWrites = 0
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'nomoney_chat_hist') throw new DOMException('quota', 'QuotaExceededError')
      if (key === 'nomoney_ai_cfg' && ++configWrites > 1) throw new DOMException('quota', 'QuotaExceededError')
      originalSet(key, value)
    })
    const updated = chat.updateConfig({ rememberHistory: true })
    setItem.mockRestore()
    expect(updated).toBe(false)
    expect(chat.config.value.rememberHistory).toBe(false)
    expect(localStorage.getItem('nomoney_chat_hist')).toBe(oldHistory)
    scope.stop()
    const restored = createChat()
    expect(restored.config.value.rememberHistory).toBe(false)
    expect(restored.messages.value.some(message => message.content === '私密历史')).toBe(false)
    expect(localStorage.getItem('nomoney_chat_hist')).toBe(oldHistory)
  })

  it('Key 保存失败不持久化启用历史设置，重建后仍不读取历史', () => {
    localStorage.setItem('nomoney_chat_hist', JSON.stringify([{ id: 'old', role: 'user', content: '私密历史', timestamp: 1 }]))
    const chat = createChat()
    const originalSet = localStorage.setItem.bind(localStorage)
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'nomoney_ai_key') throw new DOMException('quota', 'QuotaExceededError')
      originalSet(key, value)
    })
    expect(chat.updateConfig({ rememberHistory: true, rememberKey: true, apiKey: 'test-key' })).toBe(false)
    expect(chat.config.value.rememberHistory).toBe(false)
    scope.stop()
    const restored = createChat()
    expect(restored.config.value.rememberHistory).toBe(false)
    expect(restored.messages.value.some(message => message.content === '私密历史')).toBe(false)
  })

  it('关闭历史时配置写入失败仍停止保存并删除现有历史', async () => {
    const chat = createChat()
    expect(chat.updateConfig({ rememberHistory: true })).toBe(true)
    const originalSet = localStorage.setItem.bind(localStorage)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'nomoney_ai_cfg') throw new DOMException('quota', 'QuotaExceededError')
      originalSet(key, value)
    })
    expect(chat.updateConfig({ rememberHistory: false })).toBe(false)
    setItem.mockRestore()
    expect(chat.config.value.rememberHistory).toBe(false)
    expect(localStorage.getItem('nomoney_chat_hist')).toBeNull()
    await chat.sendMessage('不应保存', [])
    expect(localStorage.getItem('nomoney_chat_hist')).toBeNull()
  })

  it('存在待删除标志时即使旧配置启用也不读取历史', () => {
    localStorage.setItem('nomoney_ai_cfg', JSON.stringify({ rememberHistory: true }))
    localStorage.setItem('nomoney_chat_hist', JSON.stringify([{ id: 'old', role: 'user', content: '私密历史', timestamp: 1 }]))
    localStorage.setItem('nomoney_chat_hist_pending_delete', '1')
    const getItem = vi.spyOn(localStorage, 'getItem')
    const chat = createChat()
    expect(chat.config.value.rememberHistory).toBe(false)
    expect(chat.messages.value.some(message => message.content === '私密历史')).toBe(false)
    expect(getItem).not.toHaveBeenCalledWith('nomoney_chat_hist')
    expect(chat.storageWarning.value).toContain('可能尚未清除')
  })

  it('配置写入失败时补偿删除刚保存的 Key', () => {
    const chat = createChat()
    const originalSet = localStorage.setItem.bind(localStorage)
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'nomoney_ai_cfg') throw new DOMException('quota', 'QuotaExceededError')
      originalSet(key, value)
    })
    expect(chat.updateConfig({ rememberKey: true, apiKey: 'test-key' })).toBe(false)
    setItem.mockRestore()
    expect(localStorage.getItem('nomoney_ai_key')).toBeNull()
    expect(chat.config.value.rememberKey).toBe(false)
  })

  it('待删除标志读取失败时不加载、不保存历史并提示', async () => {
    localStorage.setItem('nomoney_ai_cfg', JSON.stringify({ rememberHistory: true }))
    const old = JSON.stringify([{ id: 'old', role: 'user', content: '私密历史', timestamp: 1 }])
    localStorage.setItem('nomoney_chat_hist', old)
    const originalGet = localStorage.getItem.bind(localStorage)
    const get = vi.spyOn(localStorage, 'getItem').mockImplementation(key => {
      if (key === 'nomoney_chat_hist_pending_delete') throw new DOMException('denied', 'SecurityError')
      return originalGet(key)
    })
    const chat = createChat()
    const initial = chat.messages.value.map(message => message.content)
    const remembered = chat.config.value.rememberHistory
    const warning = chat.storageWarning.value
    await chat.sendMessage('不得保存', [])
    const after = originalGet('nomoney_chat_hist')
    get.mockRestore()
    expect(remembered).toBe(false)
    expect(initial).not.toContain('私密历史')
    expect(after).toBe(old)
    expect(warning).toContain('历史')
  })

  it('配置和标志写入及历史删除均失败时提示清除站点数据', () => {
    const chat = createChat()
    expect(chat.updateConfig({ rememberHistory: true })).toBe(true)
    const originalSet = localStorage.setItem.bind(localStorage)
    const originalRemove = localStorage.removeItem.bind(localStorage)
    const set = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'nomoney_ai_cfg' || key === 'nomoney_chat_hist_pending_delete') throw new DOMException('denied', 'SecurityError')
      originalSet(key, value)
    })
    const remove = vi.spyOn(localStorage, 'removeItem').mockImplementation(key => {
      if (key === 'nomoney_chat_hist') throw new DOMException('denied', 'SecurityError')
      originalRemove(key)
    })
    const result = chat.updateConfig({ rememberHistory: false })
    const warning = chat.storageWarning.value
    set.mockRestore()
    remove.mockRestore()
    expect(result).toBe(false)
    expect(warning).toContain('清除站点数据')
    expect(warning).toContain('重启')
  })

  it('模拟设置界面先双向绑定再保存时配置失败仍补偿删除 Key', () => {
    const chat = createChat()
    chat.config.value.rememberKey = true
    chat.config.value.apiKey = 'test-key'
    const originalSet = localStorage.setItem.bind(localStorage)
    const set = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'nomoney_ai_cfg') throw new DOMException('quota', 'QuotaExceededError')
      originalSet(key, value)
    })
    const result = chat.updateConfig({ ...chat.config.value })
    set.mockRestore()
    expect(result).toBe(false)
    expect(localStorage.getItem('nomoney_ai_key')).toBeNull()
    expect(chat.config.value.rememberKey).toBe(false)
  })

  it('无关设置保存成功不清除未解除的历史删除告警', () => {
    localStorage.setItem('nomoney_chat_hist_pending_delete', '1')
    const chat = createChat()
    expect(chat.storageWarning.value).toContain('可能尚未清除')
    expect(chat.updateConfig({ model: 'another-model' })).toBe(true)
    expect(chat.storageWarning.value).toContain('可能尚未清除')
  })

  it('标志读取失败不阻断立即清除内存和本机 Key', () => {
    const chat = createChat()
    expect(chat.updateConfig({ rememberHistory: true, rememberKey: true, apiKey: 'test-key' })).toBe(true)
    const originalGet = localStorage.getItem.bind(localStorage)
    const get = vi.spyOn(localStorage, 'getItem').mockImplementation(key => {
      if (key === 'nomoney_chat_hist_pending_delete') throw new DOMException('denied', 'SecurityError')
      return originalGet(key)
    })
    const result = chat.updateConfig({ apiKey: '', rememberKey: false })
    const inMemory = chat.config.value.apiKey
    const stored = originalGet('nomoney_ai_key')
    const warning = chat.storageWarning.value
    get.mockRestore()
    expect(result).toBe(false)
    expect(inMemory).toBe('')
    expect(stored).toBeNull()
    expect(warning).toContain('历史')
  })

  it('设置已关闭但历史删除和标志写入失败时警告重启风险', () => {
    const chat = createChat()
    expect(chat.updateConfig({ rememberHistory: true })).toBe(true)
    const originalSet = localStorage.setItem.bind(localStorage)
    const originalRemove = localStorage.removeItem.bind(localStorage)
    const set = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'nomoney_chat_hist_pending_delete') throw new DOMException('denied', 'SecurityError')
      originalSet(key, value)
    })
    const remove = vi.spyOn(localStorage, 'removeItem').mockImplementation(key => {
      if (key === 'nomoney_chat_hist') throw new DOMException('denied', 'SecurityError')
      originalRemove(key)
    })
    const result = chat.updateConfig({ rememberHistory: false })
    const warning = chat.storageWarning.value
    set.mockRestore()
    remove.mockRestore()
    scope.stop()
    const restored = createChat()
    expect(result).toBe(false)
    expect(warning).toContain('重启')
    expect(warning).toContain('清除站点数据')
    expect(restored.config.value.rememberHistory).toBe(false)
    expect(localStorage.getItem('nomoney_chat_hist')).not.toBeNull()
    expect(restored.storageWarning.value).toBeNull()
  })

  it('配置失败且历史与新 Key 均无法删除时同时提示两项风险', () => {
    const chat = createChat()
    expect(chat.updateConfig({ rememberHistory: true })).toBe(true)
    const originalSet = localStorage.setItem.bind(localStorage)
    const originalRemove = localStorage.removeItem.bind(localStorage)
    const set = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'nomoney_ai_cfg') throw new DOMException('denied', 'SecurityError')
      originalSet(key, value)
    })
    const remove = vi.spyOn(localStorage, 'removeItem').mockImplementation(key => {
      if (key === 'nomoney_ai_key' || key === 'nomoney_chat_hist') throw new DOMException('denied', 'SecurityError')
      originalRemove(key)
    })
    const result = chat.updateConfig({ rememberHistory: false, rememberKey: true, apiKey: 'test-key' })
    const warning = chat.storageWarning.value
    set.mockRestore()
    remove.mockRestore()
    expect(result).toBe(false)
    expect(localStorage.getItem('nomoney_ai_key')).toBe('test-key')
    expect(localStorage.getItem('nomoney_chat_hist')).not.toBeNull()
    expect(warning).toContain('历史')
    expect(warning).toContain('Key')
  })

  it('历史待删且无法删除时仍执行 Key 清除', () => {
    const chat = createChat()
    expect(chat.updateConfig({ rememberHistory: true, rememberKey: true, apiKey: 'test-key' })).toBe(true)
    localStorage.setItem('nomoney_chat_hist_pending_delete', '1')
    const originalRemove = localStorage.removeItem.bind(localStorage)
    const remove = vi.spyOn(localStorage, 'removeItem').mockImplementation(key => {
      if (key === 'nomoney_chat_hist') throw new DOMException('denied', 'SecurityError')
      originalRemove(key)
    })
    const result = chat.updateConfig({ apiKey: '', rememberKey: false })
    const warning = chat.storageWarning.value
    remove.mockRestore()
    expect(result).toBe(false)
    expect(chat.config.value.apiKey).toBe('')
    expect(localStorage.getItem('nomoney_ai_key')).toBeNull()
    expect(warning).toContain('历史')
  })

  it('同时关闭历史和清除已有 Key 时两者失败均告警', () => {
    const chat = createChat()
    expect(chat.updateConfig({ rememberHistory: true, rememberKey: true, apiKey: 'test-key' })).toBe(true)
    const originalRemove = localStorage.removeItem.bind(localStorage)
    const remove = vi.spyOn(localStorage, 'removeItem').mockImplementation(key => {
      if (key === 'nomoney_ai_key' || key === 'nomoney_chat_hist') throw new DOMException('denied', 'SecurityError')
      originalRemove(key)
    })
    const result = chat.updateConfig({ rememberHistory: false, apiKey: '', rememberKey: false })
    const warning = chat.storageWarning.value
    remove.mockRestore()
    expect(result).toBe(false)
    expect(chat.config.value.apiKey).toBe('')
    expect(localStorage.getItem('nomoney_ai_key')).toBe('test-key')
    expect(localStorage.getItem('nomoney_chat_hist')).not.toBeNull()
    expect(warning).toContain('历史')
    expect(warning).toContain('Key')
  })

  it('关闭历史后删除失败，重建仍持续提示本机残留历史', () => {
    localStorage.setItem('nomoney_chat_hist', JSON.stringify([{ id: 'old', role: 'user', content: '私密历史', timestamp: 1 }]))
    const chat = createChat()
    expect(chat.updateConfig({ rememberHistory: true })).toBe(true)
    const originalRemove = localStorage.removeItem.bind(localStorage)
    vi.spyOn(localStorage, 'removeItem').mockImplementation((key: string) => {
      if (key === 'nomoney_chat_hist') throw new DOMException('denied', 'SecurityError')
      originalRemove(key)
    })
    expect(chat.updateConfig({ rememberHistory: false })).toBe(false)
    expect(chat.storageWarning.value).toContain('未能完全删除')
    vi.restoreAllMocks()
    scope.stop()
    const restored = createChat()
    expect(restored.config.value.rememberHistory).toBe(false)
    expect(restored.messages.value.some(message => message.content === '私密历史')).toBe(false)
    expect(restored.storageWarning.value, '残留历史必须在重建后继续告警').toContain('可能尚未清除')
  })
})
