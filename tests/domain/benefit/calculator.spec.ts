import { describe, it, expect } from 'vitest'
import { Cent, Rate, yuanToCent } from '../../../src/domain/shared/value-objects'
import {
  calcMonthly,
  resolveBase,
  projectRetirement,
  findMedicalTierRate,
} from '../../../src/domain/benefit/calculator'
import { issuanceMonthsForAge } from '../../../src/utils/issuanceMonths'
import type { BenefitRule, ContributionBase } from '../../../src/domain/benefit/rules'

// 测试用广州规则
const gzRule: BenefitRule = {
  pension: {
    baseMin: yuanToCent(5521),
    baseMax: yuanToCent(27603),
    rate: Rate.create(0.2),
  },
  medical: {
    baseMin: yuanToCent(6234),
    baseMax: yuanToCent(31170),
    rate: Rate.create(0.08),
  },
  medicalTiers: [
    { id: 'tier1', name: '一档', rate: Rate.create(0.02), note: '基本档' },
    { id: 'tier2', name: '二档', rate: Rate.create(0.08), note: '标准档' },
  ],
}

const szRule: BenefitRule = {
  pension: {
    baseMin: yuanToCent(5521),
    baseMax: yuanToCent(27603),
    rate: Rate.create(0.2),
  },
  medical: {
    baseMin: yuanToCent(6727),
    baseMax: yuanToCent(33633),
    rate: Rate.create(0.08),
  },
}

describe('resolveBase 缴费基数解析', () => {
  it('用户自选基数优先', () => {
    const base: ContributionBase = { pensionBase: yuanToCent(10000) }
    const result = resolveBase(base.pensionBase, yuanToCent(8000), yuanToCent(5521), yuanToCent(27603))
    expect(Number(result)).toBe(10000 * 100)
  })

  it('未自选时回落到申报收入', () => {
    const result = resolveBase(undefined, yuanToCent(12000), yuanToCent(5521), yuanToCent(27603))
    expect(Number(result)).toBe(12000 * 100)
  })

  it('低于下限时按下限夹取', () => {
    const result = resolveBase(undefined, yuanToCent(3000), yuanToCent(5521), yuanToCent(27603))
    expect(Number(result)).toBe(5521 * 100)
  })

  it('高于上限时按上限夹取', () => {
    const result = resolveBase(undefined, yuanToCent(50000), yuanToCent(5521), yuanToCent(27603))
    expect(Number(result)).toBe(27603 * 100)
  })

  it('自选基数超下限被夹取', () => {
    const base: ContributionBase = { pensionBase: yuanToCent(100) }
    const result = resolveBase(base.pensionBase, yuanToCent(9000), yuanToCent(5521), yuanToCent(27603))
    expect(Number(result)).toBe(5521 * 100)
  })

  it('自选基数超上限被夹取', () => {
    const base: ContributionBase = { pensionBase: yuanToCent(999999) }
    const result = resolveBase(base.pensionBase, yuanToCent(9000), yuanToCent(5521), yuanToCent(27603))
    expect(Number(result)).toBe(27603 * 100)
  })

  it('非法输入（负数、NaN、0）回落到申报收入', () => {
    const r1 = resolveBase(yuanToCent(-100), yuanToCent(12000), yuanToCent(5521), yuanToCent(27603))
    expect(Number(r1)).toBe(12000 * 100)

    const r2 = resolveBase(NaN as unknown as Cent, yuanToCent(12000), yuanToCent(5521), yuanToCent(27603))
    expect(Number(r2)).toBe(12000 * 100)

    const r3 = resolveBase(yuanToCent(0), yuanToCent(12000), yuanToCent(5521), yuanToCent(27603))
    expect(Number(r3)).toBe(12000 * 100)
  })
})

describe('findMedicalTierRate 医保档次费率查找', () => {
  it('找到指定档次返回费率', () => {
    const rate = findMedicalTierRate(gzRule.medicalTiers, 'tier1')
    expect(rate).toBeDefined()
    expect(Number(rate!)).toBe(0.02)
  })

  it('未指定档次返回 undefined', () => {
    const rate = findMedicalTierRate(gzRule.medicalTiers, undefined)
    expect(rate).toBeUndefined()
  })

  it('档次不存在返回 undefined', () => {
    const rate = findMedicalTierRate(gzRule.medicalTiers, 'nonexistent')
    expect(rate).toBeUndefined()
  })

  it('无档次配置返回 undefined', () => {
    const rate = findMedicalTierRate(undefined, 'tier1')
    expect(rate).toBeUndefined()
  })
})

