import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { ScenarioService } from '../../../src/application/scenario/ScenarioService';
import { IncomeEngine } from '../../../src/engine/IncomeEngine';
import { TaxEngine } from '../../../src/engine/TaxEngine';
import { BenefitEngine } from '../../../src/engine/BenefitEngine';
import type { CityRule, WorkParams, CostParams, PersonalParams } from '../../../src/types';
import { isOk, isErr, unwrap } from '../../../src/domain/shared/result';

const rule = JSON.parse(readFileSync('public/rules/guangzhou.json', 'utf8')) as CityRule;

const work: WorkParams = {
  city: 'guangzhou', dailyHours: 10, dailyOrders: 35,
  avgDistance: 2.5, workDaysMonth: 26, rainDaysMonth: 3, holidayDaysMonth: 2,
};
const costs: CostParams = {
  vehicleType: 'electric', fuelCostMonth: 0, electricityCostMonth: 300, maintenanceMonth: 200,
  insuranceMonth: 100, phoneCostMonth: 100, foodCostMonth: 800, trafficFineMonth: 50,
  vehicleDepreciationMonth: 300, otherCostMonth: 100,
};
const personal: PersonalParams = {
  currentAge: 25, expectedRetireAge: 60, hasSocialInsurance: false, specialDeductionMonth: 0,
};

