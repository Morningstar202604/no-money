// 命令面板模糊匹配的纯逻辑测试。
// 面板本身在浏览器里由 e2e 覆盖，这里只验证「排序对不对」——
// 排序错了会让用户按回车跳到错误页面，比面板打不开更危险。
import { describe, it, expect } from 'vitest'
import { scoreCommand, rankCommands, groupCommands, type Command } from '../src/utils/commandPalette'

const cmd = (label: string, extra: Partial<Command> = {}): Command => ({
  id: label,
  label,
  kind: 'navigate',
  group: '页面',
  run: () => {},
  ...extra,
})

describe('命令模糊匹配', () => {
  it('空查询返回全部命令且不打分', () => {
    const items = rankCommands('', [cmd('总览'), cmd('政策百科')])
    expect(items).toHaveLength(2)
    expect(items.every((i) => i.score === 0)).toBe(true)
  })

  it('前缀命中排在中间命中之前', () => {
    const commands = [cmd('前往权益护航'), cmd('总览')]
    const ranked = rankCommands('总', commands)
    expect(ranked[0].command.label).toBe('总览')
  })

  it('连续命中比散落命中得分高', () => {
    const continuous = scoreCommand('政策', cmd('政策百科'))
    const scattered = scoreCommand('政策', cmd('政x策百科'))
    expect(continuous!.score).toBeGreaterThan(scattered!.score)
  })

  it('完全不匹配的命令被过滤掉', () => {
    const ranked = rankCommands('zzz', [cmd('总览'), cmd('政策百科')])
    expect(ranked).toHaveLength(0)
  })

  it('关键词也能命中，并高亮关键词位置', () => {
    const c = cmd('税务与养老', { keywords: ['tax', '养老金'] })
    const result = scoreCommand('tax', c)
    expect(result).not.toBeNull()
    expect(result!.score).toBeGreaterThan(0)
  })

  it('返回的 matches 能定位到命中字符，供高亮使用', () => {
    const result = scoreCommand('广', cmd('广州'))
    expect(result!.matches).toEqual([0])
  })

  it('分数相同时保持注册顺序，避免输入时列表跳动', () => {
    const commands = [cmd('甲页面'), cmd('乙页面')]
    const ranked = rankCommands('页面', commands)
    expect(ranked.map((r) => r.command.label)).toEqual(['甲页面', '乙页面'])
  })
})

describe('分组', () => {
  it('按 group 归并并保持首次出现顺序', () => {
    const commands = [
      cmd('总览', { group: '页面' }),
      cmd('广州', { group: '城市' }),
      cmd('方案对比', { group: '页面' }),
    ]
    const grouped = groupCommands(rankCommands('', commands))
    expect(grouped.map((g) => g.group)).toEqual(['页面', '城市'])
    expect(grouped[0].items).toHaveLength(2)
  })

  it('空结果不产生空分组', () => {
    expect(groupCommands([])).toEqual([])
  })
})
