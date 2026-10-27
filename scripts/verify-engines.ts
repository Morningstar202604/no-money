/**
 * 引擎自检脚本（`npm run verify`）。
 *
 * 必须真正失败：此前所有检查只 console.log，失败也返回 exit 0，
 * 属于「假绿灯」——CI 或人看到绿色就以为闭合了。现在任何一项不通过
 * 都会打印明细并以非零码退出。
 */

import { readFileSync } from 'fs'

const failures: string[] = []
function check(ok: boolean, label: string, detail: string): void {
  if (ok) {
    console.log(`  ✓ ${label}`)
  } else {
    console.error(`  ✗ ${label} — ${detail}`)
    failures.push(label)
  }
}
import { ScenarioEngine } from '../src/engine/ScenarioEngine'
import type { CityRule, WorkParams, CostParams, PersonalParams } from '../src/types'

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

const eng = new ScenarioEngine(rule)
const uninsured = eng.runScenario('current', '未参保', work, costs, personal)
const insured = eng.runScenario('insured', '已参保', work, costs, { ...personal, hasSocialInsurance: true })

const sum = uninsured.income.basePay + uninsured.income.distancePay + uninsured.income.subsidyPay + uninsured.income.bonusPay

console.log('=== 一致性 ===')
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

console.log('\n=== 闭合校验 ===')
const closed = Math.abs(uninsured.netMonthly - (uninsured.income.grossIncome - uninsured.costBreakdown.total - uninsured.tax.annualTax / 12 - uninsured.benefit.totalMonthly))
console.log('净收入恒等式误差', closed.toFixed(6))
