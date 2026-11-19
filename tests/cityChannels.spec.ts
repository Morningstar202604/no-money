import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  CITY_CHANNELS,
  CITY_SERVICE_LABELS,
  CITY_SERVICE_ORDER,
  cityChannelOf,
  cityServiceEntries,
  resolveServiceChannel,
} from '../src/data/cityChannels'

const TARGET_CITIES = ['beijing', 'shanghai', 'guangzhou', 'shenzhen', 'chengdu', 'chongqing', 'wuhan', 'xian', 'zhengzhou', 'hangzhou']

const OFFICIAL_HOST = /(\.gov\.cn|^shzfgjj\.cn|^www\.shzfgjj\.cn|^cqgjj\.cn|^www\.cqgjj\.cn)$/

describe('10 城本地官方入口', () => {
  it('恰好覆盖 3.6.0 的 10 个深核城市', () => {
    expect(CITY_CHANNELS.map((c) => c.city).sort()).toEqual([...TARGET_CITIES].sort())
    expect(new Set(CITY_CHANNELS.map((c) => c.city)).size).toBe(10)
  })

  it('每城四类入口齐全，名称、地址、核验日期都不空', () => {
    for (const channel of CITY_CHANNELS) {
      expect(channel.label, channel.city).toBeTruthy()
      expect(channel.lastVerified, channel.city).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(channel.hotlines, channel.city).toContain('12333')
      for (const key of CITY_SERVICE_ORDER) {
        const link = channel.services[key]
        expect(link.name, `${channel.city}/${key}`).toBeTruthy()
        expect(link.url, `${channel.city}/${key}`).toMatch(/^https?:\/\//)
        expect(link.note, `${channel.city}/${key}`).toBeTruthy()
      }
    }
  })

  it('只指向官方域名，不混入商业中介或聚合站', () => {
    for (const channel of CITY_CHANNELS) {
      for (const key of CITY_SERVICE_ORDER) {
        const host = new URL(channel.services[key].url).host
        expect(host, `${channel.city}/${key}`).toMatch(OFFICIAL_HOST)
      }
    }
  })

  it('不写城市级金额，金额口径交给当地文件', () => {
    for (const channel of CITY_CHANNELS) {
      const text = [channel.label, channel.hotlines, ...CITY_SERVICE_ORDER.map((k) => `${channel.services[k].name}${channel.services[k].note ?? ''}`)].join('')
      expect(text).not.toMatch(/\d+\s*元/)
    }
  })

  it('支持城市 id/中文名查表，未深核城市明确返回 null', () => {
    expect(cityChannelOf('beijing')?.label).toBe('北京')
    expect(cityChannelOf('北京')?.city).toBe('beijing')
    expect(cityChannelOf('深圳市')?.city).toBe('shenzhen')
    expect(cityChannelOf('unknown-city')).toBeNull()
    expect(cityChannelOf(null)).toBeNull()
  })

  it('四类入口按固定顺序输出，便于 UI 稳定渲染', () => {
    const beijing = cityChannelOf('beijing')
    expect(beijing).not.toBeNull()
    const entries = cityServiceEntries(beijing!)
    expect(entries.map((e) => e.key)).toEqual(CITY_SERVICE_ORDER)
    expect(entries.map((e) => e.label)).toEqual(CITY_SERVICE_ORDER.map((k) => CITY_SERVICE_LABELS[k]))
  })
})


describe('统一省市入口解析', () => {
  it('深核城市返回市级四类入口和核验日期', () => {
    const resolved = resolveServiceChannel('guangzhou')
    expect(resolved?.level).toBe('city')
    expect(resolved?.city).toBe('广州')
    expect(resolved?.lastVerified).toBe('2026-11-19')
    for (const key of CITY_SERVICE_ORDER) {
      expect(resolved?.services[key].url, `guangzhou/${key}`).toMatch(/^https?:\/\//)
      expect(resolved?.services[key].name, `guangzhou/${key}`).toBeTruthy()
    }
  })

  it('未深核但有省级数据的城市回退省级，不编市级链接', () => {
    const resolved = resolveServiceChannel('佛山市')
    expect(resolved?.level).toBe('province')
    expect(resolved?.province).toBe('广东')
    expect(resolved?.services.social.url).toMatch(/^https?:\/\//)
    expect(resolved?.services.housing.url, '公积金没有省级直达就不给链接').toBe('')
    expect(resolved?.services.housing.note).toContain('12329')
  })

  it('完全未知城市返回 null，不默认当成广东', () => {
    expect(resolveServiceChannel('unknown-city')).toBeNull()
    expect(resolveServiceChannel(null)).toBeNull()
  })

  it('UI 只走统一解析器，不再各拼一套市级/省级判断', () => {
    const wizard = readFileSync(new URL('../src/components/RightsWizard.vue', import.meta.url), 'utf8')
    const links = readFileSync(new URL('../src/components/CityServiceLinks.vue', import.meta.url), 'utf8')
    expect(wizard).toMatch(/resolveServiceChannel/)
    expect(wizard).not.toMatch(/cityChannelOf|getProvinceChannel/)
    expect(links).toMatch(/resolveServiceChannel/)
    expect(links).not.toMatch(/cityChannelOf/)
  })
})
