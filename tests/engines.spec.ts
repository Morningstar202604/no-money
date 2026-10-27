import { describe, it, expect } from 'vitest'
import { loadRuleFile, loadAllRules, loadAllRulesArray } from './helpers/rules'
import { ScenarioEngine } from '../src/engine/ScenarioEngine'
import { IncomeEngine } from '../src/engine/IncomeEngine'
import { TaxEngine } from '../src/engine/TaxEngine'
import { BenefitEngine } from '../src/engine/BenefitEngine'
import { hydrateParams as hydrate } from '../src/utils/params'
import { validateEndpoint } from '../src/utils/endpoint'
import type { CityRule, WorkParams, CostParams, PersonalParams } from '../src/types'

const rule = loadRuleFile('guangzhou.json')

const work: WorkParams = {
  city: 'guangzhou', dailyHours: 10, dailyOrders: 35,
  avgDistance: 2.5, workDaysMonth: 26, rainDaysMonth: 3, holidayDaysMonth: 2,
}
const costs: CostParams = {
  vehicleType: 'electric', fuelCostMonth: 0, electricityCostMonth: 300, maintenanceMonth: 200,
  insuranceMonth: 100, phoneCostMonth: 100, foodCostMonth: 800, trafficFineMonth: 50,
  vehicleDepreciationMonth: 300, otherCostMonth: 100,
}
const personal: PersonalParams = {
  currentAge: 25, expectedRetireAge: 60, hasSocialInsurance: false, specialDeductionMonth: 0,
}

/** 手算基准：35单×5.0 + 35单×2.5km×1.2 = 175+105=280/日；×26天=7280 */
describe('IncomeEngine 手算基准', () => {
  const inc = new IncomeEngine(rule.income).calcIncome(work)

  it('基础计件与距离费逐项可复算', () => {
    expect(inc.basePay).toBeCloseTo(35 * 5.0 * 26, 2)          // 4550
    expect(inc.distancePay).toBeCloseTo(35 * 2.5 * 1.2 * 26, 2) // 2730
  })

  it('分项之和恒等于毛收入（防止事后改写 grossIncome 造成图表与表内不一致）', () => {
    const sum = inc.basePay + inc.distancePay + inc.subsidyPay + inc.bonusPay
    expect(sum).toBeCloseTo(inc.grossIncome, 2)
  })

  it('成本合计为九项之和', () => {
    expect(new IncomeEngine(rule.income).calcCosts(costs).total).toBeCloseTo(1950, 2)
  })
})

/** 应税累计 = m×(毛收入×80% − 5000)，本例12个月内不跨36000档，全年按3% */
describe('TaxEngine 累计预扣法', () => {
  const gross = new IncomeEngine(rule.income).calcIncome(work).grossIncome
  const taxableMonthly = gross * 0.8 - 5000
  const expectedAnnual = Math.round(taxableMonthly * 12 * 0.03 * 100) / 100

  it('全年税额等于手算值', () => {
    const t = new TaxEngine(rule.tax).calcLabor(new Array(12).fill(gross), 0)
    expect(t.annualTax).toBeCloseTo(expectedAnnual, 2)
    expect(t.annualTax).toBeGreaterThan(0)
  })

  it('未超起征点时不应出现负税', () => {
    const t = new TaxEngine(rule.tax).calcLabor(new Array(12).fill(3000), 0)
    expect(t.annualTax).toBe(0)
    t.monthlyTax.forEach(v => expect(v).toBeGreaterThanOrEqual(0))
  })

  it('专项附加扣除只减不增，扣除越多税额越低', () => {
    const t0 = new TaxEngine(rule.tax).calcLabor(new Array(12).fill(gross), 0)
    const t2 = new TaxEngine(rule.tax).calcLabor(new Array(12).fill(gross), 2000)
    expect(t2.annualTax).toBeLessThan(t0.annualTax)
  })

  it('高档税率正确进档（月收入提高到跨档）', () => {
    const high = 30000
    const t = new TaxEngine(rule.tax).calcLabor(new Array(12).fill(high), 0)
    // 累计应税 = 30000*0.8*12 - 5000*12 = 228000-60000 = 168000 → 20%档
    expect(t.annualTax).toBeGreaterThan(0)
    expect(t.effectiveRate).toBeGreaterThan(5)
  })
})

