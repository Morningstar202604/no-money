/**
 * 城市 → 省份映射测试。
 *
 * 背景：工伤口径、法律依据、办事入口、法援资源都按「省」判定。
 * 此前用 `new Set(['guangzhou','shenzhen','dongguan'])` 判广东，
 * 佛山/珠海/中山（同属广东、同适用《广东省工伤保险条例》）被当成外省，
 * 用户做工伤测算时拿不到医疗/就业补助金月数。
 */

import { describe, it, expect } from 'vitest'
import { provinceOf, isGuangdongCity } from '../../src/data/provinces'
import { CITY_REGISTRY } from '../../src/data/cities'

describe('provinceOf：城市标识 → 省份', () => {
  it('接受城市 id（guangzhou）', () => {
    expect(provinceOf('guangzhou')).toBe('广东')
    expect(provinceOf('beijing')).toBe('北京')
    expect(provinceOf('wulumuqi')).toBe('新疆')
  })

  it('接受城市名（广州）与带「市」后缀的文书城市（广州市）', () => {
    expect(provinceOf('广州')).toBe('广东')
    expect(provinceOf('广州市')).toBe('广东')
    expect(provinceOf('乌鲁木齐市')).toBe('新疆')
  })

  it('无规则文件但常用务工城市也能判定省份（佛山/珠海/中山属广东）', () => {
    for (const city of ['佛山', '珠海', '中山', '惠州市']) {
      expect(provinceOf(city), `${city} 应归广东`).toBe('广东')
    }
  })

  it('未收录城市返回 null，不默认当成广东', () => {
    expect(provinceOf('不存在的城市')).toBeNull()
    expect(provinceOf('')).toBeNull()
    expect(provinceOf(undefined)).toBeNull()
    expect(provinceOf(null)).toBeNull()
  })

  it('注册表里 34 城都能映射到省份，且与注册表自身 province 字段一致', () => {
    for (const c of CITY_REGISTRY) {
      expect(provinceOf(c.value), `${c.label} 映射失败`).toBe(c.province)
      expect(provinceOf(c.label)).toBe(c.province)
    }
  })
})

describe('isGuangdongCity：决定是否引用广东省地方性法规', () => {
  it('广东 3 个内置城市与 3 个省内补充城市都为 true', () => {
    for (const city of ['guangzhou', 'shenzhen', 'dongguan', '佛山市', '珠海', '中山']) {
      expect(isGuangdongCity(city), `${city} 应判定为广东`).toBe(true)
    }
  })

  it('非广东城市为 false（含北京/上海/成都）', () => {
    for (const city of ['beijing', 'shanghai', 'chengdu', '北京', '成都市']) {
      expect(isGuangdongCity(city), `${city} 不应判定为广东`).toBe(false)
    }
  })

  it('未知城市不得被当成广东（避免错误引用广东条例）', () => {
    expect(isGuangdongCity('火星市')).toBe(false)
    expect(isGuangdongCity(null)).toBe(false)
  })
})
