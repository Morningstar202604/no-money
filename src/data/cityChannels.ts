/**
 * 10 城深核：社保、医保、公积金、就业服务的本地官方入口。
 *
 * 为什么单独一层：省级入口只能告诉用户「去省里办」，但多数人实际要落在
 * 市级人社/医保/公积金中心。这里只放**官网首页或栏目页**，不放具体办件深链：
 * 具体入口会随网站改版失效，而首页不会。
 *
 * 内容纪律：
 * - 不写城市级金额、缴费基数、报销比例；这些必须看当地最新文件。
 * - 只收录 2026-11-19 实际核到官方域名的 10 城；其余城市回退省级入口。
 * - 同一城市人社与就业服务可能是同一官网，但必须明确告诉用户站内去哪里找。
 * - 成都等站点对机房 IP 可能返回 412，手机浏览器可正常访问；不因此改成非官方链接。
 */

export type CityServiceKey = 'social' | 'medical' | 'housing' | 'employment'

export const CITY_SERVICE_LABELS: Record<CityServiceKey, string> = {
  social: '社会保险',
  medical: '医疗保险',
  housing: '住房公积金',
  employment: '就业服务',
}

export const CITY_SERVICE_ORDER: CityServiceKey[] = ['social', 'medical', 'housing', 'employment']

export interface CityServiceLink {
  /** 官方机构名 */
  name: string
  /** 官网首页/栏目页；不放具体文件 */
  url: string
  /** 站内怎么找，减少用户在官网里迷路 */
  note?: string
}

export interface CityChannel {
  /** 城市 id，与 CITY_REGISTRY.value 一致 */
  city: string
  /** 城市显示名 */
  label: string
  /** 省级行政区短名 */
  province: string
  /** 四类本地官方入口 */
  services: Record<CityServiceKey, CityServiceLink>
  /** 本地/全国统一热线，多个用「/」分隔 */
  hotlines: string
  /** 核验日期（YYYY-MM-DD） */
  lastVerified: string
}

/**
 * 10 城：北京 / 上海 / 广州 / 深圳 / 成都 / 重庆 / 武汉 / 西安 / 郑州 / 杭州。
 * 这是 ROADMAP 3.6.0 的深核范围；不是全国所有城市都已深核。
 */
