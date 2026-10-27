/**
 * 城市 → 省级行政区映射。
 *
 * 为什么需要独立一份：地方性法规与办事口径按「省」判定，而不是按「是否在内置规则文件里」。
 * 此前工伤口径用 `GUANGDONG_CITIES = {guangzhou, shenzhen, dongguan}` 判定，
 * 于是佛山/珠海/中山（同属广东、同用《广东省工伤保险条例》）被当成外省，
 * 用户做工伤测算时会得到「按你所在省标准核定」的错误提示。
 *
 * 数据来源：CITY_REGISTRY 自带 province 字段；本文件补齐「文书可选但无规则文件」的城市。
 * 只收录 34 城 + 广东常见务工城市；未收录城市返回 null，调用方应提示用户自行确认省份。
 */

import { CITY_REGISTRY } from './cities'

/** 无独立规则文件、但文书/补偿场景常用的城市（按省归属） */
const EXTRA_CITY_PROVINCE: Record<string, string> = {
  佛山: '广东',
  珠海: '广东',
  中山: '广东',
  惠州: '广东',
  江门: '广东',
  肇庆: '广东',
  汕头: '广东',
  湛江: '广东',
}

const BY_ID = new Map<string, string>()
const BY_LABEL = new Map<string, string>()
for (const c of CITY_REGISTRY) {
  BY_ID.set(c.value, c.province)
  BY_LABEL.set(c.label, c.province)
}
for (const [name, province] of Object.entries(EXTRA_CITY_PROVINCE)) {
  BY_LABEL.set(name, province)
}

/**
 * 查询城市所属省份。接受城市 id（guangzhou）、城市名（广州）或带「市」后缀的文书city（广州市）。
 * 未收录返回 null——调用方必须按「未知」处理，不能默认当成广东。
 */
export function provinceOf(city?: string | null): string | null {
  if (!city) return null
  const key = city.trim()
  if (!key) return null
  return BY_ID.get(key) ?? BY_LABEL.get(key) ?? BY_LABEL.get(key.replace(/市$/, '')) ?? null
}

/** 是否广东省内城市（决定是否引用《广东省工伤保险条例》等地方性法规） */
export function isGuangdongCity(city?: string | null): boolean {
  return provinceOf(city) === '广东'
}
