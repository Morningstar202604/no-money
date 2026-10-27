/**
 * 劳务报酬预扣预缴模型测试。
 *
 * 基准全部手算，依据国家税务总局公告 2018 年第 61 号附件 2 预扣率表二：
 *   收入 ≤ 4000：应纳税所得额 = 收入 - 800
 *   收入 > 4000：应纳税所得额 = 收入 × 80%
 *   税率 20%（≤20000）/ 30%（20000–50000，速算扣除 2000）/ 40%（>50000，速算扣除 7000）
 */

import { describe, it, expect } from 'vitest'
import {
  calcWithholdingPerPayment,
  calcMonthlyWithholding,
  settlementDelta,
  withholdingTaxablePerPayment,
  WITHHOLDING_TABLE,
} from '../../../src/domain/tax/withholding'
import { yuanToCent, Cent } from '../../../src/domain/shared/value-objects'

const yuan = (n: number) => yuanToCent(n)
const toYuan = (c: { toString(): string } | number) => Number(c) / 100

describe('劳务报酬预扣：单次计算（61号公告预扣率表二）', () => {
  it('3000 元：减 800 后按 20% = 440 元', () => {
    expect(toYuan(calcWithholdingPerPayment(yuan(3000)))).toBe(440)
    expect(toYuan(withholdingTaxablePerPayment(yuan(3000)))).toBe(2200)
  })

  it('4000 元边界：仍按定额 800（不超过 4000），税额 = 3200 × 20% = 640 元', () => {
    expect(toYuan(calcWithholdingPerPayment(yuan(4000)))).toBe(640)
  })

  it('4000.01 元边界：改用 20% 定率，应纳税所得额 3200.008 → 税额约 640.0016', () => {
    const tax = toYuan(calcWithholdingPerPayment(yuan(4000.01)))
    expect(tax).toBeGreaterThan(639.99)
    expect(tax).toBeLessThan(640.02)
  })

  it('8000 元：8000 × 80% = 6400 应纳所得 × 20% = 1280 元', () => {
    expect(toYuan(calcWithholdingPerPayment(yuan(8000)))).toBe(1280)
    expect(toYuan(withholdingTaxablePerPayment(yuan(8000)))).toBe(6400)
  })

  it('25000 元：应纳所得 20000，恰好 20% 档上限 → 4000 元', () => {
    expect(toYuan(calcWithholdingPerPayment(yuan(25000)))).toBe(4000)
  })

  it('31250 元：应纳所得 25000 进入 30% 档 → 25000×30% - 2000 = 5500 元', () => {
    expect(toYuan(calcWithholdingPerPayment(yuan(31250)))).toBe(5500)
  })

  it('62500 元：应纳所得 50000，30% 档上限 → 50000×30% - 2000 = 13000 元', () => {
    expect(toYuan(calcWithholdingPerPayment(yuan(62500)))).toBe(13000)
  })

  it('80000 元：应纳所得 64000 进入 40% 档 → 64000×40% - 7000 = 18600 元', () => {
    expect(toYuan(calcWithholdingPerPayment(yuan(80000)))).toBe(18600)
  })

  it('零/负/非有限输入返回 0，不产生 NaN', () => {
    expect(Number(calcWithholdingPerPayment(yuan(0)))).toBe(0)
    expect(Number(calcWithholdingPerPayment(yuan(-100)))).toBe(0)
    expect(Number(calcWithholdingPerPayment(Cent.create(NaN)))).toBe(0)
    expect(Number(calcWithholdingPerPayment(Cent.create(Infinity)))).toBe(0)
  })

  it('预扣率表二结构固定为国家统一口径（防止被误改为城市差异）', () => {
    expect(WITHHOLDING_TABLE.map(b => b.rate)).toEqual([0.2, 0.3, 0.4])
    expect(WITHHOLDING_TABLE.map(b => b.deduction)).toEqual([0, 2000, 7000])
  })
})

describe('劳务报酬预扣：月度与双口径差异', () => {
  it('每月结算 1 次：月预扣 = 单次税额', () => {
    const r = calcMonthlyWithholding(yuan(8856.25), 1)
    expect(toYuan(r.monthlyWithheld)).toBe(toYuan(calcWithholdingPerPayment(yuan(8856.25))))
    expect(toYuan(r.annualWithheld)).toBe(toYuan(r.monthlyWithheld) * 12)
  })

  it('每月结算 4 次（按周）：每笔更小，但总额可能低于单次结算（因为 800 定额可重复享受）', () => {
    const once = calcMonthlyWithholding(yuan(8000), 1)
    const fourTimes = calcMonthlyWithholding(yuan(8000), 4)
    // 单次 8000 → 6400×20% = 1280；四次各 2000 → 各 1200×20% = 240，合计 960
    expect(toYuan(once.monthlyWithheld)).toBe(1280)
    expect(toYuan(fourTimes.monthlyWithheld)).toBe(960)
    expect(toYuan(fourTimes.monthlyWithheld)).toBeLessThan(toYuan(once.monthlyWithheld))
  })

  it('预扣次数越多、单笔越小，总预扣越低（4000 以下定额 800 可反复适用）', () => {
    const a = toYuan(calcMonthlyWithholding(yuan(6000), 1).monthlyWithheld)
    const b = toYuan(calcMonthlyWithholding(yuan(6000), 2).monthlyWithheld)
    expect(b).toBeLessThan(a)
  })

  it('settlementDelta：预扣多于汇算应缴时为正（可退）', () => {
    expect(toYuan(settlementDelta(yuan(17000), yuan(750)))).toBe(16250)
  })

  it('settlementDelta：预扣少于汇算应缴时为负（需补）', () => {
    expect(toYuan(settlementDelta(yuan(500), yuan(1200)))).toBe(-700)
  })
})
