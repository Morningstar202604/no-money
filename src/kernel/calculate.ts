/**
 * 计算内核（calculation kernel）
 *
 * 为什么存在这一层：
 * 项目原本只有 Web 一个入口，测算逻辑分散在 Pinia store 与各面板里。当要新增
 * CLI、MCP server、HTTP API 三个入口时，如果各自重新拼装参数，就会出现
 * 「同一个输入，Web 算出一个数、CLI 算出另一个数」——这类缺陷极难发现，
 * 因为每个入口单独测都是绿的。
 *
 * 这里把「加载城市规则 → 归一化参数 → 调领域纯函数 → 返回结构化结果」收成一条路径，
 * 四个入口全部调它。入口层只负责参数解析与结果格式化。
 *
 * 设计约束：
 * - 不依赖 Vue / Pinia / DOM，可在 Node 与浏览器两端运行
 * - 规则文件读取通过注入的 loader 完成，浏览器传 fetch 版本，Node 传 fs 版本
 * - 输出是纯 JSON 可序列化结构，供 CLI 打印、HTTP 返回、MCP tool result 使用
 */
import type { CityRule, PersonalParams, WorkParams, CostParams, ScenarioResult } from '../types'
import { ScenarioService, type ScenarioInput } from '../application/scenario/ScenarioService'
import { round2 } from '../domain/shared/number'
import { scoreLevel } from '../utils/score'
import {
  DEFAULT_WORK,
  DEFAULT_COSTS,
  DEFAULT_PERSONAL,
} from '../domain/shared/defaults'

/** 规则加载器：浏览器与 Node 各自实现，内核不关心来源 */
export type RuleLoader = (city: string) => Promise<CityRule>

/**
 * 默认参数从 src/domain/shared/defaults.ts 唯一出口。
 *
 * 为什么要从内核再导出：tests/share.spec.ts 等调用方通过 `../kernel/calculate`
 * 取默认值构造分享参数基准。直接 re-export 保证它们拿到的与 Web、CLI、API、MCP
 * 是同一份对象，而不是又一份复制品。
 */
export { DEFAULT_WORK, DEFAULT_COSTS, DEFAULT_PERSONAL }

/**
 * 产能模型默认值：与 DEFAULT_WORK / DEFAULT_COSTS / DEFAULT_PERSONAL 一样
 * 从内核统一出口。tests/share.spec.ts 依赖它构造分享参数基准——漏导出时
 * esbuild 运行时是 undefined，静默把空 capacityModel 编进分享链接，
 * 所以默认值必须只从内核取、并经 typecheck:test 卡住。
 */
export { DEFAULT_CAPACITY } from '../domain/income/capacity'

/** 一次测算的完整输入 */
export interface CalculateRequest {
  city: string
  /** 工作参数；缺省字段用该城市的合理默认值填充 */
  work?: Partial<WorkParams>
  /** 成本参数 */
  costs?: Partial<CostParams>
  /** 个人与税务参数 */
  personal?: Partial<PersonalParams>
  /** 场景名称，仅用于结果标注 */
  scenarioName?: string
}

/** 精简后的测算输出：字段名稳定，供 CLI/API/MCP 直接消费 */
export interface CalculateResult {
  city: string
  cityName: string
  scenarioName: string
  /** 月净收入（元） */
  netMonthly: number
  /** 年净收入（元） */
  netAnnual: number
  /** 有效时薪（元） */
  netHourly: number
  /** 月总收入（元，税前） */
  grossMonthly: number
  /** 月总成本（元） */
  totalCost: number
  /** 个税（元/月均值） */
  taxMonthly: number
  /** 社保个人缴纳（元/月） */
  socialInsuranceMonthly: number
  /** 权益评分 0-100 */
  rightsScore: number
  /** 评分等级文案 */
  rightsLevel: string
  /** 主要风险点 */
  rightsFlags: string[]
  /** 成本明细 */
  costBreakdown: Record<string, number>
  /** 数据可信度：该城市是否有未核实字段 */
  dataConfidence: 'official' | 'partial' | 'unverified'
  /** 未核实的字段名（中文），供调用方如实展示 */
  unverifiedFields: string[]
}

