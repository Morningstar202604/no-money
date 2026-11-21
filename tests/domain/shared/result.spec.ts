/**
 * Result 是应用层替代 throw 的统一返回类型。
 * 这里锁住「成功/失败必须能无歧义地区分」，避免调用方靠 truthy 判断踩空。
 */
import { describe, it, expect } from 'vitest'
import { ok, err, isOk, isErr, unwrap, tryCatch } from '../../../src/domain/shared/result'

describe('Result', () => {
  it('ok / err 保留原始值', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 })
    expect(err('boom')).toEqual({ ok: false, error: 'boom' })
  })

  it('isOk / isErr 是互斥的类型守卫', () => {
    const success = ok('value')
    const failure = err(new Error('bad'))
    expect(isOk(success)).toBe(true)
    expect(isErr(success)).toBe(false)
    expect(isOk(failure)).toBe(false)
    expect(isErr(failure)).toBe(true)
  })

  it('unwrap 成功时返回值，失败时抛错并带上原因', () => {
    expect(unwrap(ok(7))).toBe(7)
    expect(() => unwrap(err('missing'))).toThrow('Attempted to unwrap Err: missing')
  })

  it('tryCatch 把同步异常折叠成 Err', () => {
    expect(tryCatch(() => 1 + 1)).toEqual({ ok: true, value: 2 })

    const failure = tryCatch(() => { throw new Error('disk full') })
    expect(failure.ok).toBe(false)
    if (!failure.ok) expect(failure.error).toBeInstanceOf(Error)

    const transformed = tryCatch(
      () => { throw new Error('raw') },
      (e) => `wrapped: ${(e as Error).message}`,
    )
    expect(transformed).toEqual({ ok: false, error: 'wrapped: raw' })
  })
})