describe('calcMonthly 月度缴费测算', () => {
  it('手算基准：养老=基数×20%，医保=基数×8%', () => {
    const income = yuanToCent(10000)
    const result = calcMonthly(income, true, undefined, {}, gzRule)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const b = result.value
      expect(Number(b.pensionMonthly)).toBeCloseTo(10000 * 100 * 0.2, 0)
      expect(Number(b.medicalMonthly)).toBeCloseTo(10000 * 100 * 0.08, 0)
      expect(Number(b.totalMonthly)).toBeCloseTo(Number(b.pensionMonthly) + Number(b.medicalMonthly), 0)
    }
  })

  it('低收入下限保底：不随收入线性下降', () => {
    const income = yuanToCent(2000)
    const result = calcMonthly(income, true, undefined, {}, gzRule)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const b = result.value
      expect(Number(b.pensionMonthly)).toBeCloseTo(5521 * 100 * 0.2, 0)
      expect(Number(b.medicalMonthly)).toBeCloseTo(6234 * 100 * 0.08, 0)
    }
  })

  it('高收入上限封顶', () => {
    const income = yuanToCent(100000)
    const result = calcMonthly(income, true, undefined, {}, gzRule)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const b = result.value
      expect(Number(b.pensionMonthly)).toBeCloseTo(27603 * 100 * 0.2, 0)
      expect(Number(b.medicalMonthly)).toBeCloseTo(31170 * 100 * 0.08, 0)
    }
  })

  it('未参保时个人支出为 0，但待遇项目标记为缺口', () => {
    const income = yuanToCent(10000)
    const result = calcMonthly(income, false, undefined, {}, gzRule)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const b = result.value
      expect(Number(b.totalMonthly)).toBe(0)
      const uncovered = b.items.filter(i => !i.covered)
      expect(uncovered.length).toBeGreaterThan(0)
    }
  })

  it('职业伤害保障不构成个人支出', () => {
    const income = yuanToCent(10000)
    const result = calcMonthly(income, true, undefined, {}, gzRule)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const b = result.value
      const inj = b.items.find(i => i.name === '职业伤害保障')
      expect(inj?.monthly).toBe(yuanToCent(0))
      expect(inj?.covered).toBe(true)
    }
  })

  it('自选基数覆盖夹取逻辑', () => {
    const income = yuanToCent(30000)
    const base: ContributionBase = {
      pensionBase: yuanToCent(5521),
      medicalBase: yuanToCent(6234),
    }
    const result = calcMonthly(income, true, undefined, base, gzRule)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const b = result.value
      expect(Number(b.pensionMonthly)).toBeCloseTo(5521 * 100 * 0.2, 0)
      expect(Number(b.medicalMonthly)).toBeCloseTo(6234 * 100 * 0.08, 0)
    }
  })

  it('医保档次费率生效', () => {
    const income = yuanToCent(10000)
    const result = calcMonthly(income, true, Rate.create(0.02), {}, gzRule)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const b = result.value
      expect(Number(b.medicalMonthly)).toBeCloseTo(10000 * 100 * 0.02, 0)
    }
  })

  it('跨城基数差异：高收入触发上限差异', () => {
    // 收入 50000，广州医保上限 31170，深圳 33633
    const income = yuanToCent(50000)
    const gzResult = calcMonthly(income, true, undefined, {}, gzRule)
    const szResult = calcMonthly(income, true, undefined, {}, szRule)
    expect(gzResult.ok && szResult.ok).toBe(true)
    if (gzResult.ok && szResult.ok) {
      expect(Number(szResult.value.medicalMonthly)).toBeGreaterThan(Number(gzResult.value.medicalMonthly))
    }
  })
})

