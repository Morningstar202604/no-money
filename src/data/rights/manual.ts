/**
 * 民生手册的入口分流。
 *
 * 23 条手册正文只保留一份：能在「办事入口」或「怎么弄」找到的，
 * /policy 手册页只给入口，不再复制第二份正文；只有站内没有对应入口的
 * 概念条目（退休年龄、长期护理保险）才继续渲染 GuideCard。
 *
 * 这里按数据派生，不写死 21/2：以后新增手册条目时，只要能落到现有入口，
 * 就不会在 /policy 再长出一张全文卡。
 */
import { GUIDE_ITEMS, type GuideItem } from '../../utils/livingGuide'
import {
  RIGHTS_CATALOG,
  RIGHTS_CATEGORY_LABELS,
  rightsForEntry,
  type RightsCategory,
  type RightsItem,
} from './catalog'
import { RIGHTS_ENTRIES } from './entries'
import { guidesForCategory } from './guides'

export interface ManualGuideLink {
  item: GuideItem
  to: string
  targetLabel: string
}

export interface ManualGuideSplit {
  /** 正文已在 /start 或 /guides 的条目：这里只留入口 */
  links: ManualGuideLink[]
  /** 站内没有对应入口、只能在本页保留正文的概念条目 */
  full: GuideItem[]
}

/** 手册条目的 RightsItem 是 `guide-${id}`；用 guideId 取分类，避免拼字符串。 */
const rightsByGuideId = new Map(
  RIGHTS_CATALOG
    .filter((item): item is RightsItem & { guideId: string } => Boolean(item.guideId))
    .map((item) => [item.guideId, item]),
)

/**
 * 一个手册条目可能同时出现在多个入口（例如“灵活就业能参加哪些保险”
 * 同时属于 tasks / benefits / social）。固定按 RIGHTS_ENTRIES 的顺序取第一个，
 * 保证同一个条目每次跳同一个页签，不因数组顺序变化而漂移。
 */
const entryByGuideId = new Map<string, (typeof RIGHTS_ENTRIES)[number]>()
for (const entry of RIGHTS_ENTRIES) {
  for (const item of rightsForEntry(entry.key)) {
    if (item.guideId && !entryByGuideId.has(item.guideId)) {
      entryByGuideId.set(item.guideId, entry)
    }
  }
}

const guideEntryIds = new Set(
  guidesForCategory('all')
    .map((item) => item.guideId)
    .filter((id): id is string => Boolean(id)),
)

function guideTarget(rights: { category: RightsCategory } | undefined): string {
  if (rights) return `/guides?cat=${rights.category}`
  return '/guides'
}

export function splitManualGuides(): ManualGuideSplit {
  const links: ManualGuideLink[] = []
  const full: GuideItem[] = []

  for (const item of GUIDE_ITEMS) {
    const entry = entryByGuideId.get(item.id)
    if (entry) {
      links.push({
        item,
        to: `/start?entry=${entry.key}`,
        targetLabel: `办事入口 · ${entry.title}`,
      })
      continue
    }

    const rights = rightsByGuideId.get(item.id)
    if (guideEntryIds.has(item.id)) {
      links.push({
        item,
        to: guideTarget(rights),
        targetLabel: rights ? `怎么弄 · ${RIGHTS_CATEGORY_LABELS[rights.category]}` : '怎么弄',
      })
      continue
    }

    full.push(item)
  }

  return { links, full }
}
