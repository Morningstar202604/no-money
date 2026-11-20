/**
 * 「怎么弄」页的唯一数据入口。
 *
 * 这里只做筛选和排序，不复制条目内容：
 * 教程正文、材料、时限、官方入口仍只维护在 RIGHTS_CATALOG 一处。
 */
import {
  RIGHTS_CATALOG,
  RIGHTS_CATEGORY_LABELS,
  type RightsCategory,
  type RightsItem,
} from './catalog'

/** 六段导航里「怎么弄」优先覆盖的 8 类；高温/税优/维权留在各自场景页。 */
export const GUIDE_CATEGORY_KEYS = [
  'social',
  'medical',
  'housing',
  'unemployment',
  'birth',
  'injury',
  'retire',
  'subsidy',
] as const satisfies readonly RightsCategory[]

export type GuideCategoryKey = (typeof GUIDE_CATEGORY_KEYS)[number]
export type GuideFilterKey = 'all' | GuideCategoryKey

const GUIDE_SCOPE = new Set<RightsCategory>(GUIDE_CATEGORY_KEYS)

export interface GuideFilter {
  key: GuideFilterKey
  label: string
  count: number
}

/** L2 = 有材料、编号步骤、坑与官方入口，能直接照着办。 */
export function isActionableGuide(item: RightsItem): boolean {
  return item.level === 'L2'
}

/** 按分类取可办教程；`all` 返回全部，顺序按 priority 稳定排列。 */
export function guidesForCategory(category: GuideFilterKey = 'all'): RightsItem[] {
  return RIGHTS_CATALOG
    .filter((item) => isActionableGuide(item)
      && GUIDE_SCOPE.has(item.category)
      && (category === 'all' || item.category === category))
    .slice()
    .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title, 'zh-CN'))
}

/** 只展示真实有 L2 内容的分类，避免出现点进去空白的筛选项。 */
export function guideFilters(): GuideFilter[] {
  const all = guidesForCategory('all')
  const categories = GUIDE_CATEGORY_KEYS
    .map((key) => ({
      key,
      label: RIGHTS_CATEGORY_LABELS[key],
      count: all.filter((item) => item.category === key).length,
    }))
    .filter((filter) => filter.count > 0)
  return [{ key: 'all', label: '全部', count: all.length }, ...categories]
}
