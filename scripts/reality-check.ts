import { readFileSync } from 'node:fs'
import { ScenarioService } from '../src/application/scenario/ScenarioService'
import type { ScenarioInput } from '../src/application/scenario/ScenarioService'
import { BenefitEngine } from '../src/engine/BenefitEngine'
import { projectRetirement as domRetire } from '../src/domain/benefit/calculator'
import { Cent, Rate } from '../src/domain/shared/value-objects'

const rule = JSON.parse(readFileSync('public/rules/guangzhou.json', 'utf8'))
const svc = new ScenarioService(rule)

const base = {
  work: { city: 'guangzhou', dailyHours: 10, dailyOrders: 35, avgDistance: 2.5, workDaysMonth: 26, rainDaysMonth: 3, holidayDaysMonth: 2 },
  costs: { vehicleType: 'electric', fuelCostMonth: 0, electricityCostMonth: 300, maintenanceMonth: 200, insuranceMonth: 100, phoneCostMonth: 100, foodCostMonth: 800, trafficFineMonth: 50, vehicleDepreciationMonth: 300, otherCostMonth: 100 },
  personal: { currentAge: 25, expectedRetireAge: 60, hasSocialInsurance: false, specialDeductionMonth: 0, medicalTierId: undefined, pensionBase: undefined, medicalBase: undefined },
} satisfies Pick<ScenarioInput, 'work' | 'costs' | 'personal'>

function clone<T>(o: T): T { return JSON.parse(JSON.stringify(o)) as T }

type Patch = { work?: Record<string, unknown>; costs?: Record<string, unknown>; personal?: Record<string, unknown> }

function run(name: string, patch?: Patch) {
  const p = clone(base)
  if (patch) {
    if (patch.work) Object.assign(p.work, patch.work)
    if (patch.costs) Object.assign(p.costs, patch.costs)
    if (patch.personal) Object.assign(p.personal, patch.personal)
  }
  const r = svc.runScenario({ id: name, name, ...p })
  if (!r.ok) { console.log(name + ': ERROR ' + r.error); return }
  const s = r.value
  const g = s.income.grossIncome, net = s.netMonthly
  const daily = net / p.work.workDaysMonth
  const hourly = net / (p.work.dailyHours * p.work.workDaysMonth)
  const monthlyShare = g > 0 ? s.tax.annualTax / 12 / g * 100 : 0
  console.log('\n== ' + name)
  console.log('  ' + p.work.dailyOrders + '单/天 ' + p.work.dailyHours + 'h 距离' + p.work.avgDistance + 'km 月' + p.work.workDaysMonth + '天')
  console.log('  毛/月=' + g + '  日均毛=' + (g / p.work.workDaysMonth).toFixed(0) + '  时均毛=' + hourly.toFixed(1))
  console.log('  成本/月=' + s.costBreakdown.total + '  月税=' + (s.tax.annualTax / 12).toFixed(0) + '  年税=' + s.tax.annualTax + '  有效税率=' + s.tax.effectiveRate + '%  月扣占比=' + monthlyShare.toFixed(1) + '%')
  console.log('  社保/月=' + s.benefit.totalMonthly + '  净/月=' + net.toFixed(1) + '  日均净=' + daily.toFixed(0))
  console.log('  权益评分=' + s.rightsScore + '  推荐=' + s.recommendation)
  console.log('  洞察: ' + s.keyInsights.join(' | '))
  return s
}

run('S1 新手兼职(15单/月15天)', {
  work: { dailyOrders: 15, dailyHours: 4, avgDistance: 2, workDaysMonth: 15, rainDaysMonth: 1, holidayDaysMonth: 0 },
  costs: { electricityCostMonth: 100, maintenanceMonth: 80, insuranceMonth: 0, phoneCostMonth: 50, foodCostMonth: 300, trafficFineMonth: 0, vehicleDepreciationMonth: 100, otherCostMonth: 0 },
})

run('S2 全职不参保', {
  costs: { foodCostMonth: 1000, maintenanceMonth: 300, electricityCostMonth: 500, vehicleDepreciationMonth: 400, phoneCostMonth: 100, insuranceMonth: 200, trafficFineMonth: 100, otherCostMonth: 100 },
})

run('S3 高单量全职(60单)', {
  work: { dailyOrders: 60, avgDistance: 3 },
  costs: { foodCostMonth: 1500, maintenanceMonth: 400, electricityCostMonth: 700, vehicleDepreciationMonth: 600, phoneCostMonth: 150, insuranceMonth: 300, trafficFineMonth: 150, otherCostMonth: 200 },
})

run('S4 燃油车高成本', {
  costs: { vehicleType: 'fuel', fuelCostMonth: 1800, electricityCostMonth: 0, maintenanceMonth: 500, insuranceMonth: 800, vehicleDepreciationMonth: 1000, foodCostMonth: 1000 },
})

run('S5 全职缴社保(默认基数=申报收入)', { personal: { hasSocialInsurance: true } })

run('S6 全职缴最低基数', { personal: { hasSocialInsurance: true, pensionBase: 5521, medicalBase: 6234 } })

const contrib = Cent.create(5521 * 100 * 0.08)
const dr = domRetire(25, 60, contrib, 15, Rate.create(0.03), Rate.create(0.6), Cent.create(9493 * 100))
if (dr.ok) {
  const v = dr.value
  console.log('\n== S7 domain口径: 25岁起按最低基数缴15年(40岁停缴)，60岁领取')
  console.log('  个人账户=' + v.personalAccount / 100 + '  基础养老金/月=' + v.basePension / 100 + '  个账养老金/月=' + v.personalPension / 100)
  console.log('  缴费 15 年（180 个月）后账户仅复利至 60 岁，计发月数按 60 岁取 139；账户只注 8% 个账部分')
}

const gz = new BenefitEngine(rule.benefit, rule.retirement)
const r = gz.projectRetirement(25, 60, Math.round(5521 * 0.08), 35, 0.03)
console.log('\n== 退休面板口径: 25岁起按最低基数缴至60岁（个账月注 442 元）')
console.log('  个人账户=' + r.personalAccount + '  基础=' + r.basePension + '  个账养老金=' + r.personalPension + '  月合计=' + r.totalPension)
