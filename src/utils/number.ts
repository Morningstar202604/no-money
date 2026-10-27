export type { EChartsOption } from 'echarts'

/**
 * 纯数值工具的唯一实现在 domain/shared/number.ts（零依赖、可被 domain 层直接引用）。
 * 本文件保留为 UI 侧的再导出入口，避免一次性改动大量调用点。
 */
export { round2, round4, clampNumber, safeDivide } from '../domain/shared/number'
