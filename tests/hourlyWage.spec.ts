// 有效时薪 vs 法定最低时薪的对比提示
//
// 为什么这条测试重要：
// 月收入看起来不低时，用户很容易忽略"时薪已经低于法定标准"这个事实。
// 对骑手来说，时薪才是能跟保安、进厂、跑网约车等其他选择横向比较的尺度。
// 如果这个提示失效，用户会在一个"越干越亏"的节奏里持续加时长。
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { ScenarioService } from '../src/application/scenario/ScenarioService'
import type { CityRule } from '../src/types'
import { DEFAULT_WORK } from '../src/kernel/calculate'

const loadRule = (city: string) =>
  JSON.parse(readFileSync(`public/rules/${city}.json`, 'utf8')) as CityRule

/** 构造一个可计算的最小输入 */
function makeInput(rule: CityRule, hours: number, days: number) {
  return {
    id: 'test',
    name: '测试方案',
    work: { ...DEFAULT_WORK, dailyHours: hours, workDaysMonth: days, city: rule.city } as never,
    costs: {
      vehicleType: 'electric' as const,
      fuelCostMonth: 0,
      electricityCostMonth: 300,
      maintenanceMonth: 150,
      insuranceMonth: 0,
      phoneCostMonth: 100,
      foodCostMonth: 1200,
      trafficFineMonth: 0,
      vehicleDepreciationMonth: 200,
      otherCostMonth: 0,
    },
    personal: {
      currentAge: 25,
      expectedRetireAge: 60,
      hasSocialInsurance: false,
      specialDeductionMonth: 0,
    },
  }
}

describe('有效时薪对比', () => {
  it('长时间高强度工作时，提示时薪低于当地最低时薪', () => {
    const rule = loadRule('guangzhou')
    const svc = new ScenarioService(rule)
    // 12 小时 × 28 天 = 336 小时/月，疲劳折减会显著拉低时薪
    const result = svc.runScenario(makeInput(rule, 12, 28))

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const flags = result.value.rightsFlags.join('\n')
    expect(flags, '应当提示时薪低于法定最低时薪').toMatch(/有效时薪.*低于.*最低时薪/)
  })

  it('提示里必须同时给出实际时薪与法定标准，否则用户无法判断差多少', () => {
    const rule = loadRule('guangzhou')
    const svc = new ScenarioService(rule)
    const result = svc.runScenario(makeInput(rule, 12, 28))

    if (!result.ok) return
    const line = result.value.rightsFlags.find((f) => f.includes('低于当地非全日制最低时薪'))
    expect(line).toBeTruthy()
    // 两个数字都要在：实际值 + 法定值
    expect(line).toMatch(/¥\d+\.\d{2}/)
    // 还要给出差距百分比
    expect(line).toMatch(/低 \d+%/)
  })

  it('时薪明显高于最低标准时，不给"低于"警告', () => {
    const rule = loadRule('guangzhou')
    const svc = new ScenarioService(rule)
    // 8 小时 × 20 天 = 160 小时，收入分散到更少工时上
    const result = svc.runScenario(makeInput(rule, 8, 20))

    if (!result.ok) return
    const flags = result.value.rightsFlags.join('\n')
    expect(flags).not.toMatch(/低于当地非全日制最低时薪/)
  })

  it('34 座城市都有非全日制最低时薪数据（缺数据则对比提示会静默消失）', () => {
    const rulesDir = 'public/rules'
    const files = readdirSync(rulesDir).filter((f) => f.endsWith('.json'))

    const missing: string[] = []
    for (const f of files) {
      const rule = JSON.parse(readFileSync(`${rulesDir}/${f}`, 'utf8')) as CityRule
      const v = rule.minimumWage?.nonFullTimeHourly
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
        missing.push(rule.cityName ?? f)
      }
    }

    expect(missing, `以下城市缺非全日制时薪：${missing.join('、')}`).toHaveLength(0)
  })

  it('时薪永远不超过月净收入（工时至少 1 小时的合理性）', () => {
    const rule = loadRule('guangzhou')
    const svc = new ScenarioService(rule)
    const result = svc.runScenario(makeInput(rule, 10, 26))

    if (!result.ok) return
    // 有效时薪 = 月净收入 / 总工时，必然小于月净收入
    expect(result.value.netHourly).toBeLessThan(result.value.netMonthly)
    expect(result.value.netHourly).toBeGreaterThan(0)
  })
})
