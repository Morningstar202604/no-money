/**
 * 应用层错误工厂：错误码与 details 是 API / CLI / MCP 共用的对外契约。
 * 不能只测「能 new 出来」，要锁住每个工厂的 code、文案与附加字段。
 */
import { describe, it, expect } from 'vitest'
import { AppError, AppErrorCode } from '../../src/application/errors'

describe('AppError 工厂', () => {
  it('validation / ruleNotFound / ruleInvalid / scenarioNotFound / compensationSceneUnsupported', () => {
    const validation = AppError.validation('bad input', { field: 'age' })
    expect(validation).toBeInstanceOf(AppError)
    expect(validation.code).toBe(AppErrorCode.VALIDATION_ERROR)
    expect(validation.details).toEqual({ field: 'age' })

    expect(AppError.ruleNotFound('guangzhou').code).toBe(AppErrorCode.RULE_NOT_FOUND)
    expect(AppError.ruleNotFound('guangzhou').message).toContain('guangzhou')
    expect(AppError.ruleInvalid('guangzhou', 'missing tax').code).toBe(AppErrorCode.RULE_INVALID)
    expect(AppError.scenarioNotFound('conservative').code).toBe(AppErrorCode.SCENARIO_NOT_FOUND)
    expect(AppError.compensationSceneUnsupported('injury').code).toBe(AppErrorCode.COMPENSATION_SCENE_UNSUPPORTED)
  })

  it('engine 合并对象 details，非对象 details 不污染字段', () => {
    const extra = AppError.engine('tax', 'bracket missing', { bracket: '45%' })
    expect(extra.code).toBe(AppErrorCode.ENGINE_ERROR)
    expect(extra.details).toMatchObject({ engine: 'tax', bracket: '45%' })

    const scalar = AppError.engine('tax', 'bracket missing', 'raw detail')
    expect(scalar.details).toEqual({ engine: 'tax' })
  })

  it('rightsScore / invariantViolation 保留 details', () => {
    const score = AppError.rightsScore('negative score', { score: -1 })
    expect(score.code).toBe(AppErrorCode.RIGHTS_SCORE_ERROR)
    expect(score.details).toEqual({ score: -1 })

    const invariant = AppError.invariantViolation('annual mismatch', { diff: 3 })
    expect(invariant.code).toBe(AppErrorCode.INVARIANT_VIOLATION)
    expect(invariant.details).toEqual({ diff: 3 })
  })

  it('unknown 同时接受 Error 与字符串', () => {
    const fromError = AppError.unknown(new Error('network down'))
    expect(fromError.code).toBe(AppErrorCode.UNKNOWN)
    expect(fromError.message).toBe('network down')
    expect(fromError.details).toEqual({ original: 'network down' })

    const fromString = AppError.unknown('raw failure')
    expect(fromString.message).toBe('raw failure')
    expect(fromString.details).toEqual({ original: 'raw failure' })
  })
})
