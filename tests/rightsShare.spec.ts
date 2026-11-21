import { afterEach, describe, it, expect, vi } from 'vitest'
import { RIGHTS_CATALOG } from '../src/data/rights/catalog'
import { buildChecklistShareText } from '../src/utils/checklistExport'
import { buildRightsShareText, shareErrorMessage, shareRightsText } from '../src/utils/rightsShare'

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

  it('取消信号不依赖 DOMException 构造函数，按 name 识别', async () => {
    const abort = Object.assign(new Error('用户取消'), { name: 'AbortError' })
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


describe('整张清单分享文案', () => {
  const items = [
    RIGHTS_CATALOG.find((entry) => entry.id === 'right-unemployment-claim')!,
    RIGHTS_CATALOG.find((entry) => entry.id === 'right-housing-fund')!,
    RIGHTS_CATALOG.find((entry) => entry.id === 'right-injury-report')!,
  ]

  it('按顺序列出清单，带待办/已办、第一步、时限、去哪办、入口和核验日期', () => {
    const text = buildChecklistShareText(items, {
      title: '被辞退后要办的事',
      date: '2026-11-21',
      done: (id) => id === 'right-unemployment-claim',
    })

    expect(text).toContain('没钱 No Money · 被辞退后要办的事')
    expect(text).toContain('整理日期：2026-11-21｜共 3 件，已办 1 件')
    expect(text).toContain('1. [已办] ')
    expect(text).toContain('2. [待办] ')
    expect(text.indexOf(items[0].title)).toBeLessThan(text.indexOf(items[1].title))
    expect(text).toContain('第一步：')
    expect(text).toContain('去哪办：')
    expect(text).toContain('官方入口：')
    expect(text).toContain(`核验：${items[1].lastVerified}`)
    expect(text).toContain('来自「没钱 No Money」')
  })

  it('超过 8 件时截断并说明还剩多少件', () => {
    const text = buildChecklistShareText(RIGHTS_CATALOG.slice(0, 10), { date: '2026-11-21' })
    const itemLines = text.split('\n').filter((line) => /^\d+\. \[/.test(line))

    expect(itemLines).toHaveLength(8)
    expect(text).toContain('还有 2 件没放进这条消息')
  })

  it('空清单给出下一步，不输出 null/undefined', () => {
    const text = buildChecklistShareText([], { date: '2026-11-21' })

    expect(text).toContain('清单还是空的')
    expect(text).not.toContain('null')
    expect(text).not.toContain('undefined')
  })

  it('不泄露内部 id', () => {
    const text = buildChecklistShareText(items, { date: '2026-11-21' })

    items.forEach((item) => expect(text).not.toContain(item.id))
  })
})

describe('分享错误文案', () => {
  it('用户取消返回 null，不冒充成功', () => {
    expect(shareErrorMessage(new DOMException('取消', 'AbortError'))).toBeNull()
  })

  it('没有 DOMException 的取消信号也返回 null', () => {
    expect(shareErrorMessage(Object.assign(new Error('取消'), { name: 'AbortError' }))).toBeNull()
  })

  it('不支持时保留可操作的中文说明，其它失败给通用提示', () => {
    expect(shareErrorMessage(new Error('当前浏览器不支持系统分享或复制，请手动复制'))).toContain('请手动复制')
    expect(shareErrorMessage(new Error('Failed to execute writeText'))).toBe('分享失败，请手动复制')
  })
})
