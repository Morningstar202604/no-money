/**
 * 收入波动与风险模型：把「单点数字」变成「区间 + 概率」。
 *
 * 灵活就业的真实特征是收入不稳定——同样的日均值，有人每月固定在均值附近，
 * 有人大起大落（旺季爆单、淡季归零、下雨爆单、封号断流）。只给一个「月净收入
 * ¥8,006」会让用户误以为这是稳定可预期的现金流，进而做出错误的支出承诺。
 *
 * 建模依据（收入风险的常用度量，属统计学标准工具，非本项目发明）：
 *   - 变异系数 CV = 标准差 / 均值：衡量相对波动，跨城市/跨平台可比
 *   - 几何布朗运动近似：月度收入乘性波动（收入不会为负、波动幅度与规模成比例）
 *   - 分位数（P10/P50/P90）：用户更关心「最差情况」而非期望值
 *   - 破产概率：净收入为负（支出超过收入）的月份占比
 *
 * 所有参数都是显式假设：波动率默认 20%（灵活就业的常见量级），可调；
 * 随机模拟使用固定种子的伪随机数，保证可复现（不是真随机，也不该是）。
 */

export interface IncomeVolatilityModel {
  /** 月度收入变异系数（标准差/均值），默认 0.20 */
  cv?: number
  /** 模拟月数，默认 600（50 年），用于估计长期分布 */
  months?: number
  /** 随机种子：固定种子保证结果可复现 */
  seed?: number
}

export interface IncomeDistribution {
  mean: number
  /** 标准差 */
  stdDev: number
  /** 变异系数（实际算出的） */
  cv: number
  /** 分位数 */
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  /** 最低与最高（模拟样本极值） */
  min: number
  max: number
  /**
   * 低于「生存线」的月份占比（0-1）。
   * 乘性波动下收入恒为正，「负收入月份」没有意义；真正有意义的是
   * 「收入不够覆盖固定支出」的月份——那才是要动用储备的时刻。
   */
  belowCostMonthRatio: number
  /** 样本月数 */
  sampleSize: number
}

/**
 * 乘性波动模拟：每月收入 = 均值 × exp(σ·Z − σ²/2)，其中 Z 为标准正态。
 * 该形式保证 E[收入] = 均值（对数正态的均值修正），且收入恒为正。
 *
 * σ 由变异系数反推：对对数正态，CV = sqrt(exp(σ²) − 1) ⇒ σ = sqrt(ln(1 + CV²))。
 */
export function simulateIncomeDistribution(
  meanIncome: number,
  model: IncomeVolatilityModel = {},
  /** 月度固定支出（元）：用于统计「收入不够花」的月份占比 */
  monthlyCost = 0,
): IncomeDistribution {
  const mean = Number.isFinite(meanIncome) ? Math.max(0, meanIncome) : 0
  const cv = clamp(model.cv, 0, 3, 0.2)
  const months = Math.max(1, Math.round(clamp(model.months, 12, 6000, 600)))
  const seed = Number.isFinite(model.seed) ? (model.seed as number) : 20260101

  const cost = Number.isFinite(monthlyCost) ? Math.max(0, monthlyCost) : 0
  if (mean === 0) {
    return {
      mean: 0, stdDev: 0, cv: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0,
      min: 0, max: 0, belowCostMonthRatio: cost > 0 ? 1 : 0, sampleSize: months,
    }
  }

  // 对对数正态：σ = sqrt(ln(1 + cv²))
  const sigma = Math.sqrt(Math.log(1 + cv * cv))
  const rng = mulberry32(seed)
  const samples: number[] = []
  let belowCost = 0

  for (let i = 0; i < months; i++) {
    const z = gaussian(rng)
    // 乘性冲击 + 均值修正项，保证期望仍为 mean
    const value = mean * Math.exp(sigma * z - (sigma * sigma) / 2)
    samples.push(value)
    if (value < cost) belowCost++
  }

  samples.sort((a, b) => a - b)
  const sampleMean = samples.reduce((s, v) => s + v, 0) / samples.length
  const variance = samples.reduce((s, v) => s + (v - sampleMean) ** 2, 0) / samples.length
  const stdDev = Math.sqrt(variance)

  return {
    mean: round2(sampleMean),
    stdDev: round2(stdDev),
    cv: round4(sampleMean > 0 ? stdDev / sampleMean : 0),
    p10: round2(quantile(samples, 0.1)),
    p25: round2(quantile(samples, 0.25)),
    p50: round2(quantile(samples, 0.5)),
    p75: round2(quantile(samples, 0.75)),
    p90: round2(quantile(samples, 0.9)),
    min: round2(samples[0]),
    max: round2(samples[samples.length - 1]),
    belowCostMonthRatio: round4(belowCost / samples.length),
    sampleSize: months,
  }
}

export interface BufferAdvice {
  /** 建议应急储备金额（元） */
  recommendedBuffer: number
  /** 对应月数 */
  months: number
  /** 依据 */
  rationale: string
}

/**
 * 应急储备建议：按收入的尾部风险（P10）而非均值来定。
 * 依据：骑手收入的下行风险主要来自伤病/封号/淡季，储备应覆盖「最差月份」
 * 而非「平均月份」。行业通行的 3-6 个月支出的储蓄目标来自个人理财顾问实践，
 * 这里按 P10 收入与固定支出口径给出更贴合本场景的建议。
 */
export function recommendBuffer(
  monthlyNet: number,
  fixedMonthlyCost: number,
  distribution?: IncomeDistribution,
): BufferAdvice {
  const net = Number.isFinite(monthlyNet) ? Math.max(0, monthlyNet) : 0
  const cost = Number.isFinite(fixedMonthlyCost) ? Math.max(0, fixedMonthlyCost) : 0
  // 用 P10 收入估算最差月份的净现金流缺口
  const worstIncome = distribution ? distribution.p10 : net * 0.6
  const monthlyGap = Math.max(0, cost + (net - worstIncome))
  // 基础储备 3 个月固定支出，叠加按最差月缺口计的 3 个月
  const months = 3
  const recommendedBuffer = round2(cost * months + monthlyGap * months)
  return {
    recommendedBuffer,
    months,
    rationale: `按 3 个月固定支出（¥${cost.toLocaleString()}×3）+ 3 个月最差月份缺口（P10 收入 ¥${worstIncome.toFixed(0)}）估算；行情差或刚入行时建议提高到 6 个月。`,
  }
}

/** mulberry32：小而快的确定性伪随机数生成器（固定种子可复现） */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Box-Muller 变换：均匀分布 → 标准正态 */
function gaussian(rng: () => number): number {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  if (base + 1 < sorted.length) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base])
  }
  return sorted[base]
}

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
function round4(v: number): number {
  return Math.round(v * 10000) / 10000
}
