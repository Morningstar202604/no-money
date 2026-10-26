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

/** 从 Result 提取成功类型 */
export type OkType<R> = R extends { ok: true; value: infer T } ? T : never;
/** 从 Result 提取错误类型 */
export type ErrType<R> = R extends { ok: false; error: infer E } ? E : never;

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

/** 从 Result 提取错误或抛出 */
export function unwrapErr<T, E>(result: Result<T, E>): E {
  if (!result.ok) return result.error;
  throw new Error('Attempted to unwrap Err on Ok');
}

/** 映射成功值 */
export function map<T, E, U>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

/** 映射错误值 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return result.ok ? result : err(fn(result.error));
}

/** 成功时继续链式调用（flatMap） */
export function flatMap<T, E, U>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
  return result.ok ? fn(result.value) : (result as unknown as Result<U, E>);
}

/** 失败时恢复 */
export function orElse<T, E, U>(result: Result<T, E>, fn: (error: E) => Result<U, E>): Result<U, E> {
  return result.ok ? (result as unknown as Result<U, E>) : fn(result.error);
}

/** 成功时执行副作用 */
export function tap<T, E>(result: Result<T, E>, fn: (value: T) => void): Result<T, E> {
  if (result.ok) fn(result.value);
  return result;
}

/** 失败时执行副作用 */
export function tapErr<T, E>(result: Result<T, E>, fn: (error: E) => void): Result<T, E> {
  if (!result.ok) fn(result.error);
  return result;
}

/** 获取值或返回默认值 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}

/** 获取值或由函数计算默认值 */
export function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
  return result.ok ? result.value : fn(result.error);
}

/** 转换为 Option 风格 */
export function toOption<T, E>(result: Result<T, E>): { some: true; value: T } | { some: false } {
  return result.ok ? { some: true, value: result.value } : { some: false };
}

/** 转换为数组（成功为单元素数组，失败为空数组） */
export function toArray<T, E>(result: Result<T, E>): T[] {
  return result.ok ? [result.value] : [];
}

/** 模式匹配 */
export function match<T, E, U>(result: Result<T, E>, onOk: (value: T) => U, onErr: (error: E) => U): U {
  return result.ok ? onOk(result.value) : onErr(result.error);
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

/** 包装异步函数自动捕获异常转为 Result */
export async function tryCatchAsync<T, E = Error>(
  fn: () => Promise<T>,
  errorTransformer?: (error: unknown) => Error,
): Promise<Result<T, Error>> {
  try {
    return ok(await fn());
  } catch (e) {
    // 与同步版 tryCatch 同口径：调用方传了 transformer 就必须生效
    return err(errorTransformer ? errorTransformer(e) : (e as Error));
  }
}

/** 从可选值创建 Result（无值时返回指定错误） */
export function fromNullable<T, E>(value: T | null | undefined, error: Error): Result<T, Error> {
  return value != null ? ok(value) : err(error);
}

/** 从布尔条件创建 Result */
export function fromPredicate<T, E>(value: T, predicate: (v: T) => boolean, error: Error): Result<T, Error> {
  return predicate(value) ? ok(value) : err(error);
}

/** 合并多个 Result（全成功返回值数组，任一失败返回首个错误） */
export function combine<T>(results: Array<Result<T, Error>>): Result<T[], Error> {
  for (const r of results) {
    if (!r.ok) return r;
  }
  // 此时所有结果都是 Ok<T>，安全转换
  const okResults = results as Array<{ ok: true; value: T }>;
  return ok(okResults.map(r => r.value));
}