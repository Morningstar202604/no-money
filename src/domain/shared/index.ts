/**
 * Domain Shared Kernel — 导出入口。
 *
 * 纯 TypeScript，零框架依赖；本目录内的模块可被 domain 层任意引用。
 * 注：money.ts / rate.ts / date.ts / guards.ts 因生产零调用已移除，
 * 金额用分（Cent）、比率（Rate）统一由 value-objects.ts 承载。
 *
 * @packageDocumentation
 */

export * from './brand'
export * from './number'
export * from './result'
export * from './value-objects'
