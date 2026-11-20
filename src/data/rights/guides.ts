/**
 * 「怎么弄」页的唯一数据入口。
 *
 * 这里只做筛选、搜索和排序，不复制条目内容：
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

/**
 * 用户原话：按“他会怎么说”收词，不用政策术语。
 * 搜索只负责把原话落到条目，教程正文仍只维护在 RIGHTS_CATALOG。
 */
export const GUIDE_SEARCH_PHRASES: Record<string, string[]> = {
  'guide-how-to-pay': [
    '灵活就业人员怎么交社保',
    '自己交养老医保怎么扣费',
    '灵活就业缴费基数怎么选',
    '本省灵活就业参保入口',
  ],
  'guide-pension-exit': [
    '不想交社保了能退多少钱',
    '社保能退保吗',
    '养老金个人账户能取出来吗',
    '退保能拿回多少',
  ],
  'right-housing-fund': [
    '公积金怎么交',
    '公积金怎么提取',
    '租房提取公积金',
    '公积金能装修吗',
    '公积金开户',
  ],
  'right-birth-allowance': [
    '生育津贴怎么领',
    '产假工资和生育津贴是一回事吗',
    '生完孩子能领多少钱',
    '生育津贴按什么算',
  ],
  'right-flex-subsidy': [
    '灵活就业社保补贴怎么申请',
    '自己交社保有补贴吗',
    '4050社保补贴',
    '离校未就业毕业生补贴',
  ],
  'right-medical-cross-city': [
    '异地看病怎么报销',
    '去外地住院要备案吗',
    '跨省异地就医备案',
    '异地就医没备案怎么办',
  ],
  'right-retire-process': [
    '退休怎么办',
    '到退休年龄提前多久办',
    '退休手续怎么走',
    '养老金什么时候能领',
  ],
  'right-unemployment-claim': [
    '被辞退能领失业金吗',
    '失业金怎么领',
    '主动辞职能领失业金吗',
    '失业金能领几个月',
  ],
  'right-injury-report': [
    '上班受伤单位不管怎么办',
    '工伤怎么认定',
    '工伤30天',
    '在工地上受伤了怎么办',
  ],
  'right-social-transfer': [
    '换城市工作社保怎么办',
    '社保要不要转到新城市',
    '跨省社保转移',
    '换工作社保断了',
  ],
  'right-medical-reimburse': [
    '异地急诊没刷卡怎么报',
    '医保手工报销',
    '住院发票拿回老家报',
    '急诊费用怎么报销',
  ],
  'right-housing-fund-loan': [
    '公积金贷款怎么申请',
    '买房公积金能贷多少',
    '公积金贷款资格',
    '公积金贷款要先查什么',
  ],
  'right-vocational-subsidy': [
    '考了证能领补贴吗',
    '职业技能补贴怎么申请',
    '证书补贴在哪领',
    '技能提升补贴',
  ],
  'right-occupational-disease': [
    '怀疑职业病怎么检查',
    '粉尘工作肺不舒服',
    '职业病诊断去哪做',
    '噪声聋算职业病吗',
  ],
  'right-unemployment-registration': [
    '失业登记怎么办',
    '领失业金前要登记吗',
    '失业了去哪登记',
    '失业登记和失业金一样吗',
  ],
  'right-maternity-medical': [
    '产检费用怎么报',
    '生孩子医疗费怎么报销',
    '生育医疗费',
    '产检分娩能报多少',
  ],
  'right-flex-registration': [
    '灵活就业登记怎么办',
    '自己交社保要先登记吗',
    '灵活就业参保',
    '没有单位怎么交社保',
  ],
  'right-pension-certification': [
    '养老金资格认证怎么弄',
    '养老金停发了怎么办',
    '社保认证',
    '老人不会用手机怎么认证',
  ],
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

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s，。！？、,.!?：:；;（）()【】\[\]“”"'’‘·]/g, '')
}

function guideSearchText(item: RightsItem): string {
  return normalizeSearchText([
    item.title,
    item.oneLiner,
    item.whereToGo,
    item.caution ?? '',
    ...item.whatToDo,
    ...item.whatToGet,
    RIGHTS_CATEGORY_LABELS[item.category],
  ].join(' '))
}

function guideSearchScore(item: RightsItem, query: string, terms: string[]): number {
  const phrases = (GUIDE_SEARCH_PHRASES[item.id] ?? []).map(normalizeSearchText)
  if (phrases.some((phrase) => phrase === query)) return 100
  if (phrases.some((phrase) => phrase.includes(query))) return 90
  if (normalizeSearchText(item.title).includes(query)) return 80
  if (normalizeSearchText(item.oneLiner).includes(query)) return 60
  const text = guideSearchText(item)
  if (terms.every((term) => text.includes(term))) return 40
  return 0
}

/**
 * 按用户原话搜索可办教程。空查询返回分类列表本身；
 * 命中排序：原话完全命中 > 原话包含 > 标题 > 一句话 > 正文关键词。
 */
export function searchGuides(query: string, category: GuideFilterKey = 'all'): RightsItem[] {
  const normalized = normalizeSearchText(query)
  if (!normalized) return guidesForCategory(category)
  const terms = query.trim().split(/\s+/).map(normalizeSearchText).filter(Boolean)
  return guidesForCategory(category)
    .map((item) => ({ item, score: guideSearchScore(item, normalized, terms) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.item.priority - b.item.priority
      || a.item.title.localeCompare(b.item.title, 'zh-CN'))
    .map((hit) => hit.item)
}