describe('projectRetirement 退休测算', () => {
  const benefitBaseMonthly = yuanToCent(9493) // 广东全省口径

  it('基础养老金按国发〔2005〕38号公式', () => {
    const result = projectRetirement(
      25, 60,
      yuanToCent(1200),
      15,
      Rate.create(0.05),
      Rate.create(0.6),
      benefitBaseMonthly
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      const r = result.value
      const expected = 9493 * (1 + 0.6) / 2 * 15 * 0.01
      expect(Number(r.basePension) / 100).toBeCloseTo(expected, 1)
    }
  })

  it('个人账户养老金 = 储存额 / 139', () => {
    const result = projectRetirement(
      25, 60,
      yuanToCent(1200),
      15,
      Rate.create(0.05),
      Rate.create(0.6),
      benefitBaseMonthly
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      const r = result.value
      expect(Number(r.personalPension) / 100).toBeCloseTo(Number(r.personalAccount) / 100 / 139, 2)
    }
  })

  it('缴费指数高于 3.0 时按 3.0 计（法定 300% 封顶）', () => {
    const r1 = projectRetirement(25, 60, yuanToCent(1200), 15, Rate.create(0.05), Rate.create(5), benefitBaseMonthly)
    const r2 = projectRetirement(25, 60, yuanToCent(1200), 15, Rate.create(0.05), Rate.create(3), benefitBaseMonthly)
    expect(r1.ok && r2.ok).toBe(true)
    if (r1.ok && r2.ok) {
      expect(Number(r1.value.basePension)).toBe(Number(r2.value.basePension))
    }
  })

  it('缴费指数低于 0.6 时按 0.6 计（广东规则）', () => {
    const r1 = projectRetirement(25, 60, yuanToCent(1200), 15, Rate.create(0.05), Rate.create(0.3), benefitBaseMonthly)
    const r2 = projectRetirement(25, 60, yuanToCent(1200), 15, Rate.create(0.05), Rate.create(0.6), benefitBaseMonthly)
    expect(r1.ok && r2.ok).toBe(true)
    if (r1.ok && r2.ok) {
      expect(Number(r1.value.basePension)).toBe(Number(r2.value.basePension))
    }
  })

  it('计发基数不同的两城，同输入得出不同基础养老金', () => {
    const szBase = yuanToCent(11293) // 深圳单列
    const gz = projectRetirement(25, 60, yuanToCent(1200), 15, Rate.create(0.05), Rate.create(0.6), benefitBaseMonthly)
    const sz = projectRetirement(25, 60, yuanToCent(1200), 15, Rate.create(0.05), Rate.create(0.6), szBase)
    expect(gz.ok && sz.ok).toBe(true)
    if (gz.ok && sz.ok) {
      expect(Number(sz.value.basePension)).toBeGreaterThan(Number(gz.value.basePension))
    }
  })

  it('投资收益率边界：-100% 到 100% 被截断', () => {
    const rLow = projectRetirement(25, 60, yuanToCent(1200), 15, Rate.create(-2), Rate.create(0.6), benefitBaseMonthly)
    const rHigh = projectRetirement(25, 60, yuanToCent(1200), 15, Rate.create(2), Rate.create(0.6), benefitBaseMonthly)
    const rNormal = projectRetirement(25, 60, yuanToCent(1200), 15, Rate.create(0.05), Rate.create(0.6), benefitBaseMonthly)
    expect(rLow.ok && rHigh.ok && rNormal.ok).toBe(true)
    if (rLow.ok && rHigh.ok && rNormal.ok) {
      expect(Number(rLow.value.personalAccount)).toBeLessThan(Number(rNormal.value.personalAccount))
      expect(Number(rHigh.value.personalAccount)).toBeGreaterThan(Number(rNormal.value.personalAccount))
    }
  })

  it('年龄倒置（退休年龄小于当前年龄）月数为 0', () => {
    const result = projectRetirement(60, 55, yuanToCent(1200), 15, Rate.create(0.05), Rate.create(0.6), benefitBaseMonthly)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.months).toBe(0)
      expect(Number(result.value.personalAccount)).toBe(0)
    }
  })

  it('未参保年限（yearsContributed=0）基础养老金为 0', () => {
    const result = projectRetirement(25, 60, yuanToCent(1200), 0, Rate.create(0.05), Rate.create(0.6), benefitBaseMonthly)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(Number(result.value.basePension)).toBe(0)
    }
  })

  it('缴费年限超过剩余工作年限时，基础养老金按实际可缴年限封顶', () => {
    // 55 岁到 60 岁最多缴 5 年。传 30 年时个账只按 5 年注入（contributionMonths 已封顶），
    // 若基础养老金仍按 30 年算，同一结果里两套年限打架，养老金被系统性高估。
    const over = projectRetirement(55, 60, yuanToCent(1200), 30, Rate.create(0.05), Rate.create(0.6), benefitBaseMonthly)
    const exact = projectRetirement(55, 60, yuanToCent(1200), 5, Rate.create(0.05), Rate.create(0.6), benefitBaseMonthly)
    expect(over.ok && exact.ok).toBe(true)
    if (over.ok && exact.ok) {
      expect(Number(over.value.basePension)).toBe(Number(exact.value.basePension))
      expect(Number(over.value.personalAccount)).toBe(Number(exact.value.personalAccount))
      expect(Number(over.value.totalPension)).toBe(Number(exact.value.totalPension))
    }
  })

  it('缴费年限封顶不减损未超额的情形（缴满至退休仍按实际年限）', () => {
    const r = projectRetirement(25, 60, yuanToCent(1200), 15, Rate.create(0.05), Rate.create(0.6), benefitBaseMonthly)
    expect(r.ok).toBe(true)
    if (r.ok) {
      const expected = 9493 * (1 + 0.6) / 2 * 15 * 0.01
      expect(Number(r.value.basePension) / 100).toBeCloseTo(expected, 1)
    }
  })

  it('非法输入被安全处理', () => {
    // NaN 年龄 -> 0，退休年龄 60 -> months = 720（当前行为：NaN 当作 0 处理）
    const r1 = projectRetirement(NaN, 60, yuanToCent(1200), 15, Rate.create(0.05), Rate.create(0.6), benefitBaseMonthly)
    // 退休年龄 NaN -> 当前年龄，月数 0
    const r2 = projectRetirement(25, NaN, yuanToCent(1200), 15, Rate.create(0.05), Rate.create(0.6), benefitBaseMonthly)
    // 负缴费额 -> 0
    const r3 = projectRetirement(25, 60, yuanToCent(-100), 15, Rate.create(0.05), Rate.create(0.6), benefitBaseMonthly)
    expect(r1.ok && r2.ok && r3.ok).toBe(true)
    if (r1.ok && r2.ok && r3.ok) {
      expect(r1.value.months).toBe(720) // NaN currentAge -> 0，retireAge 60 -> 720 months
      expect(r2.value.months).toBe(0)   // NaN retireAge -> currentAge -> 0 months
      expect(Number(r3.value.personalAccount)).toBe(0)
    }
  })
})

