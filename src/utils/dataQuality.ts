/**
 * 数据质量判定（纯函数，新旧两条计算路径共用）。
 *
 * 为什么需要它：规则文件里仍有 confidence=unverified 的占位值（如外卖单价 5 元/单
 * 是占位口径），它们照样参与净收入、"最优方案"与权益评级，而用户无法从
 * 「最优「多跑2小时」」这句话里看出背后站的是假设。
 *
 * 只统计「真的进入本场景数字」的字段：
 *   - 收入计价、最低工资（评级锚点）任何场景都进依赖；
 *   - 养老/医保基数与费率只在参保场景产生个人支出，未参保时不计入，
 *     否则未参保用户会被无谓地标成"假设测算"。
 * 置信度口径：official 计为已核实；derived（据官方口径推算）与 unverified 都算未核实——
 * 推算值不是直接发布值，用它与实测值混为一谈正是本模块要防的事。
 */

import type { DataQuality, SourceRef, IncomeOverrides } from '../types'

/** 本结果依赖的字段：规则文件 sources 的键 → 展示用中文名 */
const DEPS: Array<[string, string]> = [
  ['income', '计价单价/补贴'],
  ['minimumWage', '最低工资'],
  ['pension', '养老缴费基数'],
  ['pensionRate', '养老费率'],
  ['medical', '医保缴费基数'],
  // 个税进入每个场景的净收入与「最优方案」排序，是结论依据之一；
  // 此前漏列，tax 置信度降级时「假设测算」门禁不会亮出这一项
  ['tax', '个税口径'],
  // 养老金计发基数直接决定退休页的基础养老金（15 城中 8 城仍为 unverified）；
  // 漏列会让「假设测算」清单不含这个最关键的养老依赖项
  ['retirement', '养老金计发基数'],
]

/** 未参保时不产生个人支出、因而不构成结论依据的字段 */
const ENROLLED_ONLY = new Set(['养老缴费基数', '养老费率', '医保缴费基数'])

/** 计价覆盖字段 → 中文标签（用于「还差哪几项实测」提示） */
const OVERRIDE_LABELS: Array<[keyof NonNullable<IncomeOverrides>, string]> = [
  ['basePricePerOrder', '每单基础配送费'],
  ['distanceRate', '距离费'],
  ['peakMultiplier', '峰时倍率'],
  ['rainSurcharge', '雨天倍率'],
  ['holidayMultiplier', '节假日倍率'],
]

/**
 * @param statutory 用户填入的「本省法定参数」覆盖。填了哪一项，对应的
 *   未核实字段就应移入 overriddenFields——否则用户在参数栏填了本省官方值，
 *   页顶仍把他刚填过的字段列为「假设测算」，自相矛盾。
 */
export function dataQualityOf(
  sources: Record<string, SourceRef> | undefined,
  hasSocialInsurance: boolean,
  incomeOverrides?: IncomeOverrides,
  statutory?: { baseMin?: number; baseMax?: number; minWageMonthly?: number },
): DataQuality {
  const official: string[] = []
  const unverified: string[] = []
  const overridden: string[] = []
  const baseFilled = isPositive(statutory?.baseMin) && isPositive(statutory?.baseMax)
  const wageFilled = isPositive(statutory?.minWageMonthly)
  for (const [key, label] of DEPS) {
    // 用户用自己的 APP 流水覆盖了计价参数 → 该字段不再是「占位假设」，
    // 而是实测值：既不算 official（不是官方发布），也不再计入 provisional
    if (key === 'income' && hasIncomeOverride(incomeOverrides)) overridden.push(label)
    else if ((key === 'pension' || key === 'medical') && baseFilled) overridden.push(label)
    else if (key === 'minimumWage' && wageFilled) overridden.push(label)
    // 缺来源条目的键按未核实处理：宁可多提示，也不能默认可信
    else if (sources?.[key]?.confidence === 'official') official.push(label)
    else unverified.push(label)
  }
  if (!hasSocialInsurance) {
    return {
      provisional: unverified.some(f => !ENROLLED_ONLY.has(f)),
      unverifiedFields: unverified.filter(f => !ENROLLED_ONLY.has(f)),
      officialFields: official.filter(f => !ENROLLED_ONLY.has(f)),
      overriddenFields: overridden.filter(f => !ENROLLED_ONLY.has(f)),
      missingOverrideFields: missingOverrideFields(incomeOverrides),
    }
  }
  return {
    provisional: unverified.length > 0,
    unverifiedFields: unverified,
    officialFields: official,
    overriddenFields: overridden,
    missingOverrideFields: missingOverrideFields(incomeOverrides),
  }
}

/**
 * 计价覆盖里「一项都没填」的字段。
 * 产品立场：只填单价不填倍率时，峰时/雨天/节假日仍按占位假设算，
 * 不能整块标成「已按你的实测计算」——必须告诉用户还差哪几项。
 */
export function missingOverrideFields(o?: IncomeOverrides): string[] {
  if (!o) return OVERRIDE_LABELS.map(([, label]) => label)
  return OVERRIDE_LABELS
    .filter(([key]) => {
      const v = o[key]
      return !(typeof v === 'number' && Number.isFinite(v) && v > 0)
    })
    .map(([, label]) => label)
}

function isPositive(v?: number): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v > 0
}

/** 至少填写一项计价覆盖即视为「用户已用自己的流水实测」 */
function hasIncomeOverride(o?: IncomeOverrides): boolean {
  if (!o) return false
  return [o.basePricePerOrder, o.distanceRate, o.peakMultiplier, o.rainSurcharge, o.holidayMultiplier]
    .some(v => typeof v === 'number' && Number.isFinite(v) && v > 0)
}
