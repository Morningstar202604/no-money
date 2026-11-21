/**
 * 引擎自检脚本（`npm run verify`）。
 *
 * 必须真正失败：此前所有检查只 console.log，失败也返回 exit 0，
 * 属于「假绿灯」——CI 或人看到绿色就以为闭合了。现在任何一项不通过
 * 都会打印明细并以非零码退出。
 *
 * 0.0.43 起旧 `src/engine` 已删除，本脚本只验生产路径 `ScenarioService`，
 * 不再保留「旧引擎基准」——基准必须是独立金样本，而不是另一套会漂移的实现。
 */

import { readFileSync } from 'fs'
import { ScenarioService } from '../src/application/scenario/ScenarioService'
import type { CityRule } from '../src/types'
import { DEFAULT_WORK, DEFAULT_COSTS, DEFAULT_PERSONAL } from '../src/domain/shared/defaults'

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
const work = DEFAULT_WORK
const costs = DEFAULT_COSTS
const personal = DEFAULT_PERSONAL

const svc = new ScenarioService(rule)

const uninsured = svc.runScenario({ id: 'current', name: '未参保', work, costs, personal })
const insured = svc.runScenario({ id: 'insured', name: '已参保', work, costs, personal: { ...personal, hasSocialInsurance: true } })

if (!uninsured.ok || !insured.ok) {
  const failed = uninsured.ok ? insured : uninsured
  check(false, 'ScenarioService 必须能跑通未参保/已参保两套方案',
    JSON.stringify(failed.ok ? 'unknown' : failed.error))
} else {
  const u = uninsured.value
  const i = insured.value

  const sum = u.income.basePay + u.income.distancePay + u.income.subsidyPay + u.income.bonusPay
  check(Math.abs(sum - u.income.grossIncome) < 0.011, '收入分项之和 === 毛收入',
    `分项之和 ${sum} vs 毛收入 ${u.income.grossIncome}`)

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
  check(Math.abs(pieSum - u.costBreakdown.total) < 0.011, '成本饼图分片合计 === 成本合计',
    `分片合计 ${pieSum} vs 成本合计 ${u.costBreakdown.total}（缺项 ${(u.costBreakdown.total - pieSum).toFixed(2)} 元）`)

  const closed = Math.abs(u.netMonthly - (u.income.grossIncome - u.costBreakdown.total - u.tax.annualTax / 12 - u.benefit.totalMonthly))
  check(closed < 0.011, '净收入恒等式必须闭合', `误差 ${closed}`)
  check(i.netMonthly < u.netMonthly, '已参保净收入应低于未参保', `${i.netMonthly} vs ${u.netMonthly}`)
  check(i.rightsScore > u.rightsScore, '已参保权益分应高于未参保', `${i.rightsScore} vs ${u.rightsScore}`)
  check(u.rightsScore >= 0 && u.rightsScore <= 100, '权益评分必须在 0–100', String(u.rightsScore))
  check(Math.abs(u.netAnnual - u.netMonthly * 12) <= 0.1, '年净收入 === 月净收入 × 12（容差 0.1 元）', `${u.netAnnual} vs ${u.netMonthly * 12}`)

  console.log('\n=== 未参保 ===')
  console.log('月收入', u.income.grossIncome, '月成本', u.costBreakdown.total, '月个税', (u.tax.annualTax / 12).toFixed(2))
  console.log('社保自缴', u.benefit.totalMonthly, '净收入', u.netMonthly, '时薪', u.netHourly)
  console.log('权益分', u.rightsScore, '评级', u.recommendation, '缺口', u.rightsFlags.length, '项')

  console.log('\n=== 已参保 ===')
  console.log('社保自缴', i.benefit.totalMonthly, '(养老', i.benefit.pensionMonthly, '+ 医保', i.benefit.medicalMonthly, ')')
  console.log('净收入', i.netMonthly, '时薪', i.netHourly, '权益分', i.rightsScore, '评级', i.recommendation)

  console.log('\n=== 参保的真实代价与收益 ===')
  console.log('每月少拿', (u.netMonthly - i.netMonthly).toFixed(2), '元；权益分变化', u.rightsScore, '->', i.rightsScore)
}

if (failures.length > 0) {
  console.error('\n=== 自检失败 ===')
  for (const f of failures) console.error(' ✗ ' + f)
  process.exitCode = 1
} else {
  console.log('\n=== 自检通过 ===')
}
