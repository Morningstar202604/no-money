/**
 * 配送产能模型：把「工时」与「单量」从自由变量变成受物理约束的联动变量。
 *
 * 为什么需要它：旧实现的方案对比直接改数字——
 *   「多跑2小时」= dailyHours + 2，单量不变
 *   「多接5单」  = dailyOrders + 5，工时不变
 * 两者都不成立：
 *   - 多跑 2 小时却不增单量，毛收入不变而只增加疲劳（用户看到「多跑2小时净收入不变」）；
 *   - 多接 5 单却不加工时，等于凭空缩短每单耗时（现实做不到）。
 *
 * 本模型依据排队论与服务运营的基本关系建立：
 *
 *   单均耗时 = 取送等待 + 骑行时间 = 固定开销 + 距离 / 平均速度
 *   可用工时 = 日工时 - 休息/等单时间
 *   日单量上限 = 可用工时 ÷ 单均耗时
 *
 * 这些参数都是可测的业务量，用户用自己的实际数据校准后，模型才有意义。
 * 默认值取自行业常见量级，明确标注为假设，不冒充权威数据。
 */

/** 产能模型参数（全部可调，默认值仅为行业量级假设） */
export interface CapacityModel {
  /** 单均固定耗时（分钟）：接单、到店、等餐、上楼、交付 */
  fixedMinutesPerOrder: number
  /** 平均骑行速度（公里/小时） */
  avgSpeedKmh: number
  /** 日均休息与等单时间（分钟）：吃饭、休息、无单可接的空档 */
  breakMinutesPerDay: number
}

/** 行业量级默认值（假设，非官方数据） */
export const DEFAULT_CAPACITY: CapacityModel = {
  fixedMinutesPerOrder: 8,
  avgSpeedKmh: 18,
  breakMinutesPerDay: 90,
}

export interface CapacityResult {
  /** 单均总耗时（分钟） */
  minutesPerOrder: number
  /** 可用配送时间（分钟/日） */
  availableMinutes: number
  /** 产能上限（单/日） */
  maxOrdersPerDay: number
  /** 当前单量是否超出产能（物理不可达） */
  overloaded: boolean
  /** 为完成当前单量所需的日工时（小时） */
  requiredHours: number
}

/**
 * 给定「日工时 + 单量 + 距离」评估产能是否可行。
 * 可完成单量 = 可用工时 ÷ 单均耗时，其中可用工时已扣除休息/等单时间。
 */
export function calcCapacity(
  dailyHours: number,
  dailyOrders: number,
  avgDistanceKm: number,
  model: CapacityModel = DEFAULT_CAPACITY,
): CapacityResult {
  const hours = Number.isFinite(dailyHours) ? Math.max(0, dailyHours) : 0
  const orders = Number.isFinite(dailyOrders) ? Math.max(0, dailyOrders) : 0
  const minutesPerOrder = effectiveMinutesPerOrder(avgDistanceKm, model)
  const breakMin = Number.isFinite(model.breakMinutesPerDay)
    ? Math.max(0, model.breakMinutesPerDay)
    : DEFAULT_CAPACITY.breakMinutesPerDay

  // 休息时间只在工时长到能容纳时才扣除，避免短工时出现负的可用时间
  const totalMinutes = hours * 60
  const availableMinutes = Math.max(0, totalMinutes - Math.min(breakMin, totalMinutes))
  const maxOrdersPerDay = minutesPerOrder > 0 ? availableMinutes / minutesPerOrder : 0
  const requiredHours = (orders * minutesPerOrder + breakMin) / 60

  return {
    minutesPerOrder,
    availableMinutes,
    maxOrdersPerDay,
    overloaded: orders > maxOrdersPerDay + 1e-9,
    requiredHours,
  }
}

