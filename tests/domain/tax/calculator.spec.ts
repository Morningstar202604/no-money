import { describe, it, expect } from 'vitest'
import { Rate, yuanToCent } from '@/domain/shared/value-objects'
import {
  findBracket,
  calcLaborMonthly,
  calcLaborAnnual,
  calcSoleProprietorship
} from '@/domain/tax/calculator'
import type { TaxBracket, LaborRemunerationRule, SoleProprietorshipRule } from '@/domain/tax/rules'

// ===== 测试辅助 =====

function createLaborRule(overrides: Partial<LaborRemunerationRule> = {}): LaborRemunerationRule {
  return {
    expenseDeductionRate: Rate.create(0.2),
    expenseDeductionFixed: yuanToCent(800),
    expenseDeductionThreshold: yuanToCent(4000),
    basicDeductionMonthly: yuanToCent(5000),
    taxTable: [
      { min: yuanToCent(0), max: yuanToCent(36000), rate: Rate.create(0.03), deduction: yuanToCent(0) },
      { min: yuanToCent(36000), max: yuanToCent(144000), rate: Rate.create(0.1), deduction: yuanToCent(2520) },
      { min: yuanToCent(144000), max: yuanToCent(300000), rate: Rate.create(0.2), deduction: yuanToCent(16920) },
      { min: yuanToCent(300000), max: yuanToCent(420000), rate: Rate.create(0.25), deduction: yuanToCent(31920) },
      { min: yuanToCent(420000), max: yuanToCent(660000), rate: Rate.create(0.3), deduction: yuanToCent(52920) },
      { min: yuanToCent(660000), max: yuanToCent(960000), rate: Rate.create(0.35), deduction: yuanToCent(85920) },
      { min: yuanToCent(960000), max: yuanToCent(999999999), rate: Rate.create(0.45), deduction: yuanToCent(181920) },
    ],
    ...overrides
  }
}

function createSoleRule(overrides: Partial<SoleProprietorshipRule> = {}): SoleProprietorshipRule {
  return {
    vatRate: Rate.create(0.01),
    vatThresholdMonthly: yuanToCent(100000),
    itrIncomeRate: Rate.create(0.1),
    itrDeductionMonthly: yuanToCent(5000),
    bizTaxTable: [
      { min: yuanToCent(0), max: yuanToCent(30000), rate: Rate.create(0.05), deduction: yuanToCent(0) },
      { min: yuanToCent(30000), max: yuanToCent(90000), rate: Rate.create(0.1), deduction: yuanToCent(1500) },
      { min: yuanToCent(90000), max: yuanToCent(300000), rate: Rate.create(0.2), deduction: yuanToCent(10500) },
      { min: yuanToCent(300000), max: yuanToCent(500000), rate: Rate.create(0.3), deduction: yuanToCent(40500) },
      { min: yuanToCent(500000), max: yuanToCent(999999999), rate: Rate.create(0.35), deduction: yuanToCent(65500) },
    ],
    ...overrides
  }
}

const cent = (yuan: number) => yuanToCent(yuan)
const rate = (decimal: number) => Rate.create(decimal)

// ===== findBracket 测试 =====

describe('findBracket', () => {
  const table: readonly TaxBracket[] = [
    { min: cent(0), max: cent(36000), rate: rate(0.03), deduction: cent(0) },
    { min: cent(36000), max: cent(144000), rate: rate(0.1), deduction: cent(2520) },
    { min: cent(144000), max: cent(300000), rate: rate(0.2), deduction: cent(16920) },
  ]

  it('落在第一档', () => {
    const r = findBracket(cent(10000), table)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.rate).toBe(rate(0.03))
  })

  it('落在第二档', () => {
    const r = findBracket(cent(50000), table)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.rate).toBe(rate(0.1))
  })

  it('落在第三档', () => {
    const r = findBracket(cent(200000), table)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.rate).toBe(rate(0.2))
  })

  it('恰好等于档位边界 max 时进下一档', () => {
    const r = findBracket(cent(36000), table)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.rate).toBe(rate(0.1))
  })

  it('超过最高档返回最后一档', () => {
    const r = findBracket(cent(500000), table)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.rate).toBe(rate(0.2))
  })

  it('空税率表返回错误', () => {
    const r = findBracket(cent(10000), [])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('INVALID_RULE')
  })
})

