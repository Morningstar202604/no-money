import { describe, it, expect } from 'vitest'
import { GUIDE_CATEGORY_KEYS, guideFilters, guidesForCategory } from '../src/data/rights/guides'

describe('怎么弄：L2 教程筛选', () => {
  it('只收 8 类范围内的 L2，且按 priority 稳定排序', () => {
    const all = guidesForCategory('all')
    expect(all.length).toBeGreaterThan(0)
    for (const item of all) {
      expect(item.level).toBe('L2')
      expect(GUIDE_CATEGORY_KEYS).toContain(item.category)
    }
    const priorities = all.map((item) => item.priority)
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b))
  })

  it('每个分类只返回本分类条目', () => {
    for (const category of GUIDE_CATEGORY_KEYS) {
      const items = guidesForCategory(category)
      expect(items.length, `${category} 应至少有一条 L2`).toBeGreaterThan(0)
      expect(items.every((item) => item.category === category)).toBe(true)
    }
  })

  it('筛选项只展示真实有内容的分类，计数与列表一致', () => {
    const filters = guideFilters()
    expect(filters[0]).toMatchObject({ key: 'all', label: '全部' })
    const all = guidesForCategory('all')
    expect(filters[0].count).toBe(all.length)
    for (const filter of filters.slice(1)) {
      expect(filter.count, `${filter.label} 计数`).toBe(guidesForCategory(filter.key).length)
      expect(filter.count).toBeGreaterThan(0)
    }
    const sum = filters.slice(1).reduce((total, filter) => total + filter.count, 0)
    expect(sum).toBe(all.length)
  })
})
