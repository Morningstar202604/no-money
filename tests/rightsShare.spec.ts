import { afterEach, describe, it, expect, vi } from 'vitest'
import { RIGHTS_CATALOG } from '../src/data/rights/catalog'
import { buildRightsShareText, shareRightsText } from '../src/utils/rightsShare'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('权益卡分享文案', () => {
  it('包含标题、步骤、去哪办、官方入口和核验日期', () => {
    const item = RIGHTS_CATALOG.find((entry) => entry.id === 'right-unemployment-claim')!
    const text = buildRightsShareText(item)

    expect(text).toContain(item.title)
    expect(text).toContain(item.oneLiner)
    expect(text).toContain('怎么办：')
    expect(text).toContain('1. ')
    expect(text).toContain(`去哪办：${item.whereToGo}`)
    expect(text).toContain(`官方入口：${item.officialUrl}`)
    expect(text).toContain(`核验日期：${item.lastVerified}`)
    expect(text).toContain('来自「没钱 No Money」')
  })

  it('L2 条目带材料、时限和注意项', () => {
    const item = RIGHTS_CATALOG.find((entry) => entry.id === 'right-housing-fund')!
    const text = buildRightsShareText(item)

    expect(text).toContain('材料：')
    expect(text).toContain('时限：')
    expect(text).toContain('注意：')
    expect(text).not.toContain('undefined')
  })

  it('不泄露内部 id，也不把空字段写成 null', () => {
    const item = RIGHTS_CATALOG.find((entry) => entry.id === 'right-unemployment-claim')!
    const text = buildRightsShareText(item)

    expect(text).not.toContain(item.id)
    expect(text).not.toContain('null')
    expect(text.length).toBeGreaterThan(120)
  })
})

describe('分享通道', () => {
  it('支持系统分享时直接走分享，不碰剪贴板', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { share, clipboard: { writeText } })

    await expect(shareRightsText('标题', '正文')).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: '标题', text: '正文' })
    expect(writeText).not.toHaveBeenCalled()
  })

  it('用户取消系统分享时抛 AbortError，不静默改成复制', async () => {
    const abort = new DOMException('用户取消', 'AbortError')
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(abort), clipboard: { writeText: vi.fn() } })

    await expect(shareRightsText('标题', '正文')).rejects.toBe(abort)
  })

  it('系统分享失败时退回剪贴板', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      share: vi.fn().mockRejectedValue(new TypeError('分享不可用')),
      clipboard: { writeText },
    })

    await expect(shareRightsText('标题', '正文')).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith('正文')
  })

  it('两者都不支持时给人话错误，不抛 TypeError', async () => {
    vi.stubGlobal('navigator', {})

    await expect(shareRightsText('标题', '正文')).rejects.toThrow('请手动复制')
  })
})