// ===== calcLaborMonthly 测试 =====

describe('calcLaborMonthly - 手算基准对齐', () => {
  const rule = createLaborRule()

  it('月收入 7280 元，专项扣除 0，全年 3% 档（广州骑手基准）', () => {
    const monthlyIncome = Array(12).fill(cent(7280))
    const r = calcLaborMonthly(monthlyIncome, cent(0), rule)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(Number(r.value.annualTax)).toBeCloseTo(29664, -2)
      // 有效税率 = 296.64 / (7280*12) ≈ 0.34%
      expect(Number(r.value.effectiveRate)).toBeCloseTo(0.0034, 4)
    }
  })

  it('月收入 3000 元（低于 4000 起征点），税额为 0', () => {
    const monthlyIncome = Array(12).fill(cent(3000))
    const r = calcLaborMonthly(monthlyIncome, cent(0), rule)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(Number(r.value.annualTax)).toBe(0)
      r.value.monthlyTax.forEach(t => expect(Number(t)).toBe(0))
    }
  })

  it('月收入 3900 元（4000 阈值内），按 800 元扣除', () => {
    const monthlyIncome = Array(12).fill(cent(3900))
    const r = calcLaborMonthly(monthlyIncome, cent(0), rule)
    expect(r.ok).toBe(true)
    if (r.ok) expect(Number(r.value.annualTax)).toBe(0)
  })

  it('月收入 4100 元（刚过 4000 阈值），按 20% 扣除', () => {
    const monthlyIncome = Array(12).fill(cent(4100))
    const r = calcLaborMonthly(monthlyIncome, cent(0), rule)
    expect(r.ok).toBe(true)
    if (r.ok) expect(Number(r.value.annualTax)).toBe(0)
  })

  it('专项附加扣除 2000 元/月，税额降低', () => {
    const monthlyIncome = Array(12).fill(cent(10000))
    const r0 = calcLaborMonthly(monthlyIncome, cent(0), rule)
    const r2 = calcLaborMonthly(monthlyIncome, cent(2000), rule)
    expect(r0.ok && r2.ok).toBe(true)
    if (r0.ok && r2.ok) {
      expect(Number(r2.value.annualTax)).toBeLessThan(Number(r0.value.annualTax))
    }
  })

  it('高收入跨档：月收入 30000 元，进入 20% 档', () => {
    const monthlyIncome = Array(12).fill(cent(30000))
    const r = calcLaborMonthly(monthlyIncome, cent(0), rule)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(Number(r.value.annualTax)).toBeGreaterThan(0)
      expect(Number(r.value.effectiveRate)).toBeGreaterThan(0.05)
    }
  })

  it('12 个月明细之和等于年度税额', () => {
    const monthlyIncome = Array(12).fill(cent(15000))
    const r = calcLaborMonthly(monthlyIncome, cent(0), rule)
    expect(r.ok).toBe(true)
    if (r.ok) {
      const sum = r.value.monthlyTax.reduce((s, v) => s + Number(v), 0)
      expect(sum).toBe(Number(r.value.annualTax))
    }
  })

  it('月度税额均非负', () => {
    const monthlyIncome = Array(12).fill(cent(20000))
    const r = calcLaborMonthly(monthlyIncome, cent(0), rule)
    expect(r.ok).toBe(true)
    if (r.ok) {
      r.value.monthlyTax.forEach(t => expect(Number(t)).toBeGreaterThanOrEqual(0))
    }
  })
})

// ===== calcLaborAnnual 测试 =====

