import { describe, expect, it } from 'vitest'
import {
  CITY_CHANNELS,
  CITY_SERVICE_LABELS,
  CITY_SERVICE_ORDER,
  cityChannelOf,
  cityServiceEntries,
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
