/**
 * 个人账户增长曲线与退休测算的口径一致性。
 *
 * 背景：曲线逻辑原先内联在 RetirementPlanner.vue 的 computed 里，用 (1+r)^12 按年
 * 复利、首点还先注入一年缴费——与按月复利的退休引擎相差约 9000 倍，同屏两个数字
 * 互相矛盾而单测看不见。这组断言把「曲线每个点 == domain 个人账户余额」固定下来。
 * 0.0.43 删除旧 BenefitEngine 后，基准改为生产用的 domain 纯函数。
 */

import { describe, it, expect } from 'vitest'
import { loadAllRulesArray } from './helpers/rules'
import { readFileSync } from 'node:fs'
import { projectRetirement } from '../src/domain/benefit/calculator'
import { Cent, Rate, centToYuan } from '../src/domain/shared/value-objects'
import { adaptRetirementRule } from '../src/application/adapters/ruleAdapters'
import { buildPensionGrowthSeries, buildPensionTiers, socialAverageWage } from '../src/utils/pensionSeries'
import type { CityRule } from '../src/types'

const rule = JSON.parse(readFileSync('public/rules/guangzhou.json', 'utf8')) as CityRule
const retirement = adaptRetirementRule(rule.retirement)

const currentAge = 25
const retireAge = 60
const accountMonthly = Math.round(rule.benefit.pension.baseMin * (rule.retirement.personalAccountRate ?? 0.08))
const annualReturn = rule.retirement.assumedAnnualReturn

function accountAt(age: number): number {
  const result = projectRetirement(
    currentAge,
    age,
    Cent.create(accountMonthly * 100),
    age - currentAge,
    Rate.create(annualReturn),
    retirement.paymentIndex,
    retirement.benefitBaseMonthly,
  )
  return result.ok ? centToYuan(result.value.personalAccount) : Number.NaN
}

const series = buildPensionGrowthSeries({ currentAge, retireAge, accountMonthly, annualReturn })

describe('增长曲线与退休测算同口径', () => {
  it('首点余额为 0（缴费起点，不得先注入一年缴费）', () => {
    expect(series[0].age).toBe(currentAge)
    expect(series[0].balance).toBe(0)
  })

  it('末点等于「缴至退休」的 domain 个人账户余额', () => {
    expect(series[series.length - 1].balance).toBe(accountAt(retireAge))
  })

  it('每个中间点等于「只缴到该年」的 domain 余额（逐年单调不减）', () => {
    for (let i = 1; i < series.length; i++) {
      const p = series[i]
      expect(p.balance, `${p.label} 与 domain 余额不一致`).toBe(accountAt(p.age))
      expect(p.balance, `${p.label} 余额低于上一年`).toBeGreaterThanOrEqual(series[i - 1].balance)
    }
  })

  it('量级必须与 domain 同阶（防再次出现按年复利导致的数千倍高估）', () => {
    const last = series[series.length - 1].balance
    expect(last).toBeLessThan(accountAt(retireAge) * 1.01)
  })

  it('年龄倒置或非有限时返回空序列而不是抛出', () => {
    expect(buildPensionGrowthSeries({ currentAge: 60, retireAge: 55, accountMonthly, annualReturn })).toEqual([])
    expect(buildPensionGrowthSeries({ currentAge: NaN, retireAge: 60, accountMonthly, annualReturn })).toEqual([])
  })
})

describe('缴费档次基数必须与档位标签一致', () => {
  const allRules = loadAllRulesArray()

  it('每档基数 = 档位百分比 × (基数下限 ÷ 60%)，且随档位单调递增', () => {
    for (const r of allRules) {
      const baseMin = r.benefit.pension.baseMin
      const baseMax = r.benefit.pension.baseMax
      const tiers = buildPensionTiers(baseMin, baseMax)
      // 60% 档必须等于下限；200% 档必须高于 150% 档（旧实现里 200% 档只因取 max*0.8
      // 反而低于 150% 档，图上出现"缴得越多、领得越少"的反向结论）
      expect(tiers[0].base, `${r.city} 60%档应等于下限`).toBe(Math.round(baseMin))
      const bases = tiers.map(t => t.base)
      for (let i = 1; i < bases.length; i++) {
        expect(bases[i], `${r.city} 第 ${i} 档基数未高于前一档（档位与基数脱钩）`).toBeGreaterThan(bases[i - 1])
      }
      // 档位与基数成固定比例：200% 档 = 未四舍五入的下限 × (200/60)
      // 用 first.base（已取整）反推会在小数下限上产生 1 元级误差，如贵阳 4,426.05。
      const last = tiers[tiers.length - 1]
      expect(last.base).toBe(Math.round(baseMin * (last.pct / 60)))
    }
  })

  it('各城基数上下限之比恒为 5（法定 60%~300% 区间），否则档位换算假设不成立', () => {
    for (const r of allRules) {
      const ratio = r.benefit.pension.baseMax / r.benefit.pension.baseMin
      expect(ratio, `${r.city} 上下限之比 ${ratio}，非 60%~300% 口径`).toBeCloseTo(5, 2)
    }
  })

  it('高档位养老金必须按该档自身缴费指数计算（不得全部按 0.6 下限低估）', () => {
    const tiers = buildPensionTiers(rule.benefit.pension.baseMin, rule.benefit.pension.baseMax)
    const social = socialAverageWage(rule.benefit.pension.baseMin, rule.benefit.pension.baseMax)
    const accountRate = rule.retirement.personalAccountRate ?? 0.08
    const years = 35
    const retired = adaptRetirementRule(rule.retirement)

    const withIndex = tiers.map(t => {
      const r = projectRetirement(25, 60, Cent.create(Math.round(t.base * accountRate) * 100), years,
        Rate.create(0.03), Rate.create(t.base / social), retired.benefitBaseMonthly)
      return r.ok ? centToYuan(r.value.totalPension) : 0
    })
    const floored = tiers.map(t => {
      const r = projectRetirement(25, 60, Cent.create(Math.round(t.base * accountRate) * 100), years,
        Rate.create(0.03), Rate.create(0.6), retired.benefitBaseMonthly)
      return r.ok ? centToYuan(r.value.totalPension) : 0
    })

    // 60% 档指数约等于下限 0.6，两者只应有分位级舍入差
    expect(Math.abs(withIndex[0] - floored[0])).toBeLessThanOrEqual(1)
    // 100% 档起必须高于按 0.6 兜底的结果
    for (let i = 2; i < tiers.length; i++) {
      expect(withIndex[i], `${tiers[i].label} 未按自身指数计算，养老金被低估`).toBeGreaterThan(floored[i])
    }
  })

  it('社平推定对上下限比 5 的规则自洽（下限÷0.6 与 上限÷3 一致）', () => {
    for (const r of allRules) {
      const social = socialAverageWage(r.benefit.pension.baseMin, r.benefit.pension.baseMax)
      expect(social / (r.benefit.pension.baseMin / 0.6) - 1, `${r.city} 社平推定不自洽`).toBeLessThan(0.02)
    }
  })
})
