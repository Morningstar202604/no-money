/**
 * 引擎自检脚本（`npm run verify`）。
 *
 * 必须真正失败：此前所有检查只 console.log，失败也返回 exit 0，
 * 属于「假绿灯」——CI 或人看到绿色就以为闭合了。现在任何一项不通过
 * 都会打印明细并以非零码退出。
 *
 * 同时校验两条路径：生产路径 `ScenarioService`（domain 引擎）与对拍基准
 * `ScenarioEngine`（旧引擎）。只验旧引擎等于没验用户实际看到的数字。
 */

import { readFileSync } from 'fs'
import { ScenarioEngine } from '../src/engine/ScenarioEngine'
import { ScenarioService } from '../src/application/scenario/ScenarioService'
import type { CityRule, WorkParams, CostParams, PersonalParams } from '../src/types'

const failures: string[] = []
function check(ok: boolean, label: string, detail: string): void {
  if (ok) {
    console.log(`  ✓ ${label}`)
  } else {
    console.error(`  ✗ ${label} — ${detail}`)
    failures.push(label)
  }
}

const rule = JSON.parse(readFileSync('public/rules/guangzhou.json', 'utf8')) as CityRule
const work: WorkParams = {
  city: 'guangzhou', dailyHours: 10, dailyOrders: 35,
  avgDistance: 2.5, workDaysMonth: 26, rainDaysMonth: 3, holidayDaysMonth: 2,
}
const costs: CostParams = {
  vehicleType: 'electric', fuelCostMonth: 0, electricityCostMonth: 300, maintenanceMonth: 200,
  insuranceMonth: 100, phoneCostMonth: 100, foodCostMonth: 800, trafficFineMonth: 50,
  vehicleDepreciationMonth: 300, otherCostMonth: 100,
}
const personal: PersonalParams = {
  currentAge: 25, expectedRetireAge: 60, hasSocialInsurance: false, specialDeductionMonth: 0,
}

const legacy = new ScenarioEngine(rule)
const svc = new ScenarioService(rule)

const uninsured = legacy.runScenario('current', '未参保', work, costs, personal)
const insured = legacy.runScenario('insured', '已参保', work, costs, { ...personal, hasSocialInsurance: true })

const sum = uninsured.income.basePay + uninsured.income.distancePay + uninsured.income.subsidyPay + uninsured.income.bonusPay

console.log('=== 一致性（旧引擎基准）===')
check(sum === uninsured.income.grossIncome, '收入分项之和 === 毛收入',
  `分项之和 ${sum} vs 毛收入 ${uninsured.income.grossIncome}`)

// 收支饼图闭合校验：饼图各分片之和必须等于成本合计。
// 仅打印 phoneCost/otherCost 这类原始输入无法证明「图表是否漏项」——必须按饼图
// 实际分片（见 IncomeDetail.vue costPieOption）累加后再对齐 costBreakdown.total。
const pieSlices = {
  油电: costs.fuelCostMonth + costs.electricityCostMonth,
  维护: costs.maintenanceMonth,
  保险: costs.insuranceMonth,
  通讯: costs.phoneCostMonth,
  餐饮: costs.foodCostMonth,
  罚款: costs.trafficFineMonth,
  折旧: costs.vehicleDepreciationMonth,
  其他: costs.otherCostMonth,
}
const pieSum = Object.values(pieSlices).reduce((a, b) => a + b, 0)
check(pieSum === uninsured.costBreakdown.total, '成本饼图分片合计 === 成本合计',
  `分片合计 ${pieSum} vs 成本合计 ${uninsured.costBreakdown.total}（缺项 ${(uninsured.costBreakdown.total - pieSum).toFixed(2)} 元）`)

console.log('\n=== 未参保 ===')
console.log('月收入', uninsured.income.grossIncome, '月成本', uninsured.costBreakdown.total, '月个税', (uninsured.tax.annualTax / 12).toFixed(2))
console.log('社保自缴', uninsured.benefit.totalMonthly, '净收入', uninsured.netMonthly, '时薪', uninsured.netHourly)
console.log('权益分', uninsured.rightsScore, '评级', uninsured.recommendation, '缺口', uninsured.rightsFlags.length, '项')

console.log('\n=== 已参保 ===')
console.log('社保自缴', insured.benefit.totalMonthly, '(养老', insured.benefit.pensionMonthly, '+ 医保', insured.benefit.medicalMonthly, ')')
console.log('净收入', insured.netMonthly, '时薪', insured.netHourly, '权益分', insured.rightsScore, '评级', insured.recommendation)

console.log('\n=== 参保的真实代价与收益 ===')
console.log('每月少拿', (uninsured.netMonthly - insured.netMonthly).toFixed(2), '元；权益分变化', uninsured.rightsScore, '->', insured.rightsScore)

console.log('\n=== 生产路径（ScenarioService）与旧引擎对拍 ===')
const prod = svc.runScenario({ id: 'current', name: '未参保', work, costs, personal })
if (!prod.ok) {
  check(false, 'ScenarioService 必须能跑通', JSON.stringify(prod.error))
} else {
  const p = prod.value
  check(Math.abs(p.netMonthly - uninsured.netMonthly) < 0.011, '生产路径净收入 === 旧引擎基准',
    `${p.netMonthly} vs ${uninsured.netMonthly}`)
  check(p.rightsScore === uninsured.rightsScore, '生产路径权益分 === 旧引擎基准', `${p.rightsScore} vs ${uninsured.rightsScore}`)

  const closedProd = Math.abs(p.netMonthly - (p.income.grossIncome - p.costBreakdown.total - p.tax.annualTax / 12 - p.benefit.totalMonthly))
  console.log('生产路径净收入恒等式误差', closedProd.toFixed(6))
  check(closedProd < 0.011, '生产路径净收入恒等式必须闭合', `误差 ${closedProd}`)
  check(p.rightsScore >= 0 && p.rightsScore <= 100, '生产路径权益评分必须在 0–100', String(p.rightsScore))
  check(Math.abs(p.netAnnual - p.netMonthly * 12) <= 0.1, '年净收入 === 月净收入 × 12（容差 0.1 元）', `${p.netAnnual} vs ${p.netMonthly * 12}`)
}

console.log('\n=== 闭合校验（旧引擎）===')
const closed = Math.abs(uninsured.netMonthly - (uninsured.income.grossIncome - uninsured.costBreakdown.total - uninsured.tax.annualTax / 12 - uninsured.benefit.totalMonthly))
console.log('净收入恒等式误差', closed.toFixed(6))
check(closed < 0.011, '净收入恒等式必须闭合', `误差 ${closed}`)
check(insured.netMonthly < uninsured.netMonthly, '已参保净收入应低于未参保', `${insured.netMonthly} vs ${uninsured.netMonthly}`)
check(insured.rightsScore > uninsured.rightsScore, '已参保权益分应高于未参保', `${insured.rightsScore} vs ${uninsured.rightsScore}`)
check(uninsured.rightsScore >= 0 && uninsured.rightsScore <= 100, '权益评分必须在 0–100', String(uninsured.rightsScore))

if (failures.length > 0) {
  console.error('\n=== 自检失败 ===')
  for (const f of failures) console.error(' ✗ ' + f)
  process.exitCode = 1
} else {
  console.log('\n=== 自检通过 ===')
}
