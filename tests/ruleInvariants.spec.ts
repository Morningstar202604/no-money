/**
 * 规则文件与领域边界的不可回退约束。
 *
 * 0.0.43 删除旧 `src/engine` 后，旧 engines.spec 里真正与「实现」无关、
 * 只锁数据诚实度与外部输入校验的断言迁移到这里；公式本身由
 * tests/domain/** 与 tests/application/** 覆盖。
 */

import { describe, it, expect } from 'vitest'
import { loadRuleFile } from './helpers/rules'
import { validateEndpoint } from '../src/utils/endpoint'
import { calcLaborMonthly } from '../src/domain/tax/calculator'
import { adaptLaborRule, adaptRetirementRule } from '../src/application/adapters/ruleAdapters'
import { projectRetirement } from '../src/domain/benefit/calculator'
import { Cent, Rate, centToYuan } from '../src/domain/shared/value-objects'

const OFFICIAL_PARAMS: Record<string, {
  pensionBaseMin: number
  pensionBaseMax: number
  medicalBaseMin: number
  medicalBaseMax: number
  medicalRate: number
  sourceKey: string
}> = {
  // 粤人社发〔2026〕24号：2026-01-01 起下限 5510；2026-07-01 起下限调整为 5521、上限 27603
  guangzhou: { pensionBaseMin: 5521, pensionBaseMax: 27603, medicalBaseMin: 6234, medicalBaseMax: 31170, medicalRate: 0.08, sourceKey: 'medical' },
  // 深圳市医疗保障局 2025-12-29 公告：下限 6727、上限 33633；灵活就业人员费率 2026-01-01 起恢复 8%
  shenzhen: { pensionBaseMin: 5521, pensionBaseMax: 27603, medicalBaseMin: 6727, medicalBaseMax: 33633, medicalRate: 0.08, sourceKey: 'medical' },
  // 东莞 2026年度医保缴费基数和费率表：下限 4775、上限 27549；单建统筹默认档 3.65%
  dongguan: { pensionBaseMin: 5521, pensionBaseMax: 27603, medicalBaseMin: 4775, medicalBaseMax: 27549, medicalRate: 0.0365, sourceKey: 'medical' },
}

