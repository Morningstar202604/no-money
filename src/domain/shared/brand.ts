/**
 * Brand 类型工具
 * 用于创建不可互换的名义类型，防止同类型不同语义的值被误用
 * @packageDocumentation
 */

/**
 * 品牌标记，用于区分同底层类型的不同语义类型
 * @typeParam T - 底层类型
 * @typeParam Brand - 品牌标识符（唯一符号或字符串字面量）
 */
export type Brand<T, Brand extends string | symbol> = T & { readonly __brand: Brand };

/**
 * 创建品牌类型的工厂函数类型
 * @typeParam T - 底层类型
 * @typeParam B - 品牌标识符
 */

/**
 * 从品牌类型中提取底层类型
 * @typeParam Branded - 品牌类型
 */
export type Unbrand<Branded> = Branded extends Brand<infer T, infer _> ? T : never;

/**
 * 从品牌类型中提取品牌标识符
 * @typeParam Branded - 品牌类型
 */
export type BrandOf<Branded> = Branded extends Brand<infer _, infer B> ? B : never;

/**
 * 断言值为指定品牌类型（运行时不检查，仅类型层面）
 * @param value - 待断言的值
 * @returns 品牌类型值
 * @example
 * const userId = assertBrand<UserId>('123');
 */
export function assertBrand<T, B extends string | symbol>(value: T): Brand<T, B> {
  return value as Brand<T, B>;
}

/**
 * 创建品牌类型守卫函数
 * @param predicate - 运行时校验函数
 * @returns 类型守卫函数
 * @example
 * const isUserId = createBrandGuard<string, 'UserId'>((v) => typeof v === 'string' && v.length > 0);
 */
export function createBrandGuard<T, B extends string | symbol>(
  predicate: (value: unknown) => value is T,
): (value: unknown) => value is Brand<T, B> {
  return (value): value is Brand<T, B> => predicate(value);
}

/**
 * 创建简单的品牌类型构造器（仅类型层面，运行时直接返回值）
 * @param _brand - 品牌标识符（仅用于类型）
 * @returns 构造函数
 * @example
 * const createUserId = createBrandedType<'UserId'>();
 * const id = createUserId('123'); // 类型为 Brand<string, 'UserId'>
 */
export function createBrandedType<B extends string | symbol>(): <T>(value: T) => Brand<T, B> {
  return assertBrand as <T>(value: T) => Brand<T, B>;
}

/**
 * 品牌类型工具集合
 * @example
 * const UserId = createBrandUtils('UserId');
 * const id = UserId.create('123');
 * UserId.is(id); // true
 */
export interface BrandUtils<T, B extends string | symbol> {
  /** 创建品牌值 */
  create: (value: T) => Brand<T, B>;
  /** 类型守卫 */
  is: (value: unknown) => value is Brand<T, B>;
  /** 安全创建（校验失败返回 undefined） */
  tryCreate: (value: unknown) => Brand<T, B> | undefined;
  /** 获取底层值 */
  unwrap: (branded: Brand<T, B>) => T;
}

/**
 * 创建完整的品牌类型工具集
 * @param brand - 品牌标识符
 * @param validator - 可选的运行时校验器
 * @returns 品牌工具对象
 * @example
 * const UserId = createBrandUtils<string, 'UserId'>('UserId', (v): v is string => typeof v === 'string' && v.length > 0);
 * const id = UserId.create('123');
 * UserId.tryCreate(''); // undefined
 */
export function createBrandUtils<T, B extends string | symbol>(
  _brand: B,
  validator?: (value: unknown) => value is T,
): BrandUtils<T, B> {
  const create = assertBrand as (value: T) => Brand<T, B>;
  const is = validator
    ? ((value: unknown): value is Brand<T, B> => validator(value))
    // 无 validator 时一切值都视为合法；参数必须保留原名 value（类型谓词要求），
    // 未使用由 noUnusedParameters 豁免注释承担
    : ((value: unknown): value is Brand<T, B> => { void value; return true; });
  return {
    create,
    is,
    tryCreate: (value: unknown): Brand<T, B> | undefined => (is(value) ? create(value) : undefined),
    unwrap: (branded: Brand<T, B>): T => branded,
  };
}