describe('计发月数按退休年龄查表（国发〔2005〕38号附表）', () => {
  it('60 岁为 139，50/55/65 岁分别取法定附表值', () => {
    expect(issuanceMonthsForAge(60)).toBe(139)
    expect(issuanceMonthsForAge(50)).toBe(195)
    expect(issuanceMonthsForAge(55)).toBe(170)
    expect(issuanceMonthsForAge(65)).toBe(101)
  })

  it('55 岁退休不使用 60 岁的 139：个账养老金必须更小', () => {
    const at60 = projectRetirement(25, 60, yuanToCent(1200), 35, Rate.create(0.05), Rate.create(0.6), yuanToCent(9493))
    const at55 = projectRetirement(25, 55, yuanToCent(1200), 30, Rate.create(0.05), Rate.create(0.6), yuanToCent(9493))
    expect(at55.ok && at60.ok).toBe(true)
    if (at55.ok && at60.ok) {
      // 55 岁计发月数 170 > 139，同等账户余额下个人账户养老金更低
      expect(Number(at55.value.personalPension)).toBeLessThan(Number(at60.value.personalPension))
    }
  })

  it('非法/缺失年龄回落 60 岁口径 139，不产生 NaN', () => {
    expect(issuanceMonthsForAge(NaN)).toBe(139)
    expect(issuanceMonthsForAge(0)).toBe(139)
  })
})

describe('缴满即停缴：账户只按缴费年限注入，之后仅复利', () => {
  it('缴 15 年停缴的账户余额，必须小于缴至退休（同月缴额）', () => {
    const full = projectRetirement(25, 60, yuanToCent(442), 35, Rate.create(0.03), Rate.create(0.6), yuanToCent(9493))
    const stop15 = projectRetirement(25, 60, yuanToCent(442), 15, Rate.create(0.03), Rate.create(0.6), yuanToCent(9493))
    expect(full.ok && stop15.ok).toBe(true)
    if (full.ok && stop15.ok) {
      expect(Number(stop15.value.personalAccount)).toBeLessThan(Number(full.value.personalAccount))
      // 缴 15 年账户仍应大于「15×12×月缴×0.6」量级（未复利下界），确认停缴后仍在复利
      const noInterestFloor = 15 * 12 * 442 * 0.6
      expect(Number(stop15.value.personalAccount) / 100).toBeGreaterThan(noInterestFloor)
    }
  })

  it('缴费年限超过到退休月数时按到退休的月数封顶，不会超缴', () => {
    const clipped = projectRetirement(55, 60, yuanToCent(442), 30, Rate.create(0.03), Rate.create(0.6), yuanToCent(9493))
    const exact = projectRetirement(55, 60, yuanToCent(442), 5, Rate.create(0.03), Rate.create(0.6), yuanToCent(9493))
    expect(clipped.ok && exact.ok).toBe(true)
    if (clipped.ok && exact.ok) {
      expect(Number(clipped.value.personalAccount)).toBe(Number(exact.value.personalAccount))
    }
  })
})