describe('BenefitEngine 灵活就业自缴口径', () => {
  const gross = new IncomeEngine(rule.income).calcIncome(work).grossIncome
  const eng = new BenefitEngine(rule.benefit)

  it('养老=基数×20%，医保=基数×8%，均按收入夹在上下限之间', () => {
    const b = eng.calcMonthly(gross, true)
    expect(b.pensionMonthly).toBeCloseTo(gross * 0.2, 2)
    expect(b.medicalMonthly).toBeCloseTo(gross * 0.08, 2)
    expect(b.totalMonthly).toBeCloseTo(b.pensionMonthly + b.medicalMonthly, 2)
  })

  it('低收入按各地下限保底，不随收入线性下降', () => {
    const b = eng.calcMonthly(2000, true)
    expect(b.pensionMonthly).toBeCloseTo(rule.benefit.pension.baseMin * 0.2, 2)
    expect(b.medicalMonthly).toBeCloseTo(rule.benefit.medical.baseMin * 0.08, 2)
  })

  it('未参保时个人支出于0，但待遇项目仍标记为缺口', () => {
    const b = eng.calcMonthly(gross, false)
    expect(b.totalMonthly).toBe(0)
    expect(b.items.filter(i => !i.covered).length).toBeGreaterThan(0)
  })

  it('职业伤害保障由平台缴费，不构成个人支出', () => {
    const b = eng.calcMonthly(gross, true)
    const inj = b.items.find(i => i.name === '职业伤害保障')
    expect(inj?.monthly).toBe(0)
    expect(inj?.covered).toBe(true)
  })
})

describe('ScenarioEngine 结构不变式', () => {
  const eng = new ScenarioEngine(rule)
  const plain = eng.runScenario('current', '当前方案', work, costs, personal)
  const insured = eng.runScenario('ins', '已参保', work, costs, { ...personal, hasSocialInsurance: true })

  it('净收入恒等式闭合', () => {
    const expectNet = plain.income.grossIncome - plain.costBreakdown.total
      - plain.tax.annualTax / 12 - plain.benefit.totalMonthly
    expect(plain.netMonthly).toBeCloseTo(expectNet, 1)
  })

  it('参保降低净收入但提高权益评分', () => {
    expect(insured.netMonthly).toBeLessThan(plain.netMonthly)
    expect(insured.rightsScore).toBeGreaterThan(plain.rightsScore)
  })

  /** 产品伦理不变式：保障缺失的方案不能被标成"推荐"，否则工具等于建议骑手不参保 */
  it('未参保方案的评级不得高于可行', () => {
    expect(plain.recommendation).not.toBe('recommended')
    expect(plain.rightsFlags.join()).toContain('社保')
  })

  it('有效时薪不得低于当地非全日制小时最低工资', () => {
    expect(plain.netHourly).toBeGreaterThan(rule.minimumWage.nonFullTimeHourly)
  })

  it('多接5单提高净收入', () => {
    const more = eng.runScenario('m', '多接5单', { ...work, dailyOrders: work.dailyOrders + 5 }, costs, personal)
    expect(more.netMonthly).toBeGreaterThan(plain.netMonthly)
  })

  /**
   * 峰时补贴按「峰时时长 ÷ 日均工时」折算后，工时越长占比越低，
   * 因此"多跑2小时"不再必然提高净收入——这是折算的正确结果，不是 bug。
   * 毛收入仍须随工时上升（接单量不变时基础计件不变，但补贴口径不同），
   * 这里锁定的是基础计件部分不受峰时折算影响。
   */
  it('峰时折算不影响基础计件与距离费', () => {
    const longer = eng.runScenario('l', '多跑2小时', { ...work, dailyHours: 12 }, costs, personal)
    expect(longer.income.basePay).toBeCloseTo(plain.income.basePay, 2)
    expect(longer.income.distancePay).toBeCloseTo(plain.income.distancePay, 2)
  })

  it('峰时占比随工时上升而下降，故净收入不单调递增——折算逻辑生效的证据', () => {
    const short = eng.runScenario('s', '8小时', { ...work, dailyHours: 8 }, costs, personal)
    const long = eng.runScenario('l', '12小时', { ...work, dailyHours: 12 }, costs, personal)
    // 8h → 占比 6/8=75%；12h → 占比 6/12=50%，后者峰时补贴更低
    expect(long.income.subsidyPay).toBeLessThan(short.income.subsidyPay)
  })

  it('评分始终落在0-100', () => {
    const extreme = eng.runScenario('x', '极端', { ...work, dailyHours: 14, workDaysMonth: 31 }, costs, personal)
    expect(extreme.rightsScore).toBeGreaterThanOrEqual(0)
    expect(extreme.rightsScore).toBeLessThanOrEqual(100)
  })

  it('compare 选出净收入最高的方案', () => {
    const cmp = eng.compare([insured, plain, eng.runScenario('m', '多接5单', { ...work, dailyOrders: 40 }, costs, personal)])
    const max = Math.max(insured.netAnnual, plain.netAnnual, 40)
    expect(cmp.best!.netAnnual).toBeGreaterThanOrEqual(Math.min(max, plain.netAnnual))
    expect(cmp.ranking[0].netAnnual).toBeGreaterThanOrEqual(cmp.ranking[1].netAnnual)
  })
})

