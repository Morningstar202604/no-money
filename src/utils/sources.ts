import type { SourceRef } from '../types'

/**
 * rule.sources 的键 → 中文标签。
 * 政策溯源页与「依据」chip 共用一份，避免两处各维护一套映射后逐渐对不上。
 */
export const SOURCE_LABELS: Record<string, string> = {
  pension: '养老保险缴费基数上下限',
  pensionRate: '养老保险缴费比例',
  medical: '医疗保险缴费基数',
  medicalRate: '医疗保险缴费费率',
  medicalTierRate: '医保分档费率调整',
  medicalBase: '医疗保险缴费基数上下限',
  tax: '劳务报酬累计预扣',
  taxPlatform: '平台涉税信息报送规定',
  income: '平台接单计价规则',
  minimumWage: '最低工资标准',
  retirement: '养老金计发公式与假设',
  soleVat: '小规模纳税人增值税优惠',
  soleItr: '经营所得核定征收（行业所得率）',
}

export function sourceLabel(key: string): string {
  return SOURCE_LABELS[key] ?? key
}

/** 置信度 → 短标签。official=已回溯官方原文；derived=据官方口径推算；unverified=无权威来源，仅占位 */
export const CONFIDENCE_LABELS: Record<SourceRef['confidence'], string> = {
  official: '已核官方',
  derived: '推算口径',
  unverified: '待核验',
}

/** 置信度 → naive-ui tag 语义色，chip 与政策页保持一致 */
export function confidenceType(c: SourceRef['confidence']): 'success' | 'warning' | 'error' {
  return c === 'official' ? 'success' : c === 'derived' ? 'warning' : 'error'
}
