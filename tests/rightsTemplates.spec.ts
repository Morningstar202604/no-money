/**
 * 七类办事模板的机器校验：
 * - 每个模板引用的条目都必须真实存在；
 * - 每个模板给 3–7 条，顺序就是第一条先办；
 * - 不允许重复条目；
 * - 每条都要有「去哪办」，不能给用户一张空清单。
 */
import { describe, expect, it } from 'vitest'
import { RIGHTS_TEMPLATES, getRightsForTemplate, missingTemplateItemIds } from '../src/data/rights/templates'

describe('七类办事模板', () => {
  it('恰好覆盖 7 个高频场景，key 不重复', () => {
    expect(RIGHTS_TEMPLATES).toHaveLength(7)
    expect(new Set(RIGHTS_TEMPLATES.map((t) => t.key)).size).toBe(7)
    expect(RIGHTS_TEMPLATES.map((t) => t.label)).toEqual([
      expect.stringContaining('入职 7 天'),
      expect.stringContaining('离职交接'),
      expect.stringContaining('工伤'),
      expect.stringContaining('失业金'),
      expect.stringContaining('生育'),
      expect.stringContaining('退休'),
      expect.stringContaining('取证'),
    ])
  })

  it.each(RIGHTS_TEMPLATES.map((t) => [t.key, t] as const))('%s 的条目都存在且为 3–7 条', (_key, template) => {
    expect(missingTemplateItemIds(template)).toEqual([])
    const items = getRightsForTemplate(template)
    expect(items.length).toBeGreaterThanOrEqual(3)
    expect(items.length).toBeLessThanOrEqual(7)
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length)
    expect(items.every((item) => item.whereToGo.trim().length > 0)).toBe(true)
    expect(items[0].id).toBe(template.itemIds[0])
  })

  it('每张模板的第一条都能回答“现在先做什么”', () => {
    for (const template of RIGHTS_TEMPLATES) {
      const first = getRightsForTemplate(template)[0]
      expect(first.whatToDo.length, `${template.name} 第一条没有动作`).toBeGreaterThan(0)
      expect(first.oneLiner, `${template.name} 第一条没有一句话结论`).toBeTruthy()
    }
  })

  it('模板顺序不依赖目录 priority，显式 itemIds 决定先办哪件', () => {
    const resign = RIGHTS_TEMPLATES.find((t) => t.key === 'resign-handover')!
    const items = getRightsForTemplate(resign)
    expect(items[0].title).toContain('辞职')
    expect(items[1].title).toContain('年假')
  })
})
