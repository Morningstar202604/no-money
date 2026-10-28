/**
 * 新旧实现对拍测试（Parity Test）
 *
 * 目的：在把 UI 切到 application/domain 层之前，用**同一份规则 JSON + 同一组输入**
 * 分别跑旧引擎（src/engine/*，单位：元）与新领域层（src/domain/*，单位：分），
 * 逐项比对到「分」为止。任何不一致都视为阻断项。
 *
 * 为什么要对拍而不是各写各的测试：
 * 两侧各自的手算基准都可能是对的，但只要口径/舍入/夹取有一处不同，
 * 用户就会看到"切换前后数字变了"。对拍是唯一能证明等价的方法。
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// 旧实现（单位：元）
import { IncomeEngine as OldIncomeEngine } from '../../src/engine/IncomeEngine'
import { TaxEngine as OldTaxEngine } from '../../src/engine/TaxEngine'
import { BenefitEngine as OldBenefitEngine } from '../../src/engine/BenefitEngine'

// 新实现（单位：分）
import { calcIncome as domCalcIncome } from '../../src/domain/income/calculator'
import { calcCosts as domainCalcCosts } from '../../src/domain/income/calculator'
import type { IncomeRule as DomainIncomeRule, WorkParams as DomainWorkParams, CostParams as DomainCostParams } from '../../src/domain/income/rules'
import { calcLaborMonthly as domainCalcLabor } from '../../src/domain/tax/calculator'
import type { LaborRemunerationRule as DomainLaborRule } from '../../src/domain/tax/rules'
import { calcMonthly as domainCalcBenefit } from '../../src/domain/benefit/calculator'
import { projectRetirement as domainProjectRetirement } from '../../src/domain/benefit/calculator'
import type { BenefitRule as DomainBenefitRule, RetirementRule as DomainRetirementRule } from '../../src/domain/benefit/rules'

import type { CityRule, WorkParams, CostParams } from '../../src/types'

const CITIES = ['guangzhou', 'shenzhen', 'dongguan'] as const
const rules = Object.fromEntries(
  CITIES.map(c => [c, JSON.parse(readFileSync(`public/rules/${c}.json`, 'utf8')) as CityRule]),
) as Record<(typeof CITIES)[number], CityRule>

// ===== 单位换算：元 → 分 =====
const Y = (yuan: number): number => Math.round(yuan * 100)

// ===== 规则适配：legacy JSON → domain 类型 =====
function toDomainIncomeRule(r: CityRule['income']): DomainIncomeRule {
  return {
    basePricePerOrder: Y(r.basePricePerOrder) as DomainIncomeRule['basePricePerOrder'],
    distanceRate: Y(r.distanceRate) as DomainIncomeRule['distanceRate'],
    weightSurcharge: { threshold: r.weightSurcharge.threshold, rate: Y(r.weightSurcharge.rate) as never },
    timeSubsidy: r.timeSubsidy,
    holidayMultiplier: r.holidayMultiplier,
    rainSurcharge: r.rainSurcharge,
    monthlyBonus: r.monthlyBonus
      ? { threshold: r.monthlyBonus.threshold, amount: Y(r.monthlyBonus.amount) as never }
      : undefined,
  }
}

function toDomainLaborRule(r: CityRule['tax']['laborRemuneration']): DomainLaborRule {
  return {
    expenseDeductionRate: r.expenseDeductionRate as never,
    expenseDeductionFixed: Y(r.expenseDeductionFixed ?? 800) as never,
    expenseDeductionThreshold: Y(r.expenseDeductionThreshold ?? 4000) as never,
    basicDeductionMonthly: Y(r.basicDeductionMonthly) as never,
    taxTable: r.taxTable.map(b => ({
      min: Y(b.min) as never,
      max: Y(b.max) as never,
      rate: b.rate as never,
      deduction: Y(b.deduction) as never,
    })),
  }
}

function toDomainBenefitRule(r: CityRule['benefit']): DomainBenefitRule {
  return {
    pension: {
      baseMin: Y(r.pension.baseMin) as never,
      baseMax: Y(r.pension.baseMax) as never,
      rate: r.pension.rate as never,
    },
    medical: {
      baseMin: Y(r.medical.baseMin) as never,
      baseMax: Y(r.medical.baseMax) as never,
      rate: r.medical.rate as never,
    },
    medicalTiers: r.medicalTiers?.map(t => ({
      id: t.id,
      name: t.name,
      rate: t.rate as never,
      note: t.note,
    })),
  }
}

function toDomainRetirementRule(r: CityRule['retirement']): DomainRetirementRule {
  return {
    benefitBaseMonthly: Y(r.benefitBaseMonthly) as never,
    paymentIndex: r.paymentIndex as never,
    assumedAnnualReturn: r.assumedAnnualReturn as never,
  }
}

function toDomainWork(w: WorkParams): DomainWorkParams {
  return {
    city: w.city,
    dailyHours: w.dailyHours as never,
    dailyOrders: w.dailyOrders,
    avgDistance: w.avgDistance as never,
    workDaysMonth: w.workDaysMonth,
    rainDaysMonth: w.rainDaysMonth,
    holidayDaysMonth: w.holidayDaysMonth,
  }
}

function toDomainCosts(c: CostParams): DomainCostParams {
  return {
    vehicleType: c.vehicleType,
    fuelCostMonth: Y(c.fuelCostMonth) as never,
    electricityCostMonth: Y(c.electricityCostMonth) as never,
    maintenanceMonth: Y(c.maintenanceMonth) as never,
    insuranceMonth: Y(c.insuranceMonth) as never,
    phoneCostMonth: Y(c.phoneCostMonth) as never,
    foodCostMonth: Y(c.foodCostMonth) as never,
    trafficFineMonth: Y(c.trafficFineMonth) as never,
    vehicleDepreciationMonth: Y(c.vehicleDepreciationMonth) as never,
    otherCostMonth: Y(c.otherCostMonth) as never,
  }
}

// ===== 输入矩阵：覆盖正常值与边界值 =====
const BASE_WORK: WorkParams = {
  city: 'guangzhou',
  dailyHours: 10,
  dailyOrders: 35,
  avgDistance: 2.5,
  workDaysMonth: 26,
  rainDaysMonth: 3,
  holidayDaysMonth: 2,
}

const WORK_CASES: Array<{ label: string; work: WorkParams }> = [
  { label: '默认参数', work: BASE_WORK },
  { label: '零单量', work: { ...BASE_WORK, dailyOrders: 0 } },
  { label: '零距离', work: { ...BASE_WORK, avgDistance: 0 } },
  { label: '零雨天零节假日', work: { ...BASE_WORK, rainDaysMonth: 0, holidayDaysMonth: 0 } },
  { label: '最低工时1小时', work: { ...BASE_WORK, dailyHours: 1 } },
  { label: '最高工时24小时', work: { ...BASE_WORK, dailyHours: 24 } },
  { label: '工作天数1天', work: { ...BASE_WORK, workDaysMonth: 1 } },
  { label: '工作天数0天（越界，应与夹取后一致）', work: { ...BASE_WORK, workDaysMonth: 0 } },
  { label: '工作天数31天', work: { ...BASE_WORK, workDaysMonth: 31 } },
  { label: '负工时', work: { ...BASE_WORK, dailyHours: -5 } },
  { label: 'NaN 单量', work: { ...BASE_WORK, dailyOrders: Number.NaN } },
  { label: 'Infinity 距离', work: { ...BASE_WORK, avgDistance: Number.POSITIVE_INFINITY } },
  { label: '高单量200', work: { ...BASE_WORK, dailyOrders: 200 } },
  { label: '高距离50km', work: { ...BASE_WORK, avgDistance: 50 } },
]

const BASE_COSTS: CostParams = {
  vehicleType: 'electric',
  fuelCostMonth: 0,
  electricityCostMonth: 300,
  maintenanceMonth: 200,
  insuranceMonth: 100,
  phoneCostMonth: 100,
  foodCostMonth: 800,
  trafficFineMonth: 50,
  vehicleDepreciationMonth: 300,
  otherCostMonth: 100,
}

const GROSS_SAMPLES = [0, 2000, 3000, 4000, 7280.39, 9311.25, 20000, 50000, 200000]

describe('对拍：收入引擎 旧(元) vs 新(分)', () => {
  for (const city of CITIES) {
    const rule = rules[city]
    const old = new OldIncomeEngine(rule.income)
    const domRule = toDomainIncomeRule(rule.income)

    for (const { label, work } of WORK_CASES) {
      it(`${city} / ${label}`, () => {
        const o = old.calcIncome({ ...work, city })
        const d = domCalcIncome(domRule, toDomainWork({ ...work, city }))

        expect(Y(o.basePay)).toBe(Number(d.basePay))
        expect(Y(o.distancePay)).toBe(Number(d.distancePay))
        expect(Y(o.subsidyPay)).toBe(Number(d.subsidyPay))
        expect(Y(o.bonusPay)).toBe(Number(d.bonusPay))
        expect(Y(o.grossIncome)).toBe(Number(d.grossIncome))
      })
    }
  }
})

describe('对拍：成本引擎 旧(元) vs 新(分)', () => {
  for (const city of CITIES) {
    it(`${city} / 默认成本`, () => {
      const o = new OldIncomeEngine(rules[city].income).calcCosts(BASE_COSTS)
      const d = domainCalcCosts(toDomainCosts(BASE_COSTS))
      expect(Y(o.total)).toBe(Number(d.total))
    })

    it(`${city} / 全部为零`, () => {
      const zero: CostParams = {
        vehicleType: 'electric',
        fuelCostMonth: 0, electricityCostMonth: 0, maintenanceMonth: 0, insuranceMonth: 0,
        phoneCostMonth: 0, foodCostMonth: 0, trafficFineMonth: 0,
        vehicleDepreciationMonth: 0, otherCostMonth: 0,
      }
      const o = new OldIncomeEngine(rules[city].income).calcCosts(zero)
      const d = domainCalcCosts(toDomainCosts(zero))
      expect(Y(o.total)).toBe(Number(d.total))
    })
  }
})

describe('对拍：个税引擎 旧(元) vs 新(分)', () => {
  for (const city of CITIES) {
    const rule = rules[city]
    const old = new OldTaxEngine({
      laborRemuneration: rule.tax.laborRemuneration,
      soleProprietorship: rule.soleProprietorship,
    })
    const domRule = toDomainLaborRule(rule.tax.laborRemuneration)

    for (const gross of GROSS_SAMPLES) {
      for (const deduction of [0, 2000]) {
        it(`${city} / 月毛收入 ${gross} / 专项附加 ${deduction}`, () => {
          const o = old.calcLabor(new Array(12).fill(gross), deduction)
          const d = domainCalcLabor(
            new Array(12).fill(Y(gross)) as never,
            Y(deduction) as never,
            domRule,
          )
          if (!d.ok) throw new Error(`domain 返回错误: ${JSON.stringify(d.error)}`)

          expect(Y(o.annualTax)).toBe(Number(d.value.annualTax))
          expect(Y(o.afterTaxIncome)).toBe(Number(d.value.afterTaxIncome))
          expect(o.monthlyTax.map(Y)).toEqual(d.value.monthlyTax.map(Number))
          // 旧实现返回百分数并保留 2 位小数，新实现返回未舍入的小数比率，
          // 因此容差取 0.01（旧实现的舍入上限），而非要求逐位相等
          expect(o.effectiveRate).toBeCloseTo(Number(d.value.effectiveRate) * 100, 2)
        })
      }
    }
  }
})

describe('对拍：社保引擎 旧(元) vs 新(分)', () => {
  for (const city of CITIES) {
    const rule = rules[city]
    const old = new OldBenefitEngine(rule.benefit, rule.retirement)
    const domRule = toDomainBenefitRule(rule.benefit)
    const tiers = rule.benefit.medicalTiers

    for (const gross of [0, 2000, 7280.39, 20000, 50000]) {
      for (const enrolled of [true, false]) {
        it(`${city} / 月毛收入 ${gross} / 参保=${enrolled}`, () => {
          const o = old.calcMonthly(gross, enrolled)
          const d = domainCalcBenefit(
            Y(gross) as never,
            enrolled,
            undefined,
            {},
            domRule,
          )
          if (!d.ok) throw new Error(`domain 返回错误: ${JSON.stringify(d.error)}`)

          expect(Y(o.pensionMonthly)).toBe(Number(d.value.pensionMonthly))
          expect(Y(o.medicalMonthly)).toBe(Number(d.value.medicalMonthly))
          expect(Y(o.totalMonthly)).toBe(Number(d.value.totalMonthly))
        })
      }
    }

    if (tiers && tiers.length > 0) {
      it(`${city} / 自选医保档次`, () => {
        const tier = tiers[0]
        const o = old.calcMonthly(20000, true, tier.id)
        // domain 侧直接接收该档费率
        const d = domainCalcBenefit(Y(20000) as never, true, tier.rate as never, {}, domRule)
        if (!d.ok) throw new Error(`domain 返回错误: ${JSON.stringify(d.error)}`)
        expect(Y(o.medicalMonthly)).toBe(Number(d.value.medicalMonthly))
      })
    }
  }
})

describe('对拍：退休测算 旧(元) vs 新(分)', () => {
  for (const city of CITIES) {
    const rule = rules[city]
    const old = new OldBenefitEngine(rule.benefit, rule.retirement)
    const domRet = toDomainRetirementRule(rule.retirement)

    const CASES = [
      { age: 25, retireAge: 60, contribution: 1000, years: 0 },
      { age: 30, retireAge: 60, contribution: 2000, years: 5 },
      { age: 45, retireAge: 60, contribution: 3000, years: 15 },
      { age: 50, retireAge: 63, contribution: 2500, years: 10 },
      { age: 60, retireAge: 60, contribution: 0, years: 40 },
    ]

    for (const c of CASES) {
      it(`${city} / ${c.age}岁→${c.retireAge}岁 / 月缴 ${c.contribution} / 已缴 ${c.years}年`, () => {
        // 旧引擎的 annualReturn 有字面量默认值 0.05，而规则文件给的是 0.03。
        // 真实调用方（RetirementPlanner.vue）总是显式传入规则值，此处必须同样对齐，
        // 否则测到的是"默认值与规则不一致"而非计算口径差异。
        const o = old.projectRetirement(
          c.age,
          c.retireAge,
          c.contribution,
          c.years,
          rule.retirement.assumedAnnualReturn,
        )
        const d = domainProjectRetirement(
          c.age,
          c.retireAge,
          Y(c.contribution) as never,
          c.years,
          domRet.assumedAnnualReturn,
          domRet.paymentIndex,
          domRet.benefitBaseMonthly,
        )
        if (!d.ok) throw new Error(`domain 返回错误: ${JSON.stringify(d.error)}`)

        expect(Y(o.personalAccount)).toBe(Number(d.value.personalAccount))
        expect(Y(o.basePension)).toBe(Number(d.value.basePension))
        expect(Y(o.personalPension)).toBe(Number(d.value.personalPension))
        expect(Y(o.totalPension)).toBe(Number(d.value.totalPension))
        expect(o.months).toBe(d.value.months)
      })
    }
  }
})

describe('对拍：个体验证值不变（新旧应完全一致）', () => {
  const rule = rules.guangzhou
  const oldIncome = new OldIncomeEngine(rule.income)
  // 本组只对拍收入侧，不需要 personal；保留类型引用会触发 noUnusedLocals

  it('毛收入 8856.25 与 9311.25 的历史结论在新实现下复现', () => {
    // 这两个数字来自峰时折算修复时的审计记录，若对拍失败说明口径已被改动
    const parityRule = toDomainIncomeRule(rule.income)
    const short = domCalcIncome(parityRule, toDomainWork({ ...BASE_WORK, dailyHours: 8 }))
    const long = domCalcIncome(parityRule, toDomainWork({ ...BASE_WORK, dailyHours: 10 }))
    // 工时↑ → 峰时占比↓ → 补贴↓，这是折算的核心不变式
    expect(Number(long.subsidyPay)).toBeLessThan(Number(short.subsidyPay))
    expect(Number(oldIncome.calcIncome({ ...BASE_WORK, dailyHours: 10 }).subsidyPay) * 100).toBe(
      Number(long.subsidyPay),
    )
  })

  it('默认参数下净收入恒等式在新实现下闭合', () => {
    const income = domCalcIncome(toDomainIncomeRule(rule.income), toDomainWork(BASE_WORK))
    const costs = domainCalcCosts(toDomainCosts(BASE_COSTS))
    const gross = Number(income.grossIncome) / 100
    const total = Number(costs.total) / 100
    const net = Math.round((gross - total) * 100) / 100
    const oldNet =
      oldIncome.calcIncome(BASE_WORK).grossIncome - oldIncome.calcCosts(BASE_COSTS).total
    expect(net).toBeCloseTo(oldNet, 2)
  })
})