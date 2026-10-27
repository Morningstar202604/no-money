/**
 * 知识库测试
 *
 * 1. 条目结构纪律：id 唯一、标题非空、链接为 http(s) 全地址（与 reality/guide 同一标准）。
 * 2. 检索行为：中文命中（"个人养老金"/"断缴"/"延迟退休"）、类型过滤、空查询、limit。
 * 3. 导出同步：public/knowledge/kb.json 必须与当前数据源一致（条数/计数），
 *    改了数据忘跑 `npm run kb:export` 会在这里被拦下。
 */

import { describe, it, expect } from 'vitest'
import { loadRuleFile, loadAllRules, loadAllRulesArray } from './helpers/rules'
import { readFileSync } from 'node:fs'
import {
  buildStaticKbEntries,
  buildKbPayload,
  citySourceEntries,
  searchKnowledge,
  tokenizeQuery,
  expandQuery,
  kbContextForPrompt,
  KB_TYPE_LABELS,
  SYNONYMS,
  missingSynonymTargets,
} from '../src/utils/knowledge'
import type { CityRule } from '../src/types'
import { CITY_REGISTRY } from '../src/data/cities'

// 与 scripts/export-kb.ts 同源：全部城市，避免新增城市后导出文件与测试口径不一致
const CITIES = CITY_REGISTRY.map(c => c.value)
const rules = CITIES.map(c => loadRuleFile(`${c}.json`))

describe('知识库条目结构', () => {
  const entries = buildStaticKbEntries()

  it('id 唯一，标题与分类非空，type 合法', () => {
    const ids = entries.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of entries) {
      expect(e.title.length, `${e.id} 缺标题`).toBeGreaterThan(0)
      expect(e.category.length, `${e.id} 缺分类`).toBeGreaterThan(0)
      expect(KB_TYPE_LABELS[e.type], `${e.id} type 非法`).toBeTruthy()
    }
  })

  it('链接若存在必须是 http(s) 完整地址', () => {
    for (const e of entries) {
      for (const l of e.links) {
        expect(l.url, `${e.id} 链接不是 http(s): ${l.url}`).toMatch(/^https?:\/\/[^\s]+$/)
      }
    }
  })

  it('四类静态条目都存在（policy/guide/reality 至少各一条；source 由城市规则提供）', () => {
    expect(entries.filter(e => e.type === 'policy').length).toBeGreaterThan(0)
    expect(entries.filter(e => e.type === 'guide').length).toBeGreaterThan(0)
    expect(entries.filter(e => e.type === 'reality').length).toBeGreaterThan(0)
    expect(citySourceEntries(null)).toEqual([])
    expect(citySourceEntries(rules[0]).length).toBeGreaterThan(0)
  })

  it('buildKbPayload 的 counts 与条目数一致', () => {
    const payload = buildKbPayload(rules, '2026-10-14T00:00:00.000Z')
    const sum = Object.values(payload.counts).reduce((a, b) => a + b, 0)
    expect(sum).toBe(payload.entries.length)
    expect(payload.counts.source).toBeGreaterThan(0)
  })
})

describe('知识库检索', () => {
  it('中文查询命中正确条目', () => {
    const hits = searchKnowledge('个人养老金', { limit: 5 })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].entry.id).toBe('guide-personal-pension')
  })

  it('"医保断缴"相关内容进前列', () => {
    const ids = searchKnowledge('医保断缴', { limit: 5 }).map(h => h.entry.id)
    expect(ids).toContain('guide-medical-broken')
  })

  it('"延迟退休"命中手册或现实核查条目', () => {
    const ids = searchKnowledge('延迟退休', { limit: 5 }).map(h => h.entry.id)
    expect(ids.includes('guide-retire-age') || ids.includes('reality-delay-retirement')).toBe(true)
  })

  it('显式传 city sources 时可检索到溯源条目', () => {
    const entries = [...buildStaticKbEntries(), ...citySourceEntries(rules[0])]
    const hits = searchKnowledge('缴费基数', { entries, limit: 10 })
    expect(hits.some(h => h.entry.type === 'source')).toBe(true)
  })

  it('类型过滤只返回该类型', () => {
    const hits = searchKnowledge('灵活就业', { limit: 10, type: 'policy' })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every(h => h.entry.type === 'policy')).toBe(true)
  })

  it('空查询与无意义查询返回空数组而不是报错', () => {
    expect(searchKnowledge('')).toEqual([])
    expect(searchKnowledge('   ')).toEqual([])
    expect(searchKnowledge('zzzzqqqq')).toEqual([])
  })

  it('tokenizeQuery 生成 ASCII 词与 CJK 二元组', () => {
    const t = tokenizeQuery('AI 税优 health')
    expect(t.phrases).toContain('ai')
    expect(t.phrases).toContain('health')
    expect(t.bigrams.length).toBeGreaterThan(0)
  })
})

