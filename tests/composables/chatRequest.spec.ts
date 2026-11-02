// @vitest-environment happy-dom

import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAIChat } from '../../src/composables/useAIChat'

describe('在线对话请求', () => {
  const scope = effectScope()

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    scope.stop()
    vi.restoreAllMocks()
  })

  it('只发送一次当前问题，保留历史中内容相同的问题和回复', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"回答"}}]}\n\ndata: [DONE]\n\n'))
        controller.close()
      },
    })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200 }))
    const chat = scope.run(() => useAIChat())!
    expect(chat.updateConfig({ enabled: true, apiKey: 'test-key', endpoint: 'https://example.com/v1/chat/completions' })).toBe(true)
    chat.isOnline.value = true
    chat.messages.value.push(
      { id: 'previous-user', role: 'user', content: '相同问题', timestamp: 1 },
      { id: 'previous-assistant', role: 'assistant', content: '历史回答', timestamp: 2 },
    )

    await chat.sendMessage('相同问题', [])

    expect(fetchMock).toHaveBeenCalledOnce()
    const init = fetchMock.mock.calls[0][1]!
    const body = JSON.parse(init.body as string) as { messages: Array<{ role: string; content: string }> }
    expect(body.messages.filter(message => message.role === 'user' && message.content === '相同问题')).toHaveLength(2)
    expect(body.messages.slice(-3)).toEqual([
      { role: 'user', content: '相同问题' },
      { role: 'assistant', content: '历史回答' },
      { role: 'user', content: '相同问题' },
    ])
    expect(chat.messages.value.at(-1)?.content).toBe('回答')
  })
})
