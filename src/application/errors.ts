/**
 * Application layer error types
 * 统一应用层错误建模，替代 throw，便于类型推导与链式调用
 * @packageDocumentation
 */

/** 应用层错误码 */
export enum AppErrorCode {
  /** 输入参数校验失败 */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  /** 城市规则未找到或加载失败 */
  RULE_NOT_FOUND = 'RULE_NOT_FOUND',
  /** 规则数据不完整或格式错误 */
  RULE_INVALID = 'RULE_INVALID',
  /** 计算引擎执行失败 */
  ENGINE_ERROR = 'ENGINE_ERROR',
  /** 场景不存在 */
  SCENARIO_NOT_FOUND = 'SCENARIO_NOT_FOUND',
  /** 补偿场景不支持 */
  COMPENSATION_SCENE_UNSUPPORTED = 'COMPENSATION_SCENE_UNSUPPORTED',
  /** 权益评分计算失败 */
  RIGHTS_SCORE_ERROR = 'RIGHTS_SCORE_ERROR',
  /** 内部不一致（如年度/月度闭合校验失败） */
  INVARIANT_VIOLATION = 'INVARIANT_VIOLATION',
  /** 未知错误 */
  UNKNOWN = 'UNKNOWN',
}

/** 应用层错误基类 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: unknown;

  constructor(code: AppErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }

  /** 创建校验错误 */
  static validation(message: string, details?: unknown): AppError {
    return new AppError(AppErrorCode.VALIDATION_ERROR, message, details);
  }

  /** 创建规则未找到错误 */
  static ruleNotFound(city: string): AppError {
    return new AppError(AppErrorCode.RULE_NOT_FOUND, `City rule not found: ${city}`, { city });
  }

  /** 创建规则无效错误 */
  static ruleInvalid(city: string, reason: string): AppError {
    return new AppError(AppErrorCode.RULE_INVALID, `Invalid rule for ${city}: ${reason}`, { city, reason });
  }

  /** 创建引擎错误 */
  static engine(engine: string, message: string, details?: unknown): AppError {
    const extra = details && typeof details === 'object' ? (details as Record<string, unknown>) : {}
    return new AppError(AppErrorCode.ENGINE_ERROR, `[${engine}] ${message}`, { engine, ...extra });
  }

  /** 创建场景未找到错误 */
  static scenarioNotFound(id: string): AppError {
    return new AppError(AppErrorCode.SCENARIO_NOT_FOUND, `Scenario not found: ${id}`, { id });
  }

  /** 创建补偿场景不支持错误 */
  static compensationSceneUnsupported(scene: string): AppError {
    return new AppError(AppErrorCode.COMPENSATION_SCENE_UNSUPPORTED, `Compensation scene not supported: ${scene}`, { scene });
  }

  /** 创建权益评分错误 */
  static rightsScore(message: string, details?: unknown): AppError {
    return new AppError(AppErrorCode.RIGHTS_SCORE_ERROR, `Rights score error: ${message}`, details);
  }

  /** 创建不变式违反错误 */
  static invariantViolation(message: string, details?: unknown): AppError {
    return new AppError(AppErrorCode.INVARIANT_VIOLATION, `Invariant violation: ${message}`, details);
  }

  /** 创建未知错误 */
  static unknown(error: unknown): AppError {
    return new AppError(
      AppErrorCode.UNKNOWN,
      error instanceof Error ? error.message : String(error),
      { original: error instanceof Error ? error.message : String(error) },
    );
  }
}
