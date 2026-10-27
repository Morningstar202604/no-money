/**
 * Brand 类型工具单元测试
 * 覆盖率目标：100%
 */

import { describe, it, expect } from 'vitest';
import { Brand, assertBrand, createBrandGuard, createBrandedType, createBrandUtils, Unbrand, BrandOf } from '../../../src/domain/shared/brand';

describe('Brand 类型工具', () => {
  // 类型测试（编译时验证）
  type UserId = Brand<string, 'UserId'>;
  type PostId = Brand<string, 'PostId'>;
  type Age = Brand<number, 'Age'>;

  it('应创建品牌值', () => {
    const userId = assertBrand<string, 'UserId'>('user-123');
    expect(userId).toBe('user-123');
  });

  it('不同品牌类型不应互换', () => {
    const userId = assertBrand<string, 'UserId'>('123');
    const postId = assertBrand<string, 'PostId'>('123');
    // 编译时会报错：类型  UserId 不能赋值给类型 PostId
    // @ts-expect-error
    const _fail: PostId = userId;
    // @ts-expect-error
    const _fail2: UserId = postId;
    expect(userId).toBe(postId); // 运行时值相同但类型不同
  });

  it('assertBrand 应返回原值', () => {
    const value = 'test';
    const branded = assertBrand<string, 'UserId'>(value);
    expect(branded).toBe(value);
  });

  it('createBrandGuard 应创建类型守卫', () => {
    const isUserId = createBrandGuard<string, 'UserId'>((v): v is string => typeof v === 'string' && v.startsWith('user-'));
    expect(isUserId('user-123')).toBe(true);
    expect(isUserId('post-123')).toBe(false);
    expect(isUserId(123)).toBe(false);
    expect(isUserId(null)).toBe(false);
  });

  it('createBrandedType 应创建构造函数', () => {
    const createUserId = createBrandedType<'UserId'>();
    const id = createUserId('user-456');
    expect(id).toBe('user-456');
  });

  it('createBrandUtils 应创建完整工具集', () => {
    const UserId = createBrandUtils<string, 'UserId'>('UserId', (v): v is string => typeof v === 'string' && v.length > 0);

    const id = UserId.create('user-789');
    expect(id).toBe('user-789');

    expect(UserId.is('user-123')).toBe(true);
    expect(UserId.is('')).toBe(false);
    expect(UserId.is(123)).toBe(false);

    expect(UserId.tryCreate('valid')).toBe('valid');
    expect(UserId.tryCreate('')).toBeUndefined();
    expect(UserId.tryCreate(null)).toBeUndefined();

    expect(UserId.unwrap(id)).toBe('user-789');
  });

  it('Unbrand 应提取底层类型', () => {
    type Extracted = Unbrand<UserId>;
    const _check: Extracted = 'string'; // 编译时验证
    expect(true).toBe(true);
  });

  it('BrandOf 应提取品牌标识符', () => {
    type BrandName = BrandOf<UserId>;
    const _check: BrandName = 'UserId'; // 编译时验证
    expect(true).toBe(true);
  });

  it('不带验证器的 createBrandUtils 应接受任意值', () => {
    const AnyBrand = createBrandUtils<number, 'Any'>('Any');
    expect(AnyBrand.create(123)).toBe(123);
    expect(AnyBrand.create(-1)).toBe(-1);
    expect(AnyBrand.create(0)).toBe(0);
    expect(AnyBrand.is(123)).toBe(true);
    expect(AnyBrand.is('abc')).toBe(true); // 无验证器时总是通过
  });
});
