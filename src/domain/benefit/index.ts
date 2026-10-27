/**
 * Benefit Domain Layer
 * 
 * 纯函数计算层：无状态、可测试、可组合
 * - ports.ts: 端口接口（依赖倒置）
 * - rules.ts: 纯类型定义（无行为）
 * - calculator.ts: 纯函数实现
 * - engine.ts: 实现类组合
 */

export * from './ports'
export * from './rules'
export * from './calculator'
export * from './engine'
export * from './actuarial'
export * from './selfFunded'
