/**
 * 城市注册表：地图选点与下拉选项的唯一来源。
 *
 * 每条包含：规则文件名（value）、显示名、所属省级区划（必须与 public/maps/china.json
 * 的 feature 名一致，短名如「广东」「浙江」）、近似经纬度（用于地图打点）。
 * 新增城市 = 在此登记 + 提供 public/rules/<value>.json，两者缺一会在
 * tests/guide.spec.ts / tests/knowledge.spec.ts 的同步校验里暴露。
 */

export interface CityDef {
  /** 规则文件名与 id，如 guangzhou */
  value: string
  /** 显示名，如 广州 */
  label: string
  /** 省级区划短名（匹配 china.json），如 广东 / 北京 */
  province: string
  /** 近似城市中心坐标 [经度, 纬度] */
  lng: number
  lat: number
}

export const CITY_REGISTRY: CityDef[] = [
  // 华南
  { value: 'guangzhou', label: '广州', province: '广东', lng: 113.26, lat: 23.13 },
  { value: 'shenzhen', label: '深圳', province: '广东', lng: 114.06, lat: 22.55 },
  { value: 'dongguan', label: '东莞', province: '广东', lng: 113.75, lat: 23.02 },
  // 华北
  { value: 'beijing', label: '北京', province: '北京', lng: 116.41, lat: 39.9 },
  { value: 'tianjin', label: '天津', province: '天津', lng: 117.2, lat: 39.13 },
  // 华东
  { value: 'shanghai', label: '上海', province: '上海', lng: 121.47, lat: 31.23 },
  { value: 'hangzhou', label: '杭州', province: '浙江', lng: 120.15, lat: 30.28 },
  { value: 'nanjing', label: '南京', province: '江苏', lng: 118.8, lat: 32.06 },
  { value: 'suzhou', label: '苏州', province: '江苏', lng: 120.59, lat: 31.3 },
  // 华中
  { value: 'wuhan', label: '武汉', province: '湖北', lng: 114.31, lat: 30.59 },
  { value: 'changsha', label: '长沙', province: '湖南', lng: 112.94, lat: 28.23 },
  { value: 'zhengzhou', label: '郑州', province: '河南', lng: 113.63, lat: 34.75 },
  // 西南 / 西北
  { value: 'chengdu', label: '成都', province: '四川', lng: 104.07, lat: 30.57 },
  { value: 'chongqing', label: '重庆', province: '重庆', lng: 106.55, lat: 29.56 },
  { value: 'xian', label: '西安', province: '陕西', lng: 108.95, lat: 34.27 },

  // ===== 以下省市为「全国覆盖」新增：规则文件已提供，但省级社保/最低工资
  // 数据尚未回溯到官方原文（confidence = unverified），界面上会明确标注。
  // 用户可用「我的计价」与社保基数自定义填入本省官方公布值。 =====
  { value: 'shijiazhuang', label: '石家庄', province: '河北', lng: 114.51, lat: 38.04 },
  { value: 'taiyuan', label: '太原', province: '山西', lng: 112.55, lat: 37.87 },
  { value: 'huhehaote', label: '呼和浩特', province: '内蒙古', lng: 111.75, lat: 40.84 },
  { value: 'shenyang', label: '沈阳', province: '辽宁', lng: 123.43, lat: 41.81 },
  { value: 'changchun', label: '长春', province: '吉林', lng: 125.32, lat: 43.82 },
  { value: 'haerbin', label: '哈尔滨', province: '黑龙江', lng: 126.63, lat: 45.75 },
  { value: 'hefei', label: '合肥', province: '安徽', lng: 117.28, lat: 31.86 },
  { value: 'fuzhou', label: '福州', province: '福建', lng: 119.30, lat: 26.08 },
  { value: 'nanchang', label: '南昌', province: '江西', lng: 115.89, lat: 28.68 },
  { value: 'jinan', label: '济南', province: '山东', lng: 117.00, lat: 36.65 },
  { value: 'nanning', label: '南宁', province: '广西', lng: 108.37, lat: 22.82 },
  { value: 'haikou', label: '海口', province: '海南', lng: 110.20, lat: 20.04 },
  { value: 'guiyang', label: '贵阳', province: '贵州', lng: 106.63, lat: 26.65 },
  { value: 'kunming', label: '昆明', province: '云南', lng: 102.83, lat: 24.88 },
  { value: 'lasa', label: '拉萨', province: '西藏', lng: 91.11, lat: 29.65 },
  { value: 'lanzhou', label: '兰州', province: '甘肃', lng: 103.83, lat: 36.06 },
  { value: 'xining', label: '西宁', province: '青海', lng: 101.78, lat: 36.62 },
  { value: 'yinchuan', label: '银川', province: '宁夏', lng: 106.23, lat: 38.49 },
  { value: 'wulumuqi', label: '乌鲁木齐', province: '新疆', lng: 87.62, lat: 43.83 },
]

/** 下拉选择器选项 */
export const CITY_OPTIONS = CITY_REGISTRY.map(({ value, label }) => ({ value, label }))

/** 省份 → 该省已收录城市（地图着色的输入） */
export function provinceCoverage(defs: CityDef[] = CITY_REGISTRY): Map<string, CityDef[]> {
  const map = new Map<string, CityDef[]>()
  for (const d of defs) {
    const list = map.get(d.province) ?? []
    list.push(d)
    map.set(d.province, list)
  }
  return map
}
