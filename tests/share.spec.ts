// URL 方案分享的编解码测试
//
// 这是把测算结果发给同行/家人的通道。编解码出错的表现是
// "对方打开链接后参数全变了"——比功能缺失更糟，因为它看起来能用。
// 这里锁定三类边界：中文/非 ASCII、篡改截断、字段白名单。
import { describe, it, expect } from 'vitest'
import { encodeShare, decodeShare, SHARE_PARAM } from '../src/utils/share'
import { DEFAULT_WORK, DEFAULT_COSTS, DEFAULT_PERSONAL, DEFAULT_CAPACITY } from '../src/kernel/calculate'

const base = () => ({
  work: { ...DEFAULT_WORK, dailyHours: 12, dailyOrders: 45, city: 'shenzhen' },
  costs: { ...DEFAULT_COSTS },
  personal: { ...DEFAULT_PERSONAL, currentAge: 31, hasSocialInsurance: true },
  capacityModel: { ...DEFAULT_CAPACITY },
  volatilityCv: 0.25,
})

describe('分享编码', () => {
  it('往返：编码后再解码，关键字段不变（含中文城市名以外的数值精度）', () => {
    const round = decodeShare('?' + SHARE_PARAM + '=' + encodeShare(base()))
    expect(round).not.toBeNull()
    expect(round!.work.city).toBe('shenzhen')
    expect(round!.work.dailyHours).toBe(12)
    expect(round!.work.dailyOrders).toBe(45)
    expect(round!.personal.currentAge).toBe(31)
    expect(round!.personal.hasSocialInsurance).toBe(true)
    // 回归：kernel 必须真的导出 DEFAULT_CAPACITY。漏导出时 esbuild 运行时
    // 是 undefined，{...undefined} 展开成空对象被编进分享 URL，对方打开后
    // 产能模型全丢——正是文件头注释说的「看起来能用」型缺陷。
    expect(round!.capacityModel).toEqual(DEFAULT_CAPACITY)
    expect(round!.volatilityCv).toBe(0.25)
  })

  it('URL-safe：编码结果不含 + / =（否则粘进微信会被转义）', () => {
    const code = encodeShare(base())
    expect(code).not.toMatch(/[+/=]/)
  })

  it('长度可控：默认参数编码后不超过 1500 字符（微信/短信可发）', () => {
    const url = 'https://x.example/?s=' + encodeShare(base())
    expect(url.length, `URL 长度 ${url.length} 过长`).toBeLessThanOrEqual(1500)
  })

  it('白名单：personal 里的敏感大字段（incomeOverrides）不会被带出去', () => {
    const p = base()
    ;(p.personal as Record<string, unknown>).incomeOverrides = { basePricePerOrder: 99 }
    const round = decodeShare('?' + SHARE_PARAM + '=' + encodeShare(p)) as unknown as Record<string, unknown>
    const personal = round!.personal as Record<string, unknown>
    expect(personal.incomeOverrides).toBeUndefined()
  })

  it('必填段缺失时编码抛错（调用方应隐藏分享入口而不是发出坏链接）', () => {
    // @ts-expect-error 故意传缺段对象
    expect(() => encodeShare({ work: {} })).toThrow(/work\/costs\/personal/)
  })
})

describe('分享解码（不可信输入）', () => {
  it('无参数返回 null，不抛错', () => {
    expect(decodeShare('')).toBeNull()
    expect(decodeShare('?other=1')).toBeNull()
  })

  it('篡改/截断的编码返回 null，而不是抛异常白屏', () => {
    const good = encodeShare(base())
    expect(decodeShare('?' + SHARE_PARAM + '=' + good.slice(0, good.length - 5))).toBeNull()
    expect(decodeShare('?' + SHARE_PARAM + '=!!!!not-base64!!!!')).toBeNull()
    expect(decodeShare('?' + SHARE_PARAM + '=' + 'e30')).toBeNull() // "{}"
  })

  it('超长参数拒绝处理（防恶意超链接）', () => {
    const junk = 'A'.repeat(5000)
    expect(decodeShare('?' + SHARE_PARAM + '=' + junk)).toBeNull()
  })

  it('字段缺失的合法 JSON 返回 null（缺 costs 不算可分享）', () => {
    // btoa("{}") 的 url-safe 形式
    const bare = btoa('{}').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(decodeShare('?' + SHARE_PARAM + '=' + bare)).toBeNull()
  })
})