/** 从规则里挑出未核实字段，转成中文名 */
const FIELD_LABELS: Record<string, string> = {
  pension: '养老金计发基数',
  pensionRate: '养老保险费率',
  medical: '医疗保险',
  tax: '个税税率表',
  minimumWage: '最低工资',
  retirement: '退休测算参数',
  income: '计价单价/补贴',
  soleVat: '个体户增值税',
  soleItr: '个体户经营所得税率',
}

export function collectUnverifiedFields(rule: CityRule): string[] {
  const out: string[] = []
  for (const [key, source] of Object.entries(rule.sources ?? {})) {
    if (source && source.confidence !== 'official') {
      out.push(FIELD_LABELS[key] ?? key)
    }
  }
  return out
}

/** 合并默认值与用户输入；显式传入的 undefined/null 不应覆盖默认 */
function mergeDefined<T extends object>(base: T, patch?: Partial<T>): T {
  if (!patch) return { ...base }
  const out = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined && v !== null) (out as Record<string, unknown>)[k] = v
  }
  return out
}

/**
 * 执行一次测算。
 *
 * 这是所有入口的唯一入口点。任何新入口都应该调用它，而不是自己拼 ScenarioService。
 */
export async function calculate(
  request: CalculateRequest,
  loadRule: RuleLoader,
): Promise<CalculateResult> {
  const rule = await loadRule(request.city)
  if (!rule) throw new Error(`未找到城市规则：${request.city}`)

  const work = { ...mergeDefined(DEFAULT_WORK, request.work), city: request.city } as WorkParams
  const costs = mergeDefined(DEFAULT_COSTS, request.costs)
  const personal = mergeDefined(DEFAULT_PERSONAL, request.personal) as PersonalParams

  const service = new ScenarioService(rule)
  const input: ScenarioInput = {
    id: 'cli',
    name: request.scenarioName ?? '当前方案',
    work,
    costs,
    personal,
  }

  const result = service.runScenario(input)
  if (!result.ok) {
    throw new Error(`测算失败：${result.error.message ?? String(result.error)}`)
  }

  return toCalculateResult(result.value, rule)
}

/** 把应用层的 ScenarioResult 压平成稳定的对外契约 */
export function toCalculateResult(result: ScenarioResult, rule: CityRule): CalculateResult {
  const unverified = collectUnverifiedFields(rule)
  const hasOfficial = Object.values(rule.sources ?? {}).some((s) => s?.confidence === 'official')
  // 个税按月均值给出：年度税额 ÷ 12，避免单月波动误导
  const taxMonthly = result.tax.annualTax / 12
  return {
    city: rule.city,
    cityName: rule.cityName,
    scenarioName: result.name,
    netMonthly: round2(result.netMonthly),
    netAnnual: round2(result.netAnnual),
    netHourly: round2(result.netHourly),
    grossMonthly: round2(result.income.grossIncome),
    totalCost: round2(result.costBreakdown.total),
    taxMonthly: round2(taxMonthly),
    socialInsuranceMonthly: round2(result.benefit.totalMonthly),
    rightsScore: result.rightsScore,
    rightsLevel: scoreLevel(result.rightsScore),
    rightsFlags: result.rightsFlags ?? [],
    // 只保留数值项：vehicleType 是枚举字符串，混在金额明细里会被误当金额
    costBreakdown: Object.fromEntries(
      Object.entries(result.costBreakdown)
        .filter(([k, v]) => k !== 'total' && typeof v === 'number')
        .map(([k, v]) => [k, round2(v as number)]),
    ),
    dataConfidence: unverified.length === 0 ? 'official' : hasOfficial ? 'partial' : 'unverified',
    unverifiedFields: unverified,
  }
}

