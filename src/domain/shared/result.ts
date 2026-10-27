/**
 * Result<T, E> 统一错误处理
 * 替代 throw，显式建模成功/失败，便于类型推导与链式调用
 * @packageDocumentation
 */

/** 成功结果 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/** 失败结果 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/** Result 联合类型：要么成功包含 T，要么失败包含 E */
export type Result<T, E> = Ok<T> | Err<E>;

/** 创建成功结果 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/** 创建失败结果 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/** 类型守卫：检查是否为成功 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

/** 类型守卫：检查是否为失败 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}

/** 从 Result 提取值或抛出 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw new Error(`Attempted to unwrap Err: ${result.error}`);
}

/**
 * 包装函数自动捕获异常转为 Result
 *
 * 泛型 E 由调用点的返回类型推断得出：传入 errorTransformer 时必须返回 E，
 * 否则回退为 Error。仅传 fn 时 E 默认为 Error。
 */
export function tryCatch<T, E = Error>(
  fn: () => T,
  errorTransformer?: (error: unknown) => E,
): Result<T, E> {
  try {
    return ok(fn());
  } catch (e) {
    return err(errorTransformer ? errorTransformer(e) : (e as E));
  }
}