describe('口语词同义词扩展', () => {
  const entries = buildStaticKbEntries()

  it('expandQuery：口语触发词命中同义词目标，无关词不命中', () => {
    expect(expandQuery('被坑了').synTargets).toContain('骗')
    expect(expandQuery('社保').synTargets).toEqual([])
  })

  it('expandQuery 不把查询自带分词覆盖的词计入目标（避免双重计分）', () => {
    const r = expandQuery('被坑了，押金要不要')
    expect(r.synTargets).toContain('骗')
    expect(r.synTargets).not.toContain('押金')
  })

  it('原先 0 结果的口语查询现在有结果，且命中正确领域条目', () => {
    const cases: Array<[string, string]> = [
      ['收钱', 'reality-fee-scam'],
      ['被坑', 'guide-rookie-deposit'],
      ['套路', 'guide-rookie-deposit'],
      ['扣钱', 'guide-rookie-penalty'],
      ['克扣', 'guide-rookie-penalty'],
      ['提成', 'policy-gd-7'],
      ['拖欠工资', 'policy-gd-3'],
      ['口头约定', 'guide-rookie-contract'],
      ['月薪', 'guide-rookie-normal-pay'],
      ['避税', 'guide-special-deductions'],
      ['被坑了，怎么办？', 'guide-rookie-deposit'],
    ]
    for (const [q, expected] of cases) {
      const ids = searchKnowledge(q, { entries, limit: 3 }).map(h => h.entry.id)
      expect(ids.length, `口语搜索「${q}」无结果`).toBeGreaterThan(0)
      expect(ids, `「${q}」应命中 ${expected}`).toContain(expected)
    }
  })

  it('同义词表目标词必须真实存在于当前条目（防死同义词腐化）', () => {
    expect(missingSynonymTargets(entries)).toEqual([])
  })

  it('SYNONYMS 每个目标列表非空且无重复目标', () => {
    for (const [k, list] of Object.entries(SYNONYMS)) {
      expect(list.length, `同义词「${k}」目标列表为空`).toBeGreaterThan(0)
      expect(new Set(list).size, `同义词「${k}」目标重复`).toBe(list.length)
    }
  })
})

describe('AI 提示词上下文', () => {
  it('命中时返回带边界的上下文块，未命中返回空串', () => {
    const ctx = kbContextForPrompt('个人养老金', 2)
    expect(ctx).toContain('本地知识库检索结果')
    expect(ctx).toContain('个人养老金')
    expect(kbContextForPrompt('zzzzqqqq')).toBe('')
  })
})

describe('导出文件同步（public/knowledge/kb.json）', () => {
  it('kb.json 存在、schemaVersion=1，且与当前数据源同步', () => {
    const raw = readFileSync('public/knowledge/kb.json', 'utf8')
    const payload = JSON.parse(raw) as ReturnType<typeof buildKbPayload>
    expect(payload.schemaVersion).toBe(1)
    const fresh = buildKbPayload(rules, payload.generatedAt)
    // 必须逐字节比对内容，不能只比长度/ID：只改某条 summary 而忘记导出时，
    // 长度与 ID 都不变，测试会假通过
    expect(payload.entries, 'kb.json 与数据源不同步，请运行 npm run kb:export').toEqual(fresh.entries)
    expect(payload.counts).toEqual(fresh.counts)
  })
})