export const CITY_CHANNELS: CityChannel[] = [
  {
    city: 'beijing',
    label: '北京',
    province: '北京',
    services: {
      social: { name: '北京市人力资源和社会保障局', url: 'https://rsj.beijing.gov.cn/', note: '站内「个人服务 / 社会保险」' },
      medical: { name: '北京市医疗保障局', url: 'https://ybj.beijing.gov.cn/', note: '站内「医保服务 / 个人办事」' },
      housing: { name: '北京住房公积金管理中心', url: 'https://gjj.beijing.gov.cn/', note: '个人网上业务平台 / 公积金 APP' },
      employment: { name: '北京市人社局就业创业服务', url: 'https://rsj.beijing.gov.cn/', note: '站内「就业创业」栏目' },
    },
    hotlines: '12333 / 12393 / 12329',
    lastVerified: '2026-11-19',
  },
  {
    city: 'shanghai',
    label: '上海',
    province: '上海',
    services: {
      social: { name: '上海市人力资源和社会保障局', url: 'https://rsj.sh.gov.cn/', note: '随申办 → 社保 / 灵活就业参保' },
      medical: { name: '上海市医疗保障局', url: 'https://ybj.sh.gov.cn/', note: '随申办 → 医保 / 医保服务' },
      housing: { name: '上海住房公积金网', url: 'https://www.shzfgjj.cn/', note: '个人网上业务 / 公积金查询' },
      employment: { name: '上海市人社局「乐业上海」', url: 'https://rsj.sh.gov.cn/', note: '站内「乐业上海」栏目' },
    },
    hotlines: '12333 / 12393 / 12329',
    lastVerified: '2026-11-19',
  },
  {
    city: 'guangzhou',
    label: '广州',
    province: '广东',
    services: {
      social: { name: '广州市人力资源和社会保障局', url: 'https://rsj.gz.gov.cn/', note: '站内「灵活就业人员社会保险」' },
      medical: { name: '广州市医疗保障局', url: 'https://www.gz.gov.cn/gzsylbzj/', note: '广州市政府门户 → 市医保局专页' },
      housing: { name: '广州住房公积金管理中心', url: 'https://gjj.gz.gov.cn/', note: '网上办事 / 提取审批 / 贷款' },
      employment: { name: '广州市人社局就业服务', url: 'https://rsj.gz.gov.cn/', note: '站内「就业服务 / 公共就业」' },
    },
    hotlines: '12345 / 12333 / 12393 / 12329',
    lastVerified: '2026-11-19',
  },
  {
    city: 'shenzhen',
    label: '深圳',
    province: '广东',
    services: {
      social: { name: '深圳市人力资源和社会保障局', url: 'https://hrss.sz.gov.cn/', note: '站内「社保服务 / 个人服务」' },
      medical: { name: '深圳市医疗保障局', url: 'https://hsa.sz.gov.cn/', note: '站内「医保服务 / 个人办事」' },
      housing: { name: '深圳市住房公积金管理中心', url: 'https://zjj.sz.gov.cn/ztfw/zfgjj/', note: '深圳市住建局 → 住房公积金服务' },
      employment: { name: '深圳市人社局就业服务', url: 'https://hrss.sz.gov.cn/', note: '站内「就业创业 / 公共就业服务」' },
    },
    hotlines: '12333 / 12345 / 12329',
    lastVerified: '2026-11-19',
  },
  {
    city: 'chengdu',
    label: '成都',
    province: '四川',
    services: {
      social: { name: '成都市人力资源和社会保障局', url: 'https://cdhrss.chengdu.gov.cn/', note: '「蓉e人社」网上服务大厅' },
      medical: { name: '成都市医疗保障局', url: 'https://cdyb.chengdu.gov.cn/ylbzj/', note: '站内「政务服务 / 办理事项资料」' },
      housing: { name: '成都住房公积金管理中心', url: 'https://cdzfgjj.chengdu.gov.cn/', note: '官网 / 成都住房公积金 APP / 小程序' },
      employment: { name: '成都市人社局就业网上经办', url: 'https://cdhrss.chengdu.gov.cn/', note: '站内「个人就业网上经办」' },
    },
    hotlines: '12333 / 12393 / 12329',
    lastVerified: '2026-11-19',
  },
  {
    city: 'chongqing',
    label: '重庆',
    province: '重庆',
    services: {
      social: { name: '重庆市人力资源和社会保障局', url: 'https://rlsbj.cq.gov.cn/', note: '站内「办理社保 / 个人服务」' },
      medical: { name: '重庆市医疗保障局', url: 'https://ylbzj.cq.gov.cn/', note: '站内「医保服务 / 个人办事」' },
      housing: { name: '重庆市住房公积金管理中心', url: 'https://www.cqgjj.cn/', note: '网上服务大厅 / 公积金查询' },
      employment: { name: '重庆市人社局就业服务', url: 'https://rlsbj.cq.gov.cn/', note: '站内「就业创业 / 就业服务」' },
    },
    hotlines: '023-12333 / 12393 / 12329',
    lastVerified: '2026-11-19',
  },
  {
    city: 'wuhan',
    label: '武汉',
    province: '湖北',
    services: {
      social: { name: '武汉市人力资源和社会保障局', url: 'https://rsj.wuhan.gov.cn/', note: '站内「办事服务 / 社保」' },
      medical: { name: '武汉市医疗保障局', url: 'https://ybj.wuhan.gov.cn/', note: '站内「医保服务 / 个人办事」' },
      housing: { name: '武汉住房公积金管理中心', url: 'https://gjj.wuhan.gov.cn/', note: '站内「办事服务 / 提取 / 贷款」' },
      employment: { name: '武汉市人社局就业服务', url: 'https://rsj.wuhan.gov.cn/', note: '站内「就业创业 / 技能提升补贴」' },
    },
    hotlines: '027-12333 / 12393 / 12329',
    lastVerified: '2026-11-19',
  },
  {
    city: 'xian',
    label: '西安',
    province: '陕西',
    services: {
      social: { name: '西安市人力资源和社会保障局', url: 'http://xahrss.xa.gov.cn/', note: '站内「社会保险 / 个人服务」' },
      medical: { name: '西安市医疗保障局', url: 'http://ybj.xa.gov.cn/', note: '站内「医保服务 / 办事指南」' },
      housing: { name: '西安住房公积金管理中心', url: 'http://zfgjj.xa.gov.cn/', note: '公积金查询 / 办事指南' },
      employment: { name: '西安市人社局就业服务', url: 'http://xahrss.xa.gov.cn/', note: '站内「就业创业 / 公共就业」' },
    },
    hotlines: '029-12333 / 12393 / 12329',
    lastVerified: '2026-11-19',
  },
  {
    city: 'zhengzhou',
    label: '郑州',
    province: '河南',
    services: {
      social: { name: '郑州市人力资源和社会保障局', url: 'https://zzrs.zhengzhou.gov.cn/', note: '站内「社保服务 / 个人办事」' },
      medical: { name: '郑州市医疗保障局', url: 'https://chs.zhengzhou.gov.cn/', note: '站内「医保服务 / 办事指南」' },
      housing: { name: '郑州住房公积金管理中心', url: 'https://zzgjj.zhengzhou.gov.cn/', note: '个人网厅 / 公积金查询' },
      employment: { name: '郑州市人社局就业服务', url: 'https://zzrs.zhengzhou.gov.cn/', note: '站内「就业创业 / 公共就业」' },
    },
    hotlines: '0371-12333 / 12393 / 12329',
    lastVerified: '2026-11-19',
  },
  {
    city: 'hangzhou',
    label: '杭州',
    province: '浙江',
    services: {
      social: { name: '杭州市人力资源和社会保障局', url: 'https://hrss.hangzhou.gov.cn/', note: '站内「网上办事 / 社保」' },
      medical: { name: '杭州市医疗保障局', url: 'https://www.hangzhou.gov.cn/col/col1229460765/index.html', note: '杭州市政府门户 → 市医保局专页' },
      housing: { name: '杭州住房公积金管理中心', url: 'https://gjj.hangzhou.gov.cn/', note: '网上办事 / 公积金查询' },
      employment: { name: '杭州市人社局就业创业服务', url: 'https://hrss.hangzhou.gov.cn/', note: '站内「就业创业 / 招聘公告」' },
    },
    hotlines: '0571-12333 / 12393 / 12329',
    lastVerified: '2026-11-19',
  },
]

const BY_CITY = new Map<string, CityChannel>()
for (const channel of CITY_CHANNELS) {
  BY_CITY.set(channel.city, channel)
  BY_CITY.set(channel.label, channel)
}

/** 查 10 城深核入口；未收录返回 null，调用方回退省级入口。 */
export function cityChannelOf(city?: string | null): CityChannel | null {
  if (!city) return null
  const key = city.trim()
  if (!key) return null
  return BY_CITY.get(key) ?? BY_CITY.get(key.replace(/市$/, '')) ?? null
}

/** 按固定顺序返回四类入口，方便 UI 遍历。 */
export function cityServiceEntries(channel: CityChannel): Array<{ key: CityServiceKey; label: string; link: CityServiceLink }> {
  return CITY_SERVICE_ORDER.map((key) => ({
    key,
    label: CITY_SERVICE_LABELS[key],
    link: channel.services[key],
  }))
}
