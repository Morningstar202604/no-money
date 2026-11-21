import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CITY_REGISTRY } from '../src/data/cities'
import {
  CITY_FALLBACK_IDS,
  loadCityRules,
  summarizeCityRules,
  type CityRule,
  type CityRuleFetcher,
} from '../src/data/cityRules'

const rules = CITY_REGISTRY.map((city) =>
  JSON.parse(readFileSync(`public/rules/${city.value}.json`, 'utf8')) as CityRule,
)
const summary = summarizeCityRules(rules)

function fetcherWithIndex(index: string[] | null, missingId?: string): CityRuleFetcher {
  return async (url) => {
    if (url.endsWith('city-index.json')) {
      return index
        ? { ok: true, json: async () => index }
        : { ok: false, json: async () => null }
    }
    const id = url.split('/rules/')[1]?.replace(/\.json$/, '') ?? ''
    if (id === missingId) return { ok: false, json: async () => null }
    return {
      ok: true,
      json: async () => ({
        city: id,
        cityName: id,
        sources: { pension: { confidence: 'official' } },
      }),
    }
  }
}

describe('34 城规则加载与统计', () => {
  it('真实数据：343 条来源、225 条官方；7 项核心 186/238', () => {
    expect(summary.totals.cities).toBe(34)
    expect(summary.totals.sources).toBe(343)
    expect(summary.totals.official).toBe(225)
    expect(summary.totals.derived).toBe(50)
    expect(summary.totals.unverified).toBe(68)
    expect(summary.sourceCoverage).toEqual({ numerator: 225, denominator: 343, percent: 66 })
    expect(summary.totals.coreFields).toBe(238)
    expect(summary.totals.coreOfficial).toBe(186)
    expect(summary.coreCoverage).toEqual({ numerator: 186, denominator: 238, percent: 78 })
  })

  it('每个城市都有 7 项核心字段的明细分母，平台计价计入缺口', () => {
    for (const row of summary.rows) {
      expect(Object.keys(row.core)).toHaveLength(7)
      expect(row.coreGaps + row.coreOfficial + row.coreDerived).toBe(7)
      expect(row.core.income).not.toBe('official')
    }
  })

  it('索引缺失或不完整时回退到 34 城注册表，不再用页面各自的 38/8 城列表', async () => {
    for (const index of [null, CITY_FALLBACK_IDS.slice(0, 8)]) {
      const loaded = await loadCityRules('/', fetcherWithIndex(index))
      expect(loaded.usedRegistryFallback).toBe(true)
      expect(loaded.ids).toEqual(CITY_FALLBACK_IDS)
      expect(loaded.rules).toHaveLength(34)
      expect(loaded.missing).toEqual([])
    }
  })

  it('完整索引不触发回退，单城读取失败只进 missing', async () => {
    const loaded = await loadCityRules('/', fetcherWithIndex(CITY_FALLBACK_IDS, 'beijing'))
    expect(loaded.usedRegistryFallback).toBe(false)
    expect(loaded.rules).toHaveLength(33)
    expect(loaded.missing).toEqual(['beijing'])
  })
})