describe('ScenarioService 集成测试', () => {
  let service: ScenarioService;

  beforeAll(() => {
    service = new ScenarioService(rule);
  });

  /** 基础场景：当前参数 */
  it('runScenario: 当前方案返回完整 ScenarioResult', () => {
    const result = service.runScenario({ id: 'current', name: '当前方案', work, costs, personal });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const r = result.value;
    expect(r.id).toBe('current');
    expect(r.name).toBe('当前方案');
    expect(r.income.grossIncome).toBeGreaterThan(0);
    expect(r.costBreakdown.total).toBeCloseTo(1950, 1);
    expect(r.tax.annualTax).toBeGreaterThanOrEqual(0);
    expect(r.benefit.totalMonthly).toBe(0); // 未参保
    expect(r.netMonthly).toBeCloseTo(r.income.grossIncome - r.costBreakdown.total - r.tax.annualTax / 12, 1);
    expect(r.netAnnual).toBeCloseTo(r.netMonthly * 12, 1);
    expect(r.netHourly).toBeGreaterThan(rule.minimumWage.nonFullTimeHourly);
    expect(r.rightsScore).toBeGreaterThanOrEqual(0);
    expect(r.rightsScore).toBeLessThanOrEqual(100);
    expect(r.rightsFlags.length).toBeGreaterThan(0);
    expect(['recommended', 'viable', 'risky']).toContain(r.recommendation);
    expect(r.keyInsights.length).toBeGreaterThan(0);
  });

  /** 参保场景：已参保 */
  it('runScenario: 已参保方案净收入降低但权益评分提高', () => {
    const plain = unwrap(service.runScenario({ id: 'current', name: '当前方案', work, costs, personal }));
    const insured = unwrap(service.runScenario({
      id: 'ins', name: '已参保', work, costs, personal: { ...personal, hasSocialInsurance: true }
    }));
    expect(insured.netMonthly).toBeLessThan(plain.netMonthly);
    expect(insured.rightsScore).toBeGreaterThan(plain.rightsScore);
    expect(insured.benefit.totalMonthly).toBeGreaterThan(0);
  });

  /** 产品伦理不变式：未参保方案不得被标为 recommended */
  it('runScenario: 未参保方案评级不得高于 viable', () => {
    const result = unwrap(service.runScenario({ id: 'current', name: '当前方案', work, costs, personal }));
    expect(result.recommendation).not.toBe('recommended');
    expect(result.rightsFlags.join()).toContain('社保');
  });

  /** 有效时薪不得低于当地非全日制小时最低工资 */
  it('runScenario: 有效时薪不低于非全日制最低工资', () => {
    const result = unwrap(service.runScenario({ id: 'current', name: '当前方案', work, costs, personal }));
    expect(result.netHourly).toBeGreaterThan(rule.minimumWage.nonFullTimeHourly);
  });

  /** 多接5单提高净收入 */
  it('runScenario: 多接5单提高净收入', () => {
    const plain = unwrap(service.runScenario({ id: 'current', name: '当前方案', work, costs, personal }));
    const more = unwrap(service.runScenario({
      id: 'more', name: '多接5单', work: { ...work, dailyOrders: 40 }, costs, personal
    }));
    expect(more.netMonthly).toBeGreaterThan(plain.netMonthly);
  });

  /** 多跑2小时：峰时折算导致补贴占比下降，净收入不单调递增 */
  it('runScenario: 多跑2小时峰时折算生效', () => {
    const short = unwrap(service.runScenario({ id: 's', name: '8小时', work: { ...work, dailyHours: 8 }, costs, personal }));
    const long = unwrap(service.runScenario({ id: 'l', name: '12小时', work: { ...work, dailyHours: 12 }, costs, personal }));
    // 8h → 占比 6/8=75%；12h → 占比 6/12=50%，后者峰时补贴更低
    expect(long.income.subsidyPay).toBeLessThan(short.income.subsidyPay);
  });

  /** 评分始终落在0-100 */
  it('runScenario: 极端参数下评分在0-100区间', () => {
    const extreme = unwrap(service.runScenario({
      id: 'x', name: '极端', work: { ...work, dailyHours: 14, workDaysMonth: 31 }, costs, personal
    }));
    expect(extreme.rightsScore).toBeGreaterThanOrEqual(0);
    expect(extreme.rightsScore).toBeLessThanOrEqual(100);
  });

  /** 年度与月度净额闭合 */
  it('runScenario: netAnnual 与 netMonthly×12 差在 0.1 元内', () => {
    for (const orders of [20, 35, 47, 60]) {
      const result = unwrap(service.runScenario({ id: 'x', name: 'x', work: { ...work, dailyOrders: orders }, costs, personal }));
      expect(Math.abs(result.netAnnual - result.netMonthly * 12)).toBeLessThan(0.1);
    }
  });

  /** compare 选出净收入最高的方案 */
  it('compare: 选出净收入最高方案并生成排序与摘要', () => {
    const scenarios = [
      { id: 'a', name: 'A', work, costs, personal },
      { id: 'b', name: 'B', work: { ...work, dailyOrders: 40 }, costs, personal },
      { id: 'c', name: 'C', work: { ...work, dailyOrders: 20 }, costs, personal },
    ];
    const result = service.compare({ scenarios });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const cmp = result.value;
    expect(cmp.scenarios.length).toBe(3);
    expect(cmp.best).not.toBeNull();
    expect(cmp.ranking.length).toBe(3);
    expect(cmp.ranking[0].netAnnual).toBeGreaterThanOrEqual(cmp.ranking[1].netAnnual);
    expect(cmp.ranking[1].netAnnual).toBeGreaterThanOrEqual(cmp.ranking[2].netAnnual);
    expect(cmp.summary).toContain(cmp.best!.name);
    expect(cmp.summary).toContain('年净收入');
    expect(cmp.summary).toContain('权益评分');
  });

  /** compare: 空数组返回错误 */
  it('compare: 空场景数组返回校验错误', () => {
    const result = service.compare({ scenarios: [] });
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  /** 输入校验：缺少必填字段 */
  it('runScenario: 缺少 id/name 返回校验错误', () => {
    const result = service.runScenario({ id: '', name: '', work, costs, personal });
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  /** 输入校验：非法数值 */
  it('runScenario: dailyHours<=0 返回校验错误', () => {
    const result = service.runScenario({ id: 'x', name: 'x', work: { ...work, dailyHours: 0 }, costs, personal });
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  /** 输入校验：年龄非法 */
  it('runScenario: currentAge<16 返回校验错误', () => {
    const result = service.runScenario({ id: 'x', name: 'x', work, costs, personal: { ...personal, currentAge: 15 } });
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  /** 输入校验：退休年龄小于当前年龄 */
  it('runScenario: expectedRetireAge <= currentAge 返回校验错误', () => {
    const result = service.runScenario({ id: 'x', name: 'x', work, costs, personal: { ...personal, expectedRetireAge: 20 } });
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  /** 构造函数校验：rule 为空抛出 */
  it('constructor: 无 rule 抛出错误', () => {
    expect(() => new ScenarioService(null as unknown as CityRule)).toThrow();
  });

  /**
   * 评级底线由本城最低工资推导，且按「缴社保前收入能力」判定：
   * 低于最低工资 = risky；超过最低工资 viable；超过 2 倍才 recommended。
   * 同步验证换城后底线确实跟着变（广州 2680、东莞 2300）。
   */
  it('runScenario: 评级底线随本城最低工资变化，而非固定 7000/4500', () => {
    const lowNet = { ...work, dailyOrders: 20, dailyHours: 5 };
    const gz = unwrap(service.runScenario({ id: 'gz', name: 'gz', work: lowNet, costs, personal: { ...personal, hasSocialInsurance: true } }));
    const gzCapacity = gz.netMonthly + gz.benefit.totalMonthly;
    const gzFloor = rule.minimumWage.monthly;
    if (gzCapacity <= gzFloor) expect(gz.recommendation).toBe('risky');
    else if (gzCapacity <= gzFloor * 2) expect(gz.recommendation).toBe('viable');
    else expect(gz.recommendation).toBe('recommended');

    // 同一组参数在最低工资更低的城市，判定所用底线不同（东莞 2300 ≠ 广州 2680）
    const dgRule = JSON.parse(readFileSync('public/rules/dongguan.json', 'utf8')) as CityRule;
    expect(dgRule.minimumWage.monthly).not.toBe(gzFloor);
    const dgService = new ScenarioService(dgRule);
    const dg = unwrap(dgService.runScenario({ id: 'dg', name: 'dg', work: { ...lowNet, city: 'dongguan' }, costs, personal: { ...personal, hasSocialInsurance: true } }));
    const dgCapacity = dg.netMonthly + dg.benefit.totalMonthly;
    const dgFloor = dgRule.minimumWage.monthly;
    if (dgCapacity <= dgFloor) expect(dg.recommendation).toBe('risky');
    else if (dgCapacity <= dgFloor * 2) expect(dg.recommendation).toBe('viable');
    else expect(dg.recommendation).toBe('recommended');
  });
});

describe('用户实测计价覆盖（把「占位假设」变成「我的数据」）', () => {
  const baseInput = {
    id: 'ov',
    name: '覆盖测试',
    work: {
      city: 'guangzhou', dailyHours: 10, dailyOrders: 35, avgDistance: 2.5,
      workDaysMonth: 26, rainDaysMonth: 3, holidayDaysMonth: 2,
    },
    costs: {
      vehicleType: 'electric' as const, fuelCostMonth: 0, electricityCostMonth: 300,
      maintenanceMonth: 200, insuranceMonth: 100, phoneCostMonth: 100, foodCostMonth: 800,
      trafficFineMonth: 50, vehicleDepreciationMonth: 300, otherCostMonth: 100,
    },
    personal: {
      currentAge: 25, expectedRetireAge: 60, hasSocialInsurance: false, specialDeductionMonth: 0,
    },
  }

  const rule = JSON.parse(readFileSync('public/rules/guangzhou.json', 'utf8')) as CityRule

  it('未填覆盖时，计价字段被标为未核实（现状基线）', () => {
    const svc = new ScenarioService(rule)
    const r = svc.runScenario(baseInput)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.dataQuality.provisional).toBe(true)
      expect(r.value.dataQuality.unverifiedFields).toContain('计价单价/补贴')
    }
  })

  it('填写覆盖后：计价字段转为「用户实测」，不再计入假设测算', () => {
    const svc = new ScenarioService(rule, { basePricePerOrder: 6, distanceRate: 1.5 })
    const r = svc.runScenario(baseInput)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.dataQuality.unverifiedFields).not.toContain('计价单价/补贴')
      expect(r.value.dataQuality.overriddenFields).toContain('计价单价/补贴')
      // 覆盖计价后是否仍算假设测算，取决于其余依赖项的置信度。
      // 广州养老金计发基数是 derived（据官方口径推算，非直接发布值），
      // 而它直接决定退休页的基础养老金——因此整体仍应为 provisional，
      // 但未核实清单里不应再包含计价，且必须包含计发基数。
      const uf = r.value.dataQuality.unverifiedFields
      expect(uf).toContain('养老金计发基数')
      expect(r.value.dataQuality.overriddenFields).toContain('计价单价/补贴')
    }
  })

  it('覆盖单价真的进入收入：6 元/单的毛收入高于 5 元/单占位值', () => {
    const base = new ScenarioService(rule)
    const over = new ScenarioService(rule, { basePricePerOrder: 6 })
    const a = base.runScenario(baseInput)
    const b = over.runScenario(baseInput)
    expect(a.ok && b.ok).toBe(true)
    if (a.ok && b.ok) {
      // 基础计件差额 35 单 × 26 天 × 1 元 = 910 元；此外日基础上涨会按倍率
      // 连带抬高峰时与雨天补贴（补贴以日基础为基数），故总差额应大于 910
      const diff = b.value.income.grossIncome - a.value.income.grossIncome
      expect(diff).toBeGreaterThanOrEqual(910)
      expect(b.value.income.basePay - a.value.income.basePay).toBeCloseTo(910, 0)
      expect(b.value.income.basePay).toBeGreaterThan(a.value.income.basePay)
    }
  })

  it('超重加价：填写单均重量且超过阈值时产生 weightPay，并被计入毛收入', () => {
    const svc = new ScenarioService(rule)
    const r = svc.runScenario({
      ...baseInput,
      personal: { ...baseInput.personal, incomeOverrides: { avgWeightKg: 8 } },
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      const threshold = rule.income.weightSurcharge.threshold
      const rate = rule.income.weightSurcharge.rate
      const expected = Math.round((8 - threshold) * rate * 35 * 26)
      expect(r.value.income.weightPay).toBeCloseTo(expected, 0)
      const sum = r.value.income.basePay + r.value.income.distancePay + r.value.income.weightPay
        + r.value.income.subsidyPay + r.value.income.bonusPay
      expect(sum, '收入分项之和必须等于毛收入（表内与图表一致）').toBeCloseTo(r.value.income.grossIncome, 0)
    }
  })

  it('不填单均重量时不计超重（避免凭空多算）', () => {
    const svc = new ScenarioService(rule)
    const r = svc.runScenario(baseInput)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.income.weightPay).toBe(0)
  })
})
