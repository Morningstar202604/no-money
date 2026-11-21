/**
 * 个人账户余额增长曲线（纯函数）。
 *
 * 抽成独立函数的原因：这段逻辑原先写在 RetirementPlanner.vue 的 computed 里，
 * 用 (1+r)^12 按年滚存、且先注入一年缴费再打当前年龄点，与按月复利的退休引擎
 * 相差约 9000 倍，同一页面里两个数字互相打架而单测看不见（组件内联逻辑无法断言）。
 *
 * 口径契约：第 n 个点必须等于「按第 n 年停缴」调用 domain 退休测算得到的个人账户余额，
 * 首点为 0。测试见 tests/pensionSeries.spec.ts，任何复利口径改动都会在那里暴露。
 */

import { projectRetirement } from '../domain/benefit/calculator'
import { Cent, Rate, centToYuan, yuanToCent } from '../domain/shared/value-objects'

export interface PensionGrowthPoint {
  age: number
  label: string
  /** 个人账户余额（元） */
  balance: number
}

export function buildPensionGrowthSeries(opts: {
  currentAge: number
  retireAge: number
  /** 月记入个人账户金额（元），即缴存额中进个账的 8% 部分 */
  accountMonthly: number
  annualReturn: number
}): PensionGrowthPoint[] {
  const { currentAge, retireAge, accountMonthly, annualReturn } = opts
  if (!Number.isFinite(currentAge) || !Number.isFinite(retireAge) || retireAge < currentAge) return []
  const points: PensionGrowthPoint[] = []
  for (let age = currentAge; age <= retireAge; age++) {
    const yearsPaid = age - currentAge
    // 首点是缴费起点，余额为 0；不能先注入一年缴费再打当前年龄点。
    // 传 0 计发基数：本函数只取个人账户余额，基础养老金不参与这条曲线。
    const result = yearsPaid === 0
      ? null
      : projectRetirement(
          currentAge,
          age,
          yuanToCent(accountMonthly),
          yearsPaid,
          Rate.create(annualReturn),
          Rate.create(0.6),
          Cent.create(0),
        )
    if (result && !result.ok) return []
    const balance = result ? centToYuan(result.value.personalAccount) : 0
    points.push({ age, label: `${age}岁`, balance })
  }
  return points
}

export interface PensionTier {
  /** 档位百分比（60 = 按社平 60% 缴费） */
  pct: number
  label: string
  /** 该档月缴费基数（元） */
  base: number
}

/**
 * 缴费档次换算：法定区间是社平工资的 60%~300%，规则文件只给了上下限，
 * 下限即 60% 档 → 每 1% 对应的基数 = baseMin / 60。
 *
 * 旧实现按 (min+max) 的线性插值拼档（0.4/0.5/0.75/0.8 系数），系数与档位标签
 * 没有关系：算出的 200% 档基数反而低于 150% 档，图上出现"缴得越多、养老金越少"
 * 的反向结论。此处按真实口径换算，档位与基数严格成正比。
 */
export function buildPensionTiers(baseMin: number, baseMax: number, pcts: readonly number[] = [60, 80, 100, 150, 200]): PensionTier[] {
  if (!Number.isFinite(baseMin) || baseMin <= 0) return []
  const perPct = baseMin / 60
  return pcts.map(pct => ({
    pct,
    label: `${pct}%档`,
    // 上限兜底：档位超过规则上限（300%档等）时不越过法定封顶
    base: Math.round(Math.min(perPct * pct, Number.isFinite(baseMax) && baseMax > 0 ? baseMax : Infinity)),
  }))
}

/**
 * 由基数下限推定的本城社平工资（下限 = 社平 × 60%）。
 * 缴费指数 = 本人缴费基数 ÷ 社平工资，是基础养老金公式的第二个因子——
 * 各档测算必须用各档自己的指数，否则高档位会被按 0.6 下限低估。
 */
export function socialAverageWage(baseMin: number, baseMax?: number): number {
  if (!Number.isFinite(baseMin) || baseMin <= 0) return 0
  const fromMin = baseMin / 0.6
  // 上下限不满足 60%/300% 时以下限推定为准；比例吻合则两法一致
  if (Number.isFinite(baseMax as number) && (baseMax as number) > 0) {
    const fromMax = (baseMax as number) / 3
    if (Math.abs(fromMin - fromMax) / fromMin < 0.02) return (fromMin + fromMax) / 2
  }
  return fromMin
}


