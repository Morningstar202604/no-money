import { describe, expect, it } from 'vitest'
import { GUIDE_ITEMS } from '../src/utils/livingGuide'
import {
  RIGHTS_CATALOG,
  getProvinceChannel,
  getRightsForSituation,
  rightsForEntry,
} from '../src/data/rights/catalog'

const NEW_IDS = [
  'right-housing-fund',
  'right-birth-allowance',
  'right-heat-allowance',
  'right-flex-subsidy',
  'right-medical-cross-city',
  'right-retire-process',
  'right-unemployment-claim',
  'right-injury-report',
  'right-wage-arrears',
  'right-social-transfer',
  'right-medical-reimburse',
  'right-housing-fund-loan',
  'right-vocational-subsidy',
  'right-contract-renewal',
  'right-occupational-disease',
  'right-unemployment-registration',
  'right-maternity-medical',
  'right-tax-annual',
  'right-flex-registration',
  'right-pension-certification',
]

const L2_TARGET = 30

const L1_IDS = [
  'right-written-contract',
  'right-overtime-pay',
  'right-probation',
  'right-resignation',
  'right-sick-leave',
  'right-maternity-leave',
  'right-social-record',
  'right-medical-balance',
  'right-labor-inspection',
  'right-arbitration',
  'right-legal-aid',
  'right-work-hours',
  'right-social-card',
  'right-public-employment',
  'right-new-grad',
  'right-social-supplement',
  'right-survivor-benefits',
]

describe('权益内容层', () => {
  it('23 条民生手册全部迁移，原有 guideId 不丢', () => {
    const migrated = RIGHTS_CATALOG.filter((i) => i.guideId)
    expect(migrated).toHaveLength(GUIDE_ITEMS.length)
    expect(new Set(migrated.map((i) => i.guideId))).toEqual(new Set(GUIDE_ITEMS.map((i) => i.id)))
  })

  it('目录至少 60 条，补位条目全部是 L1', () => {
    expect(RIGHTS_CATALOG.length).toBeGreaterThanOrEqual(60)
    for (const id of L1_IDS) {
      const item = RIGHTS_CATALOG.find((i) => i.id === id)
      expect(item, id).toBeTruthy()
      expect(item?.level, id).toBe('L1')
    }
  })

  it('新增条目覆盖 P0 的高频场景', () => {
    const ids = new Set(RIGHTS_CATALOG.map((i) => i.id))
    for (const id of NEW_IDS) expect(ids.has(id), id).toBe(true)
  })

  it('每条都有结论、去哪办、核验时间；official 必须有官方入口', () => {
    for (const item of RIGHTS_CATALOG) {
      expect(item.title.length, item.id).toBeGreaterThan(0)
      expect(item.oneLiner.length, item.id).toBeGreaterThan(0)
      expect(item.whereToGo.length, item.id).toBeGreaterThan(0)
      expect(item.lastVerified, item.id).toMatch(/^\d{4}-\d{2}(-\d{2})?$/)
      expect(item.whatToDo.length, item.id).toBeGreaterThan(0)
      if (item.confidence === 'official') {
        expect(item.officialUrl, `${item.id} 标 official 但没有官方链接`).toMatch(/^https?:\/\//)
      }
    }
  })

  it('新增的“能拿多少”只写政策框架，不写具体金额', () => {
    for (const item of RIGHTS_CATALOG.filter((i) => NEW_IDS.includes(i.id) || L1_IDS.includes(i.id))) {
      for (const line of item.whatToGet) {
        expect(line, `${item.id} 不应出现具体金额`).not.toMatch(/[¥￥]\s?\d/)
        expect(line, `${item.id} 不应出现“每月补 X 元”式数字`).not.toMatch(/\d+\s*元/)
      }
    }
  })

  it('30 条标为 L2：有步骤、材料、时限、官方入口和依据', () => {
    const l2 = RIGHTS_CATALOG.filter((i) => i.level === 'L2')
    expect(l2).toHaveLength(L2_TARGET)
    expect(new Set(NEW_IDS).size).toBe(20)
    for (const id of NEW_IDS) expect(l2.map((i) => i.id), id).toContain(id)
    for (const item of l2) {
      expect(item.whatToDo.length, item.id).toBeGreaterThanOrEqual(3)
      expect(item.materials?.length, item.id).toBeGreaterThan(0)
      expect(item.deadline, item.id).toBeTruthy()
      expect(item.officialUrl, item.id).toMatch(/^https?:\/\//)
      expect(item.sourceTitle, item.id).toBeTruthy()
    }
  })

  it('23 条手册中 10 条有步骤的条目升级为 L2，其余仍 L1', () => {
    const guideL2 = RIGHTS_CATALOG.filter((i) => i.guideId && i.level === 'L2')
    expect(guideL2).toHaveLength(10)
    expect(guideL2.map((i) => i.guideId)).toContain('rookie-first-day')
    expect(guideL2.map((i) => i.guideId)).toContain('how-to-pay')
  })

  it('其余条目明确标 L1，不冒充“拿来就能办”', () => {
    const l1 = RIGHTS_CATALOG.filter((i) => i.level === 'L1')
    expect(l1.length).toBe(RIGHTS_CATALOG.length - L2_TARGET)
    expect(l1.length).toBeGreaterThan(0)
  })

  it('向导按身份/情境返回 3–7 条，且不越出身份范围', () => {
    for (const situation of ['first-job', 'benefits', 'social', 'medical', 'housing', 'birth', 'injury', 'unemployment', 'retire', 'trouble', 'all'] as const) {
      const items = getRightsForSituation('guangzhou', 'new-grad', situation)
      expect(items.length, situation).toBeGreaterThanOrEqual(3)
      expect(items.length, situation).toBeLessThanOrEqual(7)
      for (const item of items) {
        expect(item.audience.includes('all') || item.audience.includes('new'), `${situation}/${item.id}`).toBe(true)
      }
    }
  })

  it('“我能拿什么”不混入纯办事条目', () => {
    const items = getRightsForSituation('guangzhou', 'flex', 'benefits')
    expect(items.length).toBeGreaterThanOrEqual(3)
    expect(items.every((i) => i.intent !== 'do')).toBe(true)
  })

  it('四个入口各自有内容，维权入口包含欠薪条目', () => {
    expect(rightsForEntry('tasks').length).toBeGreaterThan(0)
    expect(rightsForEntry('benefits').length).toBeGreaterThan(0)
    expect(rightsForEntry('social').length).toBeGreaterThan(0)
    expect(rightsForEntry('trouble').map((i) => i.id)).toContain('right-wage-arrears')
  })

  it('城市能映射到省级官方入口，未知城市不硬编', () => {
    expect(getProvinceChannel('guangzhou')?.province).toBe('广东')
    expect(getProvinceChannel('beijing')?.province).toBe('北京')
    expect(getProvinceChannel('unknown-city')).toBeUndefined()
  })
})
