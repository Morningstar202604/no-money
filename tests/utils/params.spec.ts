/**
 * hydrateParams 严格性测试。
 *
 * 背景：localStorage 与导入文件里可能出现 null、字符串数字、布尔值。
 * 曾把严格 clamp 合并成 clampNumber（内部 Number(v) 强制转换），
 * 导致 "8" → 8、null → 0、true → 1——参数被静默改写而不是回退默认值。
 * 这组测试锁定「非 number 一律回退 fallback」的语义。
 */

import { describe, it, expect } from 'vitest'
import { hydrateParams, PARAM_BOUNDS } from '../../src/utils/params'
import { round2, formatDivide, safeDivide, clampNumber } from '../../src/domain/shared/number'

const FALLBACK = { dailyHours: 10, dailyOrders: 35, city: 'guangzhou' }

describe('hydrateParams：类型与边界', () => {
  it('字符串数字不被接受（防止 "8" 被当成 8）', () => {
    const r = hydrateParams({ dailyHours: '8' }, FALLBACK)
    expect(r.dailyHours).toBe(10)
  })

  it('null 不被当成 0（防止静默改成最小值）', () => {
    const r = hydrateParams({ dailyHours: null, dailyOrders: null }, FALLBACK)
    expect(r.dailyHours).toBe(10)
    expect(r.dailyOrders).toBe(35)
  })

  it('布尔值不被当成 1/0', () => {
    const r = hydrateParams({ dailyHours: true }, FALLBACK)
    expect(r.dailyHours).toBe(10)
  })

  it('NaN / Infinity 回退 fallback', () => {
    expect(hydrateParams({ dailyHours: NaN }, FALLBACK).dailyHours).toBe(10)
    expect(hydrateParams({ dailyHours: Infinity }, FALLBACK).dailyHours).toBe(10)
  })

  it('合法数字原样保留', () => {
    expect(hydrateParams({ dailyHours: 8 }, FALLBACK).dailyHours).toBe(8)
  })

  it('越界数字被夹到边界（不是回退默认）', () => {
    const [min, max] = PARAM_BOUNDS.work.dailyHours
    expect(hydrateParams({ dailyHours: 999 }, FALLBACK).dailyHours).toBe(max)
    expect(hydrateParams({ dailyHours: -5 }, FALLBACK).dailyHours).toBe(min)
  })

  it('未知键被丢弃（白名单机制）', () => {
    const r = hydrateParams({ evilKey: 'x', dailyHours: 8 }, FALLBACK) as Record<string, unknown>
    expect(r.evilKey).toBeUndefined()
    expect(r.dailyHours).toBe(8)
  })

  it('非法 city 回退 fallback', () => {
    expect(hydrateParams({ city: 'NOT_A_CITY' }, FALLBACK).city).toBe('guangzhou')
    expect(hydrateParams({ city: '../etc/passwd' }, FALLBACK).city).toBe('guangzhou')
  })
})

describe('数值工具边界（domain/shared/number）', () => {
  it('round2 对称处理正负半值与浮点误差', () => {
    // 实现是「绝对值四舍五入后还原符号」= 远离零方向，正负对称
    expect(round2(1.005)).toBe(1.01)
    expect(round2(-1.005)).toBe(-1.01)
    expect(round2(-1.004)).toBe(-1)
    expect(round2(NaN)).toBe(0)
  })

  it('formatDivide 不把 Infinity/NaN 渲染上屏', () => {
    expect(formatDivide(10, 0, 2)).toBe('0')
    expect(formatDivide(NaN, 2, 1)).toBe('0')
    expect(formatDivide(10, 4, 2)).toBe('2.50')
  })

  it('safeDivide 分母为 0 返回 0', () => {
    expect(safeDivide(10, 0)).toBe(0)
    expect(safeDivide(10, 4)).toBe(2.5)
  })

  it('clampNumber 对非有限值回退 fallback', () => {
    expect(clampNumber(NaN, 0, 10, 5)).toBe(5)
    expect(clampNumber(99, 0, 10, 5)).toBe(10)
    expect(clampNumber(3, 0, 10, 5)).toBe(3)
  })
})
