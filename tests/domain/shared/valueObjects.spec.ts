/**
 * 分/税率边界：这些是全部金额计算的底层单位。
 * 这里不验证业务公式，只锁「非法输入不能变成 NaN 漏进上层」。
 */
import { describe, it, expect } from 'vitest'
import {
  Cent,
  Rate,
  yuanToCent,
  centToYuan,
  addCent,
  subCent,
  mulCentRate,
  divCent,
  maxCent,
  minCent,
  nonNegCent,
  safeCent,
  safeRate,
} from '../../../src/domain/shared/value-objects'

const cent = (yuan: number) => yuanToCent(yuan)
const rate = (decimal: number) => Rate.create(decimal)

describe('Cent / Rate 品牌守卫', () => {
  it('Cent 只接受有限数字', () => {
    expect(Cent.is(100)).toBe(true)
    expect(Cent.is(0)).toBe(true)
    expect(Cent.is(-1)).toBe(true)
    expect(Cent.is(Number.NaN)).toBe(false)
    expect(Cent.is(Number.POSITIVE_INFINITY)).toBe(false)
    expect(Cent.is('100')).toBe(false)
  })

  it('Rate 只接受 0–1 的有限数字', () => {
    expect(Rate.is(0.03)).toBe(true)
    expect(Rate.is(0)).toBe(true)
    expect(Rate.is(1)).toBe(true)
    expect(Rate.is(-0.01)).toBe(false)
    expect(Rate.is(1.01)).toBe(false)
    expect(Rate.is(Number.NaN)).toBe(false)
    expect(Rate.is(Number.POSITIVE_INFINITY)).toBe(false)
    expect(Rate.is('0.03')).toBe(false)
  })
})

describe('元 / 分转换', () => {
  it('按四舍五入转分，非法值归零', () => {
    expect(Number(yuanToCent(12.345))).toBe(1235)
    expect(Number(yuanToCent(-12.34))).toBe(-1234)
    expect(Number(yuanToCent(Number.NaN))).toBe(0)
    expect(Number(yuanToCent(Number.POSITIVE_INFINITY))).toBe(0)
  })

  it('分转元只做显示', () => {
    expect(centToYuan(cent(12.34))).toBe(12.34)
    expect(centToYuan(cent(-1))).toBe(-1)
  })
})

describe('金额运算', () => {
  it('加减乘保持分单位', () => {
    expect(Number(addCent(cent(1), cent(2)))).toBe(300)
    expect(Number(subCent(cent(3), cent(1)))).toBe(200)
    expect(Number(mulCentRate(cent(100), rate(0.03)))).toBe(300)
  })

  it('除法遇到 0 / NaN / Infinity 返回 0', () => {
    expect(Number(divCent(cent(100), 4))).toBe(2500)
    expect(Number(divCent(cent(100), 0))).toBe(0)
    expect(Number(divCent(cent(100), Number.NaN))).toBe(0)
    expect(Number(divCent(cent(100), Number.POSITIVE_INFINITY))).toBe(0)
  })

  it('最大/最小/非负保护', () => {
    expect(Number(maxCent(cent(1), cent(2)))).toBe(200)
    expect(Number(minCent(cent(1), cent(2)))).toBe(100)
    expect(Number(nonNegCent(cent(-5)))).toBe(0)
    expect(Number(nonNegCent(cent(5)))).toBe(500)
  })
})

describe('安全转换', () => {
  it('safeCent 把非有限值归零', () => {
    expect(Number(safeCent(123.4))).toBe(123.4)
    expect(Number(safeCent(Number.NaN))).toBe(0)
    expect(Number(safeCent(Number.NEGATIVE_INFINITY))).toBe(0)
  })

  it('safeRate 非有限值归零、越界截断', () => {
    expect(Number(safeRate(0.03))).toBe(0.03)
    expect(Number(safeRate(-0.2))).toBe(0)
    expect(Number(safeRate(1.2))).toBe(1)
    expect(Number(safeRate(Number.NaN))).toBe(0)
    expect(Number(safeRate(Number.POSITIVE_INFINITY))).toBe(0)
  })
})