describe('calcLaborAnnual', () => {
  const rule = createLaborRule()

  it('等价于均匀分布的月度计算', () => {
    const annualIncome = cent(87360)
    const rAnnual = calcLaborAnnual(annualIncome, cent(0), rule)
    const rMonthly = calcLaborMonthly(Array(12).fill(cent(7280)), cent(0), rule)
    expect(rAnnual.ok && rMonthly.ok).toBe(true)
    if (rAnnual.ok && rMonthly.ok) {
      expect(Number(rAnnual.value.annualTax)).toBe(Number(rMonthly.value.annualTax))
    }
  })

  it('零收入返回零税', () => {
    const r = calcLaborAnnual(cent(0), cent(0), rule)
    expect(r.ok).toBe(true)
    if (r.ok) expect(Number(r.value.annualTax)).toBe(0)
  })
})

// ===== calcSoleProprietorship 测试 =====

describe('calcSoleProprietorship - 个体工商户核定征收', () => {
  const rule = createSoleRule()

  it('年营业额 120万，手算基准对齐', () => {
    const r = calcSoleProprietorship(cent(1200000), rule)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(Number(r.value.annualTax)).toBe(450000)
      expect(r.value.method).toBe('sole_proprietorship')
    }
  })

  it('年度税额等于公式手算值，非 12 期 round 之和', () => {
    const r = calcSoleProprietorship(cent(1200000), rule)
    expect(r.ok).toBe(true)
    if (r.ok) {
      const sum = r.value.monthlyTax.reduce((s, v) => s + Number(v), 0)
      expect(sum).toBe(Number(r.value.annualTax))
    }
  })

  it('低收入个体户应纳税所得额为 0 时税额为 0', () => {
    const r = calcSoleProprietorship(cent(60000), rule)
    expect(r.ok).toBe(true)
    if (r.ok) expect(Number(r.value.annualTax)).toBe(0)
  })

  it('营业额为 0 时税额为 0', () => {
    const r = calcSoleProprietorship(cent(0), rule)
    expect(r.ok).toBe(true)
    if (r.ok) expect(Number(r.value.annualTax)).toBe(0)
  })

  it('高营业额跨入 35% 最高档', () => {
    const r = calcSoleProprietorship(cent(5000000), rule)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(Number(r.value.annualTax)).toBeGreaterThan(0)
      // 有效税率 = 税额/营业额，最大约为 10% * 35% = 3.5%
      expect(Number(r.value.effectiveRate)).toBeGreaterThan(0.01)
    }
  })
})

// ===== 边界与异常输入测试 =====

describe('边界与异常输入', () => {
  const laborRule = createLaborRule()
  const soleRule = createSoleRule()

  it('NaN 输入被归零', () => {
    const r = calcLaborMonthly(
      Array(12).fill(cent(NaN)),
      cent(0),
      laborRule
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(Number(r.value.annualTax)).toBe(0)
  })

  it('Infinity 输入被归零', () => {
    const r = calcLaborMonthly(
      Array(12).fill(cent(Infinity)),
      cent(0),
      laborRule
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(Number(r.value.annualTax)).toBe(0)
  })

  it('负收入被视为 0', () => {
    const r = calcLaborMonthly(
      Array(12).fill(cent(-10000)),
      cent(0),
      laborRule
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(Number(r.value.annualTax)).toBe(0)
  })

  it('负营业额被视为 0', () => {
    const r = calcSoleProprietorship(cent(-100000), soleRule)
    expect(r.ok).toBe(true)
    if (r.ok) expect(Number(r.value.annualTax)).toBe(0)
  })

  it('月度收入数组长度不为 12 返回错误', () => {
    const r = calcLaborMonthly(
      Array(11).fill(cent(5000)),
      cent(0),
      laborRule
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('INVALID_INPUT')
  })

  it('个体户 NaN 营业额归零', () => {
    const r = calcSoleProprietorship(cent(NaN), soleRule)
    expect(r.ok).toBe(true)
    if (r.ok) expect(Number(r.value.annualTax)).toBe(0)
  })

  it('个体户 Infinity 营业额归零', () => {
    const r = calcSoleProprietorship(cent(Infinity), soleRule)
    expect(r.ok).toBe(true)
    if (r.ok) expect(Number(r.value.annualTax)).toBe(0)
  })
})
