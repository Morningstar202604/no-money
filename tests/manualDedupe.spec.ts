import { describe, it, expect } from 'vitest'
import { splitManualGuides } from '../src/data/rights/manual'
import { RIGHTS_ENTRIES, type RightsEntryKey } from '../src/data/rights/entries'
import { rightsForEntry } from '../src/data/rights/catalog'

const { links, full } = splitManualGuides()

describe('民生手册去重', () => {
  it('21 条只留入口，2 条概念条目保留正文', () => {
    expect(links).toHaveLength(21)
    expect(full.map((item) => item.id)).toEqual(['retire-age', 'ltc-insurance'])
  })

  it('每条手册只出现一次，入口不重复', () => {
    const ids = [...links.map((link) => link.item.id), ...full.map((item) => item.id)]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('入口只落 /start 或 /guides，且 /start 的条目确实在该页签', () => {
    for (const link of links) {
      expect(['/start', '/guides']).toContain(link.to.split('?')[0])
      if (!link.to.startsWith('/start?entry=')) continue
      const entryKey = link.to.replace('/start?entry=', '')
      const entry = RIGHTS_ENTRIES.find((item) => item.key === entryKey)
      expect(entry, `未知入口 ${entryKey}`).toBeTruthy()
      expect(rightsForEntry(entryKey as RightsEntryKey).some((item) => item.guideId === link.item.id)).toBe(true)
    }
  })

  it('首页没有的 pension-exit 落到「怎么弄」的退休分类', () => {
    const link = links.find((item) => item.item.id === 'pension-exit')
    expect(link?.to).toBe('/guides?cat=retire')
  })
})
