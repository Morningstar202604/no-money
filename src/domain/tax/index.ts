/**
 * Tax Domain Layer — 个税。
 *
 * - rules.ts       : 纯类型定义
 * - calculator.ts  : 年度汇算（税率表一）与个体户核定征收
 * - withholding.ts : 劳务报酬预扣预缴（61 号公告预扣率表二）
 *
 * 注：本目录曾有 ports.ts + engine.ts 的端口-实现层，零调用已移除。
 */

export * from './rules'
export * from './calculator'
export * from './withholding'
