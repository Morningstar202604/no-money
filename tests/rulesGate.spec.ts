/**
 * 规则文件溯源门禁（由 scripts/check-rules.mjs 移植，脚本已删除）。
 *
 * 规则文件是产品主张的一部分：数字可以待核实，但不允许「缺出处」「置信度误标」
 * 「official 却没有文号或链接」这类问题混进来。收敛进 vitest 后 `npm test`
 * 一条命令即覆盖引擎与数据两道门禁，不再依赖独立 CI。
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const RULES_DIR = join(__dirname, '..', 'public', 'rules')
const CONFIDENCE_LEVELS = ['official', 'derived', 'unverified']

const files = readdirSync(RULES_DIR).filter(f => f.endsWith('.json'))

type Source = { confidence?: string; docNo?: string; url?: string; retrievedAt?: string }
type RuleFile = {
  city?: string
  verified?: boolean
  sources?: Record<string, Source>
  benefit?: { medical?: { rate?: number }; medicalTiers?: { id: string; rate: number; note?: string }[] }
  retirement?: { benefitBaseMonthly?: number }
  soleProprietorship?: { vatRate?: number; vatThresholdMonthly?: number; itrIncomeRate?: number }
  tax?: { soleRate?: unknown }
}

const rules: Record<string, RuleFile> = {}
for (const f of files) {
  rules[f] = JSON.parse(readFileSync(join(RULES_DIR, f), 'utf8')) as RuleFile
}

describe('规则文件溯源门禁', () => {
  it('每个文件都是合法 JSON 且有城市标识', () => {
    expect(files.length).toBeGreaterThanOrEqual(15)
    for (const [f, rule] of Object.entries(rules)) {
      expect(rule.city, `${f} 缺 city 字段`).toBeTruthy()
    }
  })

  it('来源条目充足且每条有 confidence / retrievedAt', () => {
    for (const [f, rule] of Object.entries(rules)) {
      const sources = Object.entries(rule.sources ?? {})
      expect(sources.length, `${f} 来源条目不足`).toBeGreaterThanOrEqual(6)
      for (const [key, s] of sources) {
        expect(CONFIDENCE_LEVELS, `${f} ${key} 置信度非法: ${s.confidence}`).toContain(s.confidence)
        expect(s.retrievedAt, `${f} ${key} 缺 retrievedAt（无法判断数据时效）`).toBeTruthy()
      }
    }
  })

  it('official 必须有文号或链接；verified=true 则全部来源 official', () => {
    for (const [f, rule] of Object.entries(rules)) {
      for (const [key, s] of Object.entries(rule.sources ?? {})) {
        if (s.confidence === 'official') {
          expect(s.docNo || s.url, `${f} ${key} 标为 official 但既无文号也无链接`).toBeTruthy()
        }
      }
      if (rule.verified) {
        const allOfficial = Object.values(rule.sources ?? {}).every(s => s.confidence === 'official')
        expect(allOfficial, `${f} verified=true 但存在非 official 来源`).toBe(true)
      }
    }
  })

  it('医保分档：id/费率不重复、费率越界、缺口径说明、默认档必须在分档内', () => {
    for (const [f, rule] of Object.entries(rules)) {
      const tiers = rule.benefit?.medicalTiers
      if (!tiers) continue
      const sources = rule.sources ?? {}
      expect(sources.medical, `${f} 有 medicalTiers 但缺 medical 来源`).toBeTruthy()
      expect(sources.medical?.confidence, `${f} medicalTiers 存在但 medical 来源非 official`).toBe('official')

      const ids = tiers.map(t => t.id)
      expect(new Set(ids).size, `${f} medicalTiers 存在重复 id`).toBe(ids.length)
      const rates = tiers.map(t => t.rate)
      expect(new Set(rates).size, `${f} medicalTiers 存在重复费率`).toBe(rates.length)
      for (const t of tiers) {
        expect(t.rate > 0 && t.rate < 0.2, `${f} 档次 ${t.id} 费率越界: ${t.rate}`).toBe(true)
        expect(t.note, `${f} 档次 ${t.id} 缺口径说明`).toBeTruthy()
      }
      expect(rates, `${f} 默认档费率 ${rule.benefit?.medical?.rate} 不在任何 medicalTiers 中`).toContain(rule.benefit?.medical?.rate)
    }
  })

  it('退休计发基数不得被静默写死或缺失来源', () => {
    for (const [f, rule] of Object.entries(rules)) {
      expect(rule.retirement?.benefitBaseMonthly, `${f} 计发基数非法`).toBeGreaterThan(0)
      expect(rule.sources?.retirement, `${f} 缺 retirement 来源`).toBeTruthy()
    }
  })

  it('个税税率表必须从 0 起且档位连续（防止 findBracket 兜底把中段收入按顶格税率计）', () => {
    for (const [f, rule] of Object.entries(rules)) {
      const table = (rule as { tax?: { laborRemuneration?: { taxTable?: { min: number; max: number; rate: number }[] } } })
        .tax?.laborRemuneration?.taxTable
      expect(table?.length, `${f} 缺税率表`).toBeGreaterThanOrEqual(2)
      if (!table) continue
      expect(table[0].min, `${f} 税率表必须从 0 起`).toBe(0)
      for (let i = 1; i < table.length; i++) {
        expect(table[i].min, `${f} 税率表第 ${i} 档与上一档不连续`).toBe(table[i - 1].max)
        expect(table[i].rate, `${f} 税率表第 ${i} 档费率不升序`).toBeGreaterThan(table[i - 1].rate)
      }
    }
  })

  it('养老/医保基数下限必须小于上限（resolveBase 对反写区间会静默按下限计费）', () => {
    for (const [f, rule] of Object.entries(rules)) {
      const pension = rule.benefit as { pension?: { baseMin: number; baseMax: number } } | undefined
      expect(pension?.pension!.baseMax, `${f} 养老基数上限非法`).toBeGreaterThan(pension?.pension!.baseMin)
      const medical = (rule.benefit as { medical?: { baseMin: number; baseMax: number } } | undefined)?.medical
      if (medical && medical.baseMin !== undefined) {
        expect(medical.baseMax, `${f} 医保基数上限非法`).toBeGreaterThan(medical.baseMin)
      }
    }
  })

  it('个体户增值税与个税分列且各有来源；tax.soleRate 已废止', () => {
    for (const [f, rule] of Object.entries(rules)) {
      const sole = rule.soleProprietorship
      expect(sole, `${f} 缺 soleProprietorship 配置`).toBeTruthy()
      if (sole) {
        expect(sole.vatRate > 0 && sole.vatRate < 0.1, `${f} 增值税税率越界: ${sole.vatRate}`).toBe(true)
        expect(sole.vatThresholdMonthly, `${f} 增值税起征点非法`).toBeGreaterThan(0)
        expect(sole.itrIncomeRate > 0 && sole.itrIncomeRate < 1, `${f} 个税所得率越界: ${sole.itrIncomeRate}`).toBe(true)
      }
      expect(rule.sources?.soleVat?.docNo, `${f} 个体户增值税缺官方文号`).toBeTruthy()
      expect(rule.sources?.soleItr, `${f} 个体户个税缺来源`).toBeTruthy()
      expect(rule.tax?.soleRate, `${f} tax.soleRate 已废止，请改用 soleProprietorship.itrIncomeRate`).toBeUndefined()
    }
  })
})
