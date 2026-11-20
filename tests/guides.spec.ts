import { describe, it, expect } from 'vitest'
import {
  GUIDE_CATEGORY_KEYS,
  GUIDE_SEARCH_PHRASES,
  guideFilters,
  guidesForCategory,
  searchGuides,
} from '../src/data/rights/guides'

const USER_PHRASE_CASES: [string, string][] = [
  ['灵活就业人员怎么交社保', 'guide-how-to-pay'],
  ['社保能退保吗', 'guide-pension-exit'],
  ['公积金怎么交', 'right-housing-fund'],
  ['生育津贴怎么领', 'right-birth-allowance'],
  ['灵活就业社保补贴怎么申请', 'right-flex-subsidy'],
  ['异地看病怎么报销', 'right-medical-cross-city'],
  ['退休怎么办', 'right-retire-process'],
  ['被辞退能领失业金吗', 'right-unemployment-claim'],
  ['上班受伤单位不管怎么办', 'right-injury-report'],
  ['换城市工作社保怎么办', 'right-social-transfer'],
  ['异地急诊没刷卡怎么报', 'right-medical-reimburse'],
  ['公积金贷款怎么申请', 'right-housing-fund-loan'],
  ['考了证能领补贴吗', 'right-vocational-subsidy'],
  ['怀疑职业病怎么检查', 'right-occupational-disease'],
  ['失业登记怎么办', 'right-unemployment-registration'],
  ['产检费用怎么报', 'right-maternity-medical'],
  ['灵活就业登记怎么办', 'right-flex-registration'],
  ['养老金资格认证怎么弄', 'right-pension-certification'],
]

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

describe('怎么弄：用户原话搜索', () => {
  for (const [phrase, expectedId] of USER_PHRASE_CASES) {
    it(`原话“${phrase}”能找到 ${expectedId}`, () => {
      const results = searchGuides(phrase)
      expect(results.length, `“${phrase}”应有结果`).toBeGreaterThan(0)
      expect(results[0]?.id).toBe(expectedId)
    })
  }

  it('每条可办教程都至少有一条用户原话，且没有多余映射', () => {
    const guideIds = new Set(guidesForCategory('all').map((item) => item.id))
    for (const id of guideIds) {
      expect(GUIDE_SEARCH_PHRASES[id]?.length, `${id} 缺用户原话`).toBeGreaterThan(0)
    }
    for (const id of Object.keys(GUIDE_SEARCH_PHRASES)) {
      expect(guideIds.has(id), `${id} 不在可办教程范围`).toBe(true)
    }
  })

  it('空查询返回分类列表，无匹配返回空，分类过滤仍生效', () => {
    const all = guidesForCategory('all')
    expect(searchGuides('')).toEqual(all)
    expect(searchGuides('   ')).toEqual(all)
    expect(searchGuides('这句话肯定搜不到')).toEqual([])
    expect(searchGuides('公积金', 'social')).toEqual([])
    expect(searchGuides('公积金', 'housing').every((item) => item.category === 'housing')).toBe(true)
  })
})
