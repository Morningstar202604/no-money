/**
 * Benefit Domain Layer — 社保与养老金。
 *
 * 纯函数计算层：无状态、零框架依赖、可独立单测。
 * - rules.ts      : 纯类型定义（无行为）
 * - calculator.ts : 缴费基数解析、月度缴费、退休测算
 * - actuarial.ts  : 养老金精算（现值 / 回本年龄 / 投入产出倍数）
 * - selfFunded.ts : 自助养老 vs 社保的现金流对比
 *
 * 注：本目录曾有一个 293 行的 ports.ts + engine.ts「端口-实现」层，
 * 但生产与测试都零调用（真正的实现就在 calculator 的纯函数里）。
 * 已随 2026-10 技术债清理移除。
 */

export * from './rules'
export * from './calculator'
export * from './actuarial'
export * from './selfFunded'