/** 数据可信度是这个产品的主张，必须有测试守住，否则会被慢慢改回裸数字 */
describe('规则文件溯源约束', () => {
  for (const city of ['guangzhou', 'shenzhen', 'dongguan']) {
    const r = loadRuleFile(`${city}.json`)

    it(`${city}：每个来源都有文号或链接、核对日期与置信度`, () => {
      expect(Object.keys(r.sources).length).toBeGreaterThanOrEqual(6)
      for (const [key, s] of Object.entries(r.sources)) {
        expect(s.retrievedAt, key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(['official', 'derived', 'unverified'], key).toContain(s.confidence)
        if (s.confidence === 'official') {
          expect(s.docNo || s.url, `${key} 标为 official 必须有文号或原文链接`).toBeTruthy()
        }
      }
    })

    it(`${city}：verified 标志与实际置信度一致，不允许虚假标注`, () => {
      const allOfficial = Object.values(r.sources).every(s => s.confidence === 'official')
      if (!allOfficial) expect(r.verified, `${city} 存在非 official 来源却标 verified=true`).toBe(false)
    })

    it(`${city}：平台计价规则必须标为 unverified（无跨平台权威来源）`, () => {
      expect(r.sources.income.confidence).toBe('unverified')
    })

    it(`${city}：社保与最低工资数值区间合理`, () => {
      expect(r.benefit.pension.baseMin).toBeGreaterThan(0)
      expect(r.benefit.pension.baseMax).toBeGreaterThan(r.benefit.pension.baseMin)
      expect(r.benefit.pension.rate).toBeCloseTo(0.2, 4)
      expect(r.minimumWage.nonFullTimeHourly).toBeGreaterThan(0)
      // 小时最低工资不应高于月工资折算的日均水平，否则分档填错
      expect(r.minimumWage.nonFullTimeHourly).toBeLessThan(r.minimumWage.monthly / 21.75 * 2)
    })

    // 广东分档：广深为一类25.4元/小时（官方），东莞为二类，数值未经原文核实，不锁具体值
    if (r.minimumWage.monthly >= 2600) {
      it(`${city}：一类地区小时最低工资应为25.4元`, () => {
        expect(r.minimumWage.nonFullTimeHourly).toBeCloseTo(25.4, 1)
      })
    }
  }
})

/**
 * R1: 外部参数必须是官方原文值。
 * 这组断言存在的意义：早期版本里深圳直接抄了广州的医保基数、东莞抄了估算值，
 * 三城看上去"差不多"就没人发现。每个城市的每个数都必须锁死各自的官方口径。
 */
const OFFICIAL_PARAMS: Record<string, {
  pensionBaseMin: number
  pensionBaseMax: number
  medicalBaseMin: number
  medicalBaseMax: number
  medicalRate: number
  sourceKey: string
  docNo?: string
}> = {
  // 粤人社发〔2026〕24号：2026-01-01 起下限 5510；2026-07-01 起下限调整为 5521、上限 27603
  guangzhou: { pensionBaseMin: 5521, pensionBaseMax: 27603, medicalBaseMin: 6234, medicalBaseMax: 31170, medicalRate: 0.08, sourceKey: 'medical', docNo: '穗医保规字〔2026〕4号' },
  // 深圳市医疗保障局 2025-12-29 公告：下限 6727、上限 33633；灵活就业人员费率 2026-01-01 起恢复 8%
  shenzhen: { pensionBaseMin: 5521, pensionBaseMax: 27603, medicalBaseMin: 6727, medicalBaseMax: 33633, medicalRate: 0.08, sourceKey: 'medical' },
  // 东莞 2026年度医保缴费基数和费率表：下限 4775、上限 27549；单建统筹默认档 3.65%
  dongguan: { pensionBaseMin: 5521, pensionBaseMax: 27603, medicalBaseMin: 4775, medicalBaseMax: 27549, medicalRate: 0.0365, sourceKey: 'medical' },
}

describe('R1 外部参数必须是各城官方原文值', () => {
  for (const city of ['guangzhou', 'shenzhen', 'dongguan']) {
    const r = loadRuleFile(`${city}.json`)
    const exp = OFFICIAL_PARAMS[city]

    it(`${city}：养老基数上下限为粤人社发〔2026〕24号现行值`, () => {
      expect(r.benefit.pension.baseMin).toBe(exp.pensionBaseMin)
      expect(r.benefit.pension.baseMax).toBe(exp.pensionBaseMax)
    })

    it(`${city}：医保基数与费率取自本城医保部门原文，不得跨城抄值`, () => {
      expect(r.benefit.medical.baseMin).toBe(exp.medicalBaseMin)
      expect(r.benefit.medical.baseMax).toBe(exp.medicalBaseMax)
      expect(r.benefit.medical.rate).toBeCloseTo(exp.medicalRate, 4)
    })

    it(`${city}：医保来源已回溯官方原文（official 且带链接）`, () => {
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

/**
 * R1: 个税计算必须自述真实口径。
 * 引擎算的其实是年度汇算清缴（税率表一 + 累计减除 60000），
 * 而规则文件曾把它标注为「预扣率表二（劳务报酬）· 累计预扣」并挂了 61 号公告文号。
 * 61号公告原文：预扣率表二为 20%/30%/40%（速算扣除 0/2000/7000），与税率表一完全不同。
 */
describe('R1 个税税率表口径必须自述正确', () => {
  for (const city of ['guangzhou', 'shenzhen', 'dongguan']) {
    const r = loadRuleFile(`${city}.json`)

    it(`${city}：税率表标题标注为税率表一（综合所得），不得称预扣率表二`, () => {
      // 只查 title：note 里必须保留"若平台代扣应改用预扣率表二"的对比说明，那是有益的
      expect(r.sources.tax.title).toContain('税率表一')
      expect(r.sources.tax.title, `${city} 标题不得把税率表一标注为预扣率表二`).not.toContain('预扣率表二')
    })

    it(`${city}：note 说明了与平台代扣预扣口径的差异`, () => {
      expect(r.sources.tax.note).toContain('预扣率表二')
      expect(r.sources.tax.note).toContain('年度汇算清缴')
    })

    it(`${city}：method 为年度汇算口径而非累计预扣`, () => {
      expect(r.tax.method).toBe('annual_consolidated')
    })

    it(`${city}：税率表内容是税率表一（3%-45%，速算扣除 0/2520/16920）`, () => {
      const tb = r.tax.laborRemuneration.taxTable
      expect(tb[0].rate).toBe(0.03)
      expect(tb[1].deduction).toBe(2520)
      expect(tb[tb.length - 1].rate).toBe(0.45)
    })
  }
})

/** R2: 费用减除必须实现 4000 元分支（个人所得税扣缴申报管理办法第八条） */
describe('R2 劳务报酬费用减除的 4000 元分支', () => {
  const gz = loadRuleFile('guangzhou.json')

  it('月收入 3000（低于 4000）时按 800 元减除，而非 20%', () => {
    const t = new TaxEngine(gz.tax).calcLabor(new Array(12).fill(3000), 0)
    // 收入额 = 3000 - 800 = 2200；应纳税所得额 = 2200 - 5000 < 0 → 税额 0
    expect(t.annualTax).toBe(0)
  })

  it('月收入 8000（高于 4000）时按 20% 减除', () => {
    const t = new TaxEngine(gz.tax).calcLabor(new Array(12).fill(8000), 0)
    // 收入额 = 8000*0.8 = 6400；应纳税所得额 = 6400*12 - 5000*12 = 16800 → 3% 档
    expect(t.annualTax).toBeCloseTo(Math.round(16800 * 0.03 * 100) / 100, 2)
  })

  it('若错用 20% 减除，低收入场景会虚高计税所得——两分支必须不同', () => {
    const low = new TaxEngine(gz.tax).calcLabor(new Array(12).fill(3900), 0)
    const high = new TaxEngine(gz.tax).calcLabor(new Array(12).fill(4100), 0)
    // 3900 用 800 元分支后仍低于起征点；4100 用 20% 分支后同样低于起征点
    expect(low.annualTax).toBe(0)
    expect(high.annualTax).toBe(0)
  })

  it('4000 元阈值由规则文件承载，不写死在代码里', () => {
    expect(gz.tax.laborRemuneration.expenseDeductionFixed).toBe(800)
    expect(gz.tax.laborRemuneration.expenseDeductionThreshold).toBe(4000)
  })
})

/** R3: 非有限与越界输入不得产生 NaN 或 Infinity */
describe('R3 越界输入不得产生 NaN 或 Infinity', () => {
  const gz = loadRuleFile('guangzhou.json')
  const eng = new ScenarioEngine(gz)

  const allFinite = (v: unknown) => Number.isFinite(v)

  it('workDaysMonth=0 时不产生 NaN', () => {
    const r = eng.runScenario('x', 'x', { ...work, workDaysMonth: 0 }, costs, personal)
    expect(allFinite(r.income.grossIncome), 'grossIncome').toBe(true)
    expect(allFinite(r.netMonthly), 'netMonthly').toBe(true)
    expect(allFinite(r.netHourly), 'netHourly').toBe(true)
  })

  it('dailyHours=0 时不产生 Infinity', () => {
    const r = eng.runScenario('x', 'x', { ...work, dailyHours: 0 }, costs, personal)
    expect(allFinite(r.netHourly), 'netHourly').toBe(true)
  })

  it('负工作天数不产生符号矛盾（收入分项同号）', () => {
    const r = eng.runScenario('x', 'x', { ...work, workDaysMonth: -5 }, costs, personal)
    const parts = [r.income.basePay, r.income.distancePay, r.income.subsidyPay]
    const signs = new Set(parts.map(v => Math.sign(v)))
    expect(signs.size, `分项符号不一致: ${JSON.stringify(parts)}`).toBe(1)
  })

  it('NaN 输入被夹取为合法值而非传播', () => {
    const r = eng.runScenario('x', 'x', { ...work, dailyOrders: NaN, avgDistance: NaN }, costs, personal)
    expect(allFinite(r.income.grossIncome), 'grossIncome').toBe(true)
  })

  it('全极端参数下评分与评级仍可解释', () => {
    const r = eng.runScenario('x', '极端', { ...work, dailyHours: 0, workDaysMonth: 0, dailyOrders: 0 }, costs, personal)
    expect(allFinite(r.netMonthly)).toBe(true)
    expect(['recommended', 'viable', 'risky']).toContain(r.recommendation)
  })
})

/** R4: 用户选择的医保档次必须跨会话保留（hydrate 读写不对称） */
describe('R4 医保档次跨会话保留', () => {
  it('hydrate 不会丢弃可选键 medicalTierId（写入端存了、读取端必须能读回）', () => {
    // 键必须显式存在于 fallback：白名单取自 fallback 的键，缺键会静默丢弃
    const DEFAULT_PERSONAL: PersonalParams = {
      currentAge: 25, expectedRetireAge: 60, hasSocialInsurance: false, specialDeductionMonth: 0,
      medicalTierId: undefined, pensionBase: undefined, medicalBase: undefined,
    }
    const saved = { ...DEFAULT_PERSONAL, medicalTierId: 'combined_account' }
    const out = hydrate(saved, DEFAULT_PERSONAL)
    expect(out.medicalTierId).toBe('combined_account')
  })

  it('hydrate 同样保留自选缴费基数', () => {
    const DEFAULT_PERSONAL: PersonalParams = {
      currentAge: 25, expectedRetireAge: 60, hasSocialInsurance: false, specialDeductionMonth: 0,
      medicalTierId: undefined, pensionBase: undefined, medicalBase: undefined,
    }
    const out = hydrate({ ...DEFAULT_PERSONAL, pensionBase: 8000, medicalBase: 7000 }, DEFAULT_PERSONAL)
    expect(out.pensionBase).toBe(8000)
    expect(out.medicalBase).toBe(7000)
  })

  it('hydrate 夹取越界与非有限值，且不改动区间内的正常值', () => {
    const DEFAULT_PERSONAL: PersonalParams = {
      currentAge: 25, expectedRetireAge: 60, hasSocialInsurance: false, specialDeductionMonth: 0,
      medicalTierId: undefined, pensionBase: undefined, medicalBase: undefined,
    }
    const out = hydrate({ currentAge: NaN, expectedRetireAge: -5, specialDeductionMonth: Infinity }, DEFAULT_PERSONAL)
    expect(out.currentAge).toBe(DEFAULT_PERSONAL.currentAge)
    expect(out.expectedRetireAge).toBe(16)
    expect(out.specialDeductionMonth).toBe(DEFAULT_PERSONAL.specialDeductionMonth)
  })

  it('东莞规则确实提供该档次，且费率与默认值可区分', () => {
    const dg = loadRuleFile('dongguan.json')
    expect(dg.benefit.medicalTiers?.map(t => t.id)).toContain('combined_account')
    expect(dg.benefit.medicalTiers?.length).toBe(3)
  })
})

/** R5: 缴费基数可由用户在上下限内自选（粤人社规〔2026〕14号第六条） */
describe('R5 缴费基数可自选', () => {
  const gz = loadRuleFile('guangzhou.json')

  it('指定最低档基数时，养老月缴按 baseMin 而非实收收入夹取', () => {
    const eng = new BenefitEngine(gz.benefit)
    const r = eng.calcMonthly(30000, true, undefined, { pensionBase: gz.benefit.pension.baseMin, medicalBase: gz.benefit.medical.baseMin })
    expect(r.pensionMonthly).toBeCloseTo(gz.benefit.pension.baseMin * 0.2, 2)
    expect(r.medicalMonthly).toBeCloseTo(gz.benefit.medical.baseMin * 0.08, 2)
  })

  it('不指定基数时保持原有夹取行为（按申报收入，超上限时按上限）', () => {
    const eng = new BenefitEngine(gz.benefit)
    const r = eng.calcMonthly(30000, true)
    expect(r.pensionMonthly).toBeCloseTo(gz.benefit.pension.baseMax * 0.2, 2)
    // 区间内的申报额则按申报额计
    const mid = eng.calcMonthly(12000, true)
    expect(mid.pensionMonthly).toBeCloseTo(12000 * 0.2, 2)
  })

  it('自选低基数与按申报收入全额申报的差额，正是本产品要回答的核心问题', () => {
    const eng = new BenefitEngine(gz.benefit)
    const declared = eng.calcMonthly(30000, true)
    const chosen = eng.calcMonthly(30000, true, undefined, {
      pensionBase: gz.benefit.pension.baseMin,
      medicalBase: gz.benefit.medical.baseMin,
    })
    expect(chosen.pensionMonthly).toBeLessThan(declared.pensionMonthly)
    expect(declared.pensionMonthly - chosen.pensionMonthly).toBeGreaterThan(4000)
  })

  it('自选基数超出上下限时被夹取，不得逃逸出规则区间', () => {
    const eng = new BenefitEngine(gz.benefit)
    const low = eng.calcMonthly(9000, true, undefined, { pensionBase: 100 })
    expect(low.pensionMonthly).toBeCloseTo(gz.benefit.pension.baseMin * 0.2, 2)
    const high = eng.calcMonthly(9000, true, undefined, { pensionBase: 999999 })
    expect(high.pensionMonthly).toBeCloseTo(gz.benefit.pension.baseMax * 0.2, 2)
  })

  it('自选低基数会降低当期支出——这正是"参保划不划算"的关键变量', () => {
    const eng = new BenefitEngine(gz.benefit)
    const min = eng.calcMonthly(9000, true, undefined, { pensionBase: gz.benefit.pension.baseMin })
    const full = eng.calcMonthly(9000, true)
    expect(min.totalMonthly).toBeLessThan(full.totalMonthly)
  })
})

/** R6: API Key 不得在未告知下持久化；endpoint 必须校验 */
describe('R6 endpoint 校验与 Key 存储', () => {
  it('拒绝 http 明文 endpoint', () => {
    expect(validateEndpoint('http://example.com/v1/chat/completions').ok).toBe(false)
  })

  it('拒绝无法解析的 endpoint', () => {
    expect(validateEndpoint('not a url').ok).toBe(false)
  })

  it('拒绝相对路径 endpoint（会被解析到本站 origin）', () => {
    expect(validateEndpoint('/v1/chat/completions').ok).toBe(false)
  })

  it('接受 https endpoint 并返回 host 供 UI 告知用户', () => {
    const r = validateEndpoint('https://api.deepseek.com/v1/chat/completions')
    expect(r.ok).toBe(true)
    expect(r.host).toBe('api.deepseek.com')
  })

  it('拒绝内嵌用户名密码的 URL（钓鱼手法）', () => {
    expect(validateEndpoint('https://api.deepseek.com@evil.com/v1/chat/completions').ok).toBe(false)
  })
})

/** 跨项一致性：年度与月度净额必须闭合 */
describe('年度与月度净额闭合', () => {
  const gz = loadRuleFile('guangzhou.json')
  const eng = new ScenarioEngine(gz)

  it('netAnnual 与 netMonthly×12 的差在 0.1 元内', () => {
    for (const orders of [20, 35, 47, 60]) {
      const r = eng.runScenario('x', 'x', { ...work, dailyOrders: orders }, costs, personal)
      expect(Math.abs(r.netAnnual - r.netMonthly * 12), `orders=${orders}`).toBeLessThan(0.1)
    }
  })

  it('effectiveRate 为已取整的百分数，不再双重取整', () => {
    const r = eng.runScenario('x', 'x', work, costs, personal)
    const expected = Math.round(r.tax.annualTax / (r.income.grossIncome * 12) * 100 * 100) / 100
    expect(r.tax.effectiveRate).toBeCloseTo(expected, 2)
  })
})

/**
 * V1: 增值税与个人所得税必须分列且各挂自己的来源。
 * 原实现把「小规模纳税人增值税减按 1%」当成了个税核定征收率——
 * 两者是不同税种、不同文号、不同口径，混用会让个体户税负被系统性低估。
 */
describe('V1 个体户税负：增值税与个税口径分离', () => {
  for (const city of ['guangzhou', 'shenzhen', 'dongguan']) {
    const r = loadRuleFile(`${city}.json`)

    it(`${city}：个体户配置中增值税与个税是两个独立字段`, () => {
      const s = r.soleProprietorship
      expect(s, `${city} 缺 soleProprietorship 配置`).toBeTruthy()
      expect(s.vatRate, '增值税优惠税率').toBeCloseTo(0.01, 4)
      expect(typeof s.vatThresholdMonthly, '增值税起征点必须承载').toBe('number')
      expect(s.itrIncomeRate, '个税行业所得率').toBeGreaterThan(0)
      expect(s.itrIncomeRate).toBeLessThan(1)
    })

    it(`${city}：增值税与个税各自有官方来源，不共用一个 sources 条目`, () => {
      const r2 = loadRuleFile(`${city}.json`)
      expect(r2.sources.soleVat, '缺增值税来源').toBeTruthy()
      expect(r2.sources.soleVat.docNo, '增值税来源必须有文号').toContain('2026')
      expect(r2.sources.soleItr, '缺个税来源').toBeTruthy()
    })

    it(`${city}：个税来源必须说明按行业与地区核定，不存在全国统一税率`, () => {
      const r2 = loadRuleFile(`${city}.json`)
      expect(r2.sources.soleItr.note).toMatch(/行业|地区/)
    })

    it(`${city}：旧字段 tax.soleRate 已移除，避免与增值税税率混淆`, () => {
      const r2 = loadRuleFile(`${city}.json`)
      expect((r2.tax as unknown as Record<string, unknown>).soleRate).toBeUndefined()
    })
  }

  it('calcSoleProprietorship 按核定征收公式计算并闭合', () => {
    const gz = loadRuleFile('guangzhou.json')
    const sp = gz.soleProprietorship
    const profit = 1200000
    // 应纳税所得额 = 经营额 × 行业所得率 − 费用减除标准 × 12
    const taxable = Math.max(0, profit * sp.itrIncomeRate - 5000 * 12)
    expect(taxable).toBeGreaterThan(0)
    const t = new TaxEngine({ laborRemuneration: gz.tax.laborRemuneration, soleProprietorship: sp }).calcSoleProprietorship(profit)
    // 税额 = 应纳税所得额 × 税率 − 速算扣除数（5%-35% 经营所得税率表）
    const bracket = sp.bizTaxTable.find(b => taxable >= b.min && taxable < b.max) ?? sp.bizTaxTable[sp.bizTaxTable.length - 1]
    const expected = Math.round(Math.max(0, taxable * bracket.rate - bracket.deduction) * 100) / 100
    expect(t.annualTax).toBeCloseTo(expected, 1)
    // 12 期之和必须等于年度税额
    expect(t.monthlyTax.reduce((s, v) => s + v, 0)).toBeCloseTo(t.annualTax, 2)
    expect(t.method).toBe('sole_proprietorship')
  })

  it('calcSoleProprietorship 年度税额与公式手算值一致（非 12 期之和）', () => {
    const gz = loadRuleFile('guangzhou.json')
    const sp = gz.soleProprietorship
    const profit = 1200000
    const taxable = Math.max(0, profit * sp.itrIncomeRate - 5000 * 12)
    const bracket = sp.bizTaxTable.find(b => taxable >= b.min && taxable < b.max) ?? sp.bizTaxTable[sp.bizTaxTable.length - 1]
    const expected = Math.round(Math.max(0, taxable * bracket.rate - bracket.deduction) * 100) / 100
    const t = new TaxEngine({ laborRemuneration: gz.tax.laborRemuneration, soleProprietorship: sp }).calcSoleProprietorship(profit)
    // annualTax 必须等于公式手算值，而非 12 期 round 之和
    expect(t.annualTax).toBe(expected)
  })

  it('calcSoleProprietorship 的税率表来自规则文件而非代码写死', () => {
    const gz = loadRuleFile('guangzhou.json')
    expect(gz.soleProprietorship.bizTaxTable[0].rate).toBe(0.05)
    expect(gz.soleProprietorship.bizTaxTable[gz.soleProprietorship.bizTaxTable.length - 1].rate).toBe(0.35)
    expect(gz.soleProprietorship.itrDeductionMonthly).toBe(5000)
  })

  it('低收入个体户应纳税所得额为 0 时税额为 0', () => {
    const gz = loadRuleFile('guangzhou.json')
    // 60000 × 10% − 60000 = 0
    const t = new TaxEngine({ laborRemuneration: gz.tax.laborRemuneration, soleProprietorship: gz.soleProprietorship }).calcSoleProprietorship(60000)
    expect(t.annualTax).toBe(0)
  })

  /**
   * 占位值不得驱动节税结论。
   * 用未核实的行业所得率算出"省税多少"是不成立的——真实所得率更高时结论会反转。
   * 因此未核到本城有效税率表时，UI 必须只展示增值税（有国家层面统一文号）。
   */
  it('个税核定来源为 unverified 时，不得被当作可估算的税率', () => {
    for (const city of ['guangzhou', 'shenzhen', 'dongguan']) {
      const r = loadRuleFile(`${city}.json`)
      expect(r.sources.soleItr.confidence, `${city} 个税核定来源应为 unverified`).toBe('unverified')
      // UI 用它决定是否展示节税结论
      const verified = r.sources.soleItr.confidence === 'official'
      expect(verified, `${city} 不应被判定为可估算`).toBe(false)
    }
  })

  it('增值税来源为 official（国家层面统一文号），可独立于个税估算', () => {
    for (const city of ['guangzhou', 'shenzhen', 'dongguan']) {
      const r = loadRuleFile(`${city}.json`)
      expect(r.sources.soleVat.confidence).toBe('official')
      expect(r.sources.soleVat.docNo).toBe('财政部 税务总局公告2026年第10号')
    }
  })
})

/** V2: 峰时补贴必须按峰时段占比折算 */
describe('V2 峰时补贴按峰时段占比折算', () => {
  const gz = loadRuleFile('guangzhou.json')
  const peakHoursTotal = gz.income.timeSubsidy.peakHours.reduce((sum, r) => {
    const [a, b] = r.split('-').map(x => Number(x.slice(0, 2)))
    return sum + (b - a)
  }, 0)

  it('peakHours 合计为 6 小时', () => {
    expect(peakHoursTotal).toBe(6)
  })

  it('日均 10 小时时峰时补贴按 60% 折算，而非全额', () => {
    const inc = new IncomeEngine(gz.income).calcIncome(work)
    const dailyBase = (work.dailyOrders * gz.income.basePricePerOrder)
    const fullPeak = dailyBase * (gz.income.timeSubsidy.multiplier - 1)
    const expectedShare = peakHoursTotal / work.dailyHours
    // 峰时补贴部分 = 全额 × 占比；其余为雨天与节假日补贴，单独断言避免耦合
    expect(fullPeak * expectedShare).toBeCloseTo(fullPeak * 0.6, 2)
    expect(inc.subsidyPay).toBeLessThan(fullPeak * work.workDaysMonth)
  })

  it('工时正好等于峰时总时长时占比为 100%，与旧行为一致', () => {
    const inc = new IncomeEngine(gz.income).calcIncome({ ...work, dailyHours: 6 })
    const dailyBase = (work.dailyOrders * gz.income.basePricePerOrder)
    const fullPeak = dailyBase * (gz.income.timeSubsidy.multiplier - 1)
    expect(fullPeak * work.workDaysMonth).toBeCloseTo(fullPeak * work.workDaysMonth, 2)
  })

  it('工时远超峰时总时长时占比封顶为 100%，不会算出超过 100% 的补贴', () => {
    const inc = new IncomeEngine(gz.income).calcIncome({ ...work, dailyHours: 14 })
    const dailyBase = (work.dailyOrders * gz.income.basePricePerOrder)
    const fullPeak = dailyBase * (gz.income.timeSubsidy.multiplier - 1)
    // 折算后峰时补贴不得超过全额
    expect(inc.subsidyPay).toBeLessThanOrEqual(fullPeak * work.workDaysMonth + 1)
  })

  it('工时短于峰时总时长时占比封顶为 100%（峰时段被完全覆盖）', () => {
    const inc = new IncomeEngine(gz.income).calcIncome({ ...work, dailyHours: 4 })
    const dailyBase = (work.dailyOrders * gz.income.basePricePerOrder)
    const fullPeak = dailyBase * (gz.income.timeSubsidy.multiplier - 1)
    // 4h < 6h 峰时 → 占比 6/4=1.5 封顶为 1，峰时补贴等于全额
    expect(inc.subsidyPay).toBeGreaterThan(fullPeak * work.workDaysMonth * 0.5)
  })
})

/** 退休测算使用规则文件计发基数 */
describe('退休测算使用规则文件计发基数', () => {
  const base = loadRuleFile('guangzhou.json')

  it('基础养老金按 国发〔2005〕38号 公式 = 计发基数×(1+缴费指数)÷2×年限×1%', () => {
    const eng = new BenefitEngine(base.benefit, base.retirement)
    const r = eng.projectRetirement(25, 60, 1200, 15, 0.05, 0.6)
    const expected = base.retirement.benefitBaseMonthly * (1 + 0.6) / 2 * 15 * 0.01
    expect(r.basePension).toBeCloseTo(Math.round(expected * 100) / 100, 1)
  })

  it('个人账户养老金按 60 岁计发月数 139 除算', () => {
    const eng = new BenefitEngine(base.benefit, base.retirement)
    const r = eng.projectRetirement(25, 60, 1200, 15, 0.05, 0.6)
    expect(r.personalPension).toBeCloseTo(Math.round(r.personalAccount / 139 * 100) / 100, 2)
  })

  it('计发基数不同的两城，同输入必须得出不同的基础养老金', () => {
    const gz = new BenefitEngine(base.benefit, { ...base.retirement, benefitBaseMonthly: 9493 })
    const sz = new BenefitEngine(base.benefit, { ...base.retirement, benefitBaseMonthly: 11293 })
    const a = gz.projectRetirement(25, 60, 1200, 15, 0.05, 0.6)
    const b = sz.projectRetirement(25, 60, 1200, 15, 0.05, 0.6)
    expect(b.basePension).toBeGreaterThan(a.basePension)
  })

  it('缴费指数低于 0.6 时按 0.6 计（广东规则），不得算出更低的基础养老金', () => {
    const eng = new BenefitEngine(base.benefit, base.retirement)
    const low = eng.projectRetirement(25, 60, 1200, 15, 0.05, 0.3)
    const floor = eng.projectRetirement(25, 60, 1200, 15, 0.05, 0.6)
    expect(low.basePension).toBe(floor.basePension)
  })

  it('深圳计发基数单列为 11293，不得沿用全省 9493', () => {
    const sz = loadRuleFile('shenzhen.json')
    expect(sz.retirement.benefitBaseMonthly).toBe(11293)
  })

  it('广州与东莞沿用全省计发基数 9493', () => {
    for (const city of ['guangzhou', 'dongguan']) {
      const r = loadRuleFile(`${city}.json`)
      expect(r.retirement.benefitBaseMonthly, city).toBe(9493)
    }
  })
})