/** 单均耗时：固定开销 + 骑行时间（分钟） */
export function effectiveMinutesPerOrder(avgDistanceKm: number, model: CapacityModel = DEFAULT_CAPACITY): number {
  const dist = Number.isFinite(avgDistanceKm) ? Math.max(0, avgDistanceKm) : 0
  const speed = Number.isFinite(model.avgSpeedKmh) && model.avgSpeedKmh > 0 ? model.avgSpeedKmh : DEFAULT_CAPACITY.avgSpeedKmh
  const fixed = Number.isFinite(model.fixedMinutesPerOrder) ? Math.max(0, model.fixedMinutesPerOrder) : DEFAULT_CAPACITY.fixedMinutesPerOrder
  return fixed + (dist / speed) * 60
}

/**
 * 由「想要达到的单量」反推所需日工时（小时）。
 * 用于「多接 N 单」场景：单量增加必然要求工时增加，而不是凭空达成。
 */
export function requiredHoursForOrders(
  dailyOrders: number,
  avgDistanceKm: number,
  model: CapacityModel = DEFAULT_CAPACITY,
): number {
  const orders = Number.isFinite(dailyOrders) ? Math.max(0, dailyOrders) : 0
  const minutes = orders * effectiveMinutesPerOrder(avgDistanceKm, model)
  return minutes / 60
}

/** 含休息时间的「实际需要待在岗上的工时」——用于判断某单量要占用多少生活时间 */
export function requiredClockHoursForOrders(
  dailyOrders: number,
  avgDistanceKm: number,
  model: CapacityModel = DEFAULT_CAPACITY,
): number {
  const breakMin = Number.isFinite(model.breakMinutesPerDay)
    ? Math.max(0, model.breakMinutesPerDay)
    : DEFAULT_CAPACITY.breakMinutesPerDay
  return requiredHoursForOrders(dailyOrders, avgDistanceKm, model) + breakMin / 60
}

/**
 * 由「愿意投入的工时」反推可完成单量。
 * 用于「多跑 N 小时」场景：工时增加对应单量增加，而非单量不变。
 */
export function achievableOrdersForHours(
  dailyHours: number,
  avgDistanceKm: number,
  model: CapacityModel = DEFAULT_CAPACITY,
): number {
  const hours = Number.isFinite(dailyHours) ? Math.max(0, dailyHours) : 0
  const minutesPerOrder = effectiveMinutesPerOrder(avgDistanceKm, model)
  if (minutesPerOrder <= 0) return 0
  return (hours * 60) / minutesPerOrder
}

/**
 * 边际递减系数：工时越长，单位时间产出越低。
 * 依据：长时间连续作业下疲劳导致速度下降、接单响应变慢；
 * 这里用饱和函数建模（收益递减，符合劳动经济学的边际报酬递减）。
 *
 *   factor(h) = 1 / (1 + k × max(0, h - h0) / h0)   （h > h0 时开始衰减）
 *
 * 参数 k 是可调系数，默认 0.15：工时超过 8 小时后，每超 1 小时产出效率约降 1.5%。
 */
export function fatigueFactor(dailyHours: number, thresholdHours = 8, k = 0.15): number {
  const h = Number.isFinite(dailyHours) ? Math.max(0, dailyHours) : 0
  const h0 = thresholdHours > 0 ? thresholdHours : 8
  const kk = Number.isFinite(k) && k >= 0 ? k : 0.15
  if (h <= h0) return 1
  return 1 / (1 + kk * ((h - h0) / h0))
}

/**
 * 产能约束后的有效单量：单量不会超过「工时决定的上限」，并叠加疲劳折减。
 * 这是把「自由输入的 dailyOrders」变成「受工时约束的输出」的关键函数。
 */
export function effectiveOrders(
  dailyOrders: number,
  dailyHours: number,
  avgDistanceKm: number,
  model: CapacityModel = DEFAULT_CAPACITY,
): number {
  const requested = Number.isFinite(dailyOrders) ? Math.max(0, dailyOrders) : 0
  const capacity = achievableOrdersForHours(dailyHours, avgDistanceKm, model)
  const fatigue = fatigueFactor(dailyHours)
  // 单量取「用户声称的单量」与「产能上限」的较小值，再乘疲劳系数
  return Math.min(requested, capacity) * fatigue
}