describe('规则文件溯源约束', () => {
  for (const city of ['guangzhou', 'shenzhen', 'dongguan']) {
    const r = loadRuleFile(`${city}.json`)

    it(`${city}：每个来源都有核对日期与合法置信度`, () => {
      expect(Object.keys(r.sources).length).toBeGreaterThanOrEqual(6)
      for (const [key, s] of Object.entries(r.sources)) {
        expect(s.retrievedAt, key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(['official', 'derived', 'unverified'], key).toContain(s.confidence)
        if (s.confidence === 'official') {
          expect(s.docNo || s.url, `${key} 标为 official 必须有文号或原文链接`).toBeTruthy()
        }
      }
    })

    it(`${city}：verified 标志与置信度一致，不允许虚假标注`, () => {
      const allOfficial = Object.values(r.sources).every(s => s.confidence === 'official')
      if (!allOfficial) expect(r.verified, `${city} 存在非 official 来源却标 verified=true`).toBe(false)
    })

    it(`${city}：平台计价必须标为 unverified（无跨平台权威来源）`, () => {
      expect(r.sources.income.confidence).toBe('unverified')
    })
  }
})

describe('R1 外部参数必须是各城官方原文值', () => {
  for (const city of ['guangzhou', 'shenzhen', 'dongguan']) {
    const r = loadRuleFile(`${city}.json`)
    const exp = OFFICIAL_PARAMS[city]

    it(`${city}：养老基数上下限为粤人社发〔2026〕24号现行值`, () => {
      expect(r.benefit.pension.baseMin).toBe(exp.pensionBaseMin)
      expect(r.benefit.pension.baseMax).toBe(exp.pensionBaseMax)
    })

    it(`${city}：医保基数与费率取自本城原文，不得跨城抄值`, () => {
      expect(r.benefit.medical.baseMin).toBe(exp.medicalBaseMin)
      expect(r.benefit.medical.baseMax).toBe(exp.medicalBaseMax)
      expect(r.benefit.medical.rate).toBeCloseTo(exp.medicalRate, 4)
    })

    it(`${city}：医保来源已回溯原文（official 且带链接）`, () => {
      const s = r.sources[exp.sourceKey]
      expect(s.confidence, `${city} 医保来源应为 official`).toBe('official')
      expect(s.url, `${city} 医保来源必须有原文链接`).toBeTruthy()
    })
  }

  it('三城医保基数互不相同——相同即说明又抄了同一个城市', () => {
    const g = OFFICIAL_PARAMS.guangzhou, s = OFFICIAL_PARAMS.shenzhen, d = OFFICIAL_PARAMS.dongguan
    expect(new Set([g.medicalBaseMax, s.medicalBaseMax, d.medicalBaseMax]).size).toBe(3)
    expect(new Set([g.medicalBaseMin, s.medicalBaseMin, d.medicalBaseMin]).size).toBe(3)
  })
})

describe('R1 个税税率表口径必须自述正确', () => {
  for (const city of ['guangzhou', 'shenzhen', 'dongguan']) {
    const r = loadRuleFile(`${city}.json`)

    it(`${city}：标题为税率表一，不得称预扣率表二`, () => {
      expect(r.sources.tax.title).toContain('税率表一')
      expect(r.sources.tax.title).not.toContain('预扣率表二')
    })

    it(`${city}：note 说明与预扣口径的差异`, () => {
      expect(r.sources.tax.note).toContain('预扣率表二')
      expect(r.sources.tax.note).toContain('年度汇算清缴')
    })

    it(`${city}：method 为年度汇算口径`, () => {
      expect(r.tax.method).toBe('annual_consolidated')
    })
  }
})

describe('R2 劳务报酬费用减除的 4000 元分支', () => {
  const gz = loadRuleFile('guangzhou.json')
  const rule = adaptLaborRule(gz.tax.laborRemuneration)

  it('月收入 3000（低于 4000）时按 800 元减除，而非 20%', () => {
    const t = calcLaborMonthly(Array(12).fill(Cent.create(3000 * 100)), Cent.create(0), rule)
    expect(t.ok).toBe(true)
    if (t.ok) expect(t.value.annualTax).toBe(0)
  })

  it('月收入 8000（高于 4000）时按 20% 减除', () => {
    const t = calcLaborMonthly(Array(12).fill(Cent.create(8000 * 100)), Cent.create(0), rule)
    expect(t.ok).toBe(true)
    if (t.ok) expect(centToYuan(t.value.annualTax)).toBeCloseTo(16800 * 0.03, 2)
  })

  it('4000 元阈值由规则文件承载，不写死在代码里', () => {
    expect(gz.tax.laborRemuneration.expenseDeductionFixed).toBe(800)
    expect(gz.tax.laborRemuneration.expenseDeductionThreshold).toBe(4000)
  })
})

describe('R6 endpoint 校验', () => {
  it('拒绝 http 明文 endpoint', () => {
    expect(validateEndpoint('http://example.com/v1/chat/completions').ok).toBe(false)
  })

  it('拒绝无法解析的 endpoint', () => {
    expect(validateEndpoint('not a url').ok).toBe(false)
  })

  it('拒绝相对路径 endpoint（会被解析到本站 origin）', () => {
    expect(validateEndpoint('/v1/chat/completions').ok).toBe(false)
  })

  it('接受 https endpoint 并返回 host', () => {
    const r = validateEndpoint('https://api.deepseek.com/v1/chat/completions')
    expect(r.ok).toBe(true)
    expect(r.host).toBe('api.deepseek.com')
  })

  it('拒绝内嵌用户名密码的 URL（钓鱼手法）', () => {
    expect(validateEndpoint('https://api.deepseek.com@evil.com/v1/chat/completions').ok).toBe(false)
  })
})

describe('退休测算使用规则文件计发基数', () => {
  const base = loadRuleFile('guangzhou.json')
  const rule = adaptRetirementRule(base.retirement)

  function retire(monthlyContribution: number, years: number, index: number, benefitBase = rule.benefitBaseMonthly) {
    const r = projectRetirement(25, 60, Cent.create(monthlyContribution * 100), years,
      Rate.create(0.05), Rate.create(index), benefitBase)
    return r.ok ? r.value : null
  }

  it('基础养老金按 国发〔2005〕38号 公式', () => {
    const r = retire(1200, 15, 0.6)
    expect(r).not.toBeNull()
    const expected = base.retirement.benefitBaseMonthly * (1 + 0.6) / 2 * 15 * 0.01
    expect(centToYuan(r!.basePension)).toBeCloseTo(Math.round(expected * 100) / 100, 1)
  })

  it('个人账户养老金按 60 岁计发月数 139 除算', () => {
    const r = retire(1200, 15, 0.6)
    expect(r).not.toBeNull()
    expect(centToYuan(r!.personalPension)).toBeCloseTo(Math.round(Number(r!.personalAccount) / 139) / 100, 2)
  })

  it('计发基数不同的两城，同输入必须得出不同的基础养老金', () => {
    const a = retire(1200, 15, 0.6, Cent.create(9493 * 100))
    const b = retire(1200, 15, 0.6, Cent.create(11293 * 100))
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(Number(b!.basePension)).toBeGreaterThan(Number(a!.basePension))
  })

  it('缴费指数低于 0.6 时按 0.6 计，不得算出更低的基础养老金', () => {
    const low = retire(1200, 15, 0.3)
    const floor = retire(1200, 15, 0.6)
    expect(Number(low!.basePension)).toBe(Number(floor!.basePension))
  })

  it('深圳计发基数单列为 11293，不得沿用全省 9493', () => {
    expect(loadRuleFile('shenzhen.json').retirement.benefitBaseMonthly).toBe(11293)
  })

  it('广州与东莞沿用全省计发基数 9493', () => {
    for (const city of ['guangzhou', 'dongguan']) {
      expect(loadRuleFile(`${city}.json`).retirement.benefitBaseMonthly, city).toBe(9493)
    }
  })
})
