/**
 * 省级办事入口与法律援助资源。
 *
 * 为什么需要这份表：产品覆盖 34 城 / 31 个省级行政区，但「民生手册」「维权指南」
 * 里的办理步骤与法援资源此前全部是广东口径（粤省事、粤工惠、广州市法援处），
 * 非广东用户照着做会被引到错误的渠道。
 *
 * 数据结构分两层：
 *   - servicePortal：省级政务/人社线上办事入口（用于「怎么自己交社保」按省切换）
 *   - legalAid：省法律援助中心 / 工会热线（用于维权指南按省切换）
 *
 * 链接纪律：本表只放**站点根域名或栏目页**，不指向具体文件——具体办事页会随
 * 省级平台改版失效。凡是未能确认可打开的站点一律不填 url（url 为空时 UI 只显示
 * 名称与全国统一热线，不给死链）。
 *
 * 全国统一兜底：12333（人社）、12348（法律援助）、12351（工会）、12368（法院）。
 */

export interface ProvinceChannel {
  /** 省级行政区短名，与 CITY_REGISTRY.province 一致 */
  province: string
  /** 线上办事入口名称，如「粤省事」 */
  portalName: string
  /** 政务服务平台地址（可为空：未能确认可打开时不给死链） */
  portalUrl?: string
  /** 人社厅/局官网 */
  hrssName: string
  hrssUrl?: string
  /** 该省医保经办入口说明（文字，避免给未核实的深链） */
  medicalChannel: string
}

/** 31 个省级行政区（不含港澳台） */
export const PROVINCE_CHANNELS: ProvinceChannel[] = [
  { province: '北京', portalName: '北京市政务服务网 / 京通小程序', portalUrl: 'https://banshi.beijing.gov.cn/', hrssName: '北京市人力资源和社会保障局', hrssUrl: 'https://rsj.beijing.gov.cn/', medicalChannel: '北京市医保局「京通」小程序 → 灵活就业人员参保登记' },
  { province: '天津', portalName: '天津政务服务网 / 津心办', portalUrl: 'https://zwfw.tj.gov.cn/', hrssName: '天津市人力资源和社会保障局', hrssUrl: 'https://hrss.tj.gov.cn/', medicalChannel: '「津医保」APP → 灵活就业人员参保登记' },
  { province: '河北', portalName: '河北政务服务网 / 冀时办', portalUrl: 'https://rst.hebei.gov.cn/index.html', hrssName: '河北省人力资源和社会保障厅', hrssUrl: 'https://rst.hebei.gov.cn/', medicalChannel: '「河北智慧医保」小程序 → 灵活就业参保登记' },
  { province: '山西', portalName: '山西政务服务网 / 三晋通', hrssName: '山西省人力资源和社会保障厅', hrssUrl: 'https://rst.shanxi.gov.cn/', medicalChannel: '「山西医保」公众号 → 灵活就业人员参保' },
  { province: '内蒙古', portalName: '内蒙古政务服务网 / 蒙速办', hrssName: '内蒙古自治区人力资源和社会保障厅', hrssUrl: 'https://rst.nmg.gov.cn/', medicalChannel: '「内蒙古医保」APP → 灵活就业参保登记' },
  { province: '辽宁', portalName: '辽宁政务服务网 / 辽事通', hrssName: '辽宁省人力资源和社会保障厅', hrssUrl: 'https://rst.ln.gov.cn/', medicalChannel: '「辽事通」APP → 医保 → 灵活就业参保' },
  { province: '吉林', portalName: '吉林政务服务网 / 吉事办', portalUrl: 'https://zwfw.jl.gov.cn/', hrssName: '吉林省人力资源和社会保障厅', hrssUrl: 'https://hrss.jl.gov.cn/', medicalChannel: '「吉事办」APP → 医保服务 → 灵活就业参保' },
  { province: '黑龙江', portalName: '黑龙江政务服务网 / 全省事', portalUrl: 'https://zwfw.hlj.gov.cn/', hrssName: '黑龙江省人力资源和社会保障厅', hrssUrl: 'https://hrss.hlj.gov.cn/', medicalChannel: '「龙江医保」公众号 → 灵活就业参保登记' },
  { province: '上海', portalName: '上海一网通办 / 随申办', portalUrl: 'https://zwdt.sh.gov.cn/', hrssName: '上海市人力资源和社会保障局', hrssUrl: 'https://rsj.sh.gov.cn/', medicalChannel: '「随申办」→ 医保 → 灵活就业人员参保' },
  { province: '江苏', portalName: '江苏政务服务网 / 苏服办', portalUrl: 'https://www.jszwfw.gov.cn/', hrssName: '江苏省人力资源和社会保障厅', hrssUrl: 'https://jshrss.jiangsu.gov.cn/', medicalChannel: '「江苏医保云」APP → 灵活就业参保登记' },
  { province: '浙江', portalName: '浙江政务服务网 / 浙里办', portalUrl: 'https://zwfw.zj.gov.cn/', hrssName: '浙江省人力资源和社会保障厅', hrssUrl: 'https://rlsbt.zj.gov.cn/', medicalChannel: '「浙里办」→ 医保 → 灵活就业参保' },
  { province: '安徽', portalName: '安徽政务服务网 / 皖事通', portalUrl: 'https://www.ahzwfw.gov.cn/', hrssName: '安徽省人力资源和社会保障厅', hrssUrl: 'https://hrss.ah.gov.cn/', medicalChannel: '「皖事通」→ 医保 → 灵活就业参保登记' },
  { province: '福建', portalName: '福建政务服务网 / 闽政通', portalUrl: 'https://zwfw.fujian.gov.cn/', hrssName: '福建省人力资源和社会保障厅', hrssUrl: 'https://rst.fujian.gov.cn/', medicalChannel: '「闽政通」→ 医保 → 灵活就业参保' },
  { province: '江西', portalName: '江西政务服务网 / 赣服通', portalUrl: 'https://www.jxzwfww.gov.cn/', hrssName: '江西省人力资源和社会保障厅', hrssUrl: 'https://rst.jiangxi.gov.cn/', medicalChannel: '「赣服通」→ 医保 → 灵活就业参保登记' },
  { province: '山东', portalName: '山东政务服务网 / 爱山东', portalUrl: 'http://zwfw.sd.gov.cn/', hrssName: '山东省人力资源和社会保障厅', hrssUrl: 'https://hrss.shandong.gov.cn/', medicalChannel: '「爱山东」APP → 医保 → 灵活就业参保' },
  { province: '河南', portalName: '河南政务服务网 / 豫事办', portalUrl: 'https://www.hnzwfw.gov.cn/', hrssName: '河南省人力资源和社会保障厅', hrssUrl: 'https://hrss.henan.gov.cn/', medicalChannel: '「豫事办」→ 医保 → 灵活就业参保登记' },
  { province: '湖北', portalName: '湖北政务服务网 / 鄂汇办', portalUrl: 'https://zwfw.hubei.gov.cn/', hrssName: '湖北省人力资源和社会保障厅', hrssUrl: 'https://rst.hubei.gov.cn/', medicalChannel: '「鄂汇办」→ 医保 → 灵活就业参保' },
  { province: '湖南', portalName: '湖南政务服务网 / 湘易办', portalUrl: 'https://zwfw-new.hunan.gov.cn/', hrssName: '湖南省人力资源和社会保障厅', hrssUrl: 'https://rst.hunan.gov.cn/', medicalChannel: '「湘医保」APP → 灵活就业参保登记' },
  { province: '广东', portalName: '广东政务服务网 / 粤省事 / 粤税通', portalUrl: 'https://www.gdzwfw.gov.cn/portal/index', hrssName: '广东省人力资源和社会保障厅', hrssUrl: 'https://ggfw.hrss.gd.gov.cn/', medicalChannel: '「粤省事」→ 医保 → 灵活就业人员参保登记；缴费走「粤税通」' },
  { province: '广西', portalName: '广西政务服务网 / 桂建通', portalUrl: 'https://zwfw.gxzf.gov.cn/', hrssName: '广西壮族自治区人力资源和社会保障厅', hrssUrl: 'http://rst.gxzf.gov.cn/', medicalChannel: '「广西医保」公众号 → 灵活就业参保登记' },
  { province: '海南', portalName: '海南政务服务网 / 海易办', portalUrl: 'https://www.hainan.gov.cn/', hrssName: '海南省人力资源和社会保障厅', hrssUrl: 'https://hrss.hainan.gov.cn/', medicalChannel: '「海易办」→ 医保 → 灵活就业参保' },
  { province: '重庆', portalName: '重庆政务服务网 / 渝快办', portalUrl: 'https://zwfw.cq.gov.cn/', hrssName: '重庆市人力资源和社会保障局', hrssUrl: 'https://rlsbj.cq.gov.cn/', medicalChannel: '「渝快办」→ 医保 → 灵活就业参保登记' },
  { province: '四川', portalName: '四川政务服务网 / 天府通办', portalUrl: 'https://www.sczwfw.gov.cn/', hrssName: '四川省人力资源和社会保障厅', hrssUrl: 'https://rst.sc.gov.cn/', medicalChannel: '「四川医保」APP → 灵活就业参保登记' },
  { province: '贵州', portalName: '贵州政务服务网 / 云上贵州', hrssName: '贵州省人力资源和社会保障厅', hrssUrl: 'https://rst.guizhou.gov.cn/', medicalChannel: '「贵州医保」公众号 → 灵活就业参保登记（省级平台偶发维护，可拨 12333）' },
  { province: '云南', portalName: '云南政务服务网 / 一部手机办事通', portalUrl: 'https://zwfw.yn.gov.cn/', hrssName: '云南省人力资源和社会保障厅', hrssUrl: 'https://hrss.yn.gov.cn/', medicalChannel: '「云南医保」小程序 → 灵活就业参保登记' },
  { province: '西藏', portalName: '西藏政务服务网 / 西藏政务', hrssName: '西藏自治区人力资源和社会保障厅', hrssUrl: 'https://hrss.xizang.gov.cn/', medicalChannel: '「西藏医保」公众号 → 灵活就业参保（线上能力有限，建议拨 12333 确认）' },
  { province: '陕西', portalName: '陕西政务服务网 / 秦务员', portalUrl: 'https://zwfw.shaanxi.gov.cn/', hrssName: '陕西省人力资源和社会保障厅', hrssUrl: 'https://rst.shaanxi.gov.cn/', medicalChannel: '「秦务员」APP → 医保 → 灵活就业参保' },
  { province: '甘肃', portalName: '甘肃政务服务网 / 甘快办', portalUrl: 'https://zwfw.gansu.gov.cn/', hrssName: '甘肃省人力资源和社会保障厅', hrssUrl: 'https://rst.gansu.gov.cn/', medicalChannel: '「甘快办」→ 医保 → 灵活就业参保登记' },
  { province: '青海', portalName: '青海政务服务网 / 青海人社', portalUrl: 'http://zwfw.qinghai.gov.cn/', hrssName: '青海省人力资源和社会保障厅', hrssUrl: 'https://rst.qinghai.gov.cn/', medicalChannel: '「青海医保」公众号 → 灵活就业参保（线上能力有限，建议拨 12333）' },
  { province: '宁夏', portalName: '宁夏政务服务网 / 我的宁夏', hrssName: '宁夏回族自治区人力资源和社会保障厅', hrssUrl: 'https://hrss.nx.gov.cn/', medicalChannel: '「我的宁夏」APP → 医保 → 灵活就业参保登记' },
  { province: '新疆', portalName: '新疆政务服务网 / 新疆政务服务', portalUrl: 'https://zwfw.xinjiang.gov.cn/', hrssName: '新疆维吾尔自治区人力资源和社会保障厅', hrssUrl: 'https://rst.xinjiang.gov.cn/', medicalChannel: '「新疆医保」公众号 → 灵活就业参保登记' },
]

const BY_PROVINCE = new Map(PROVINCE_CHANNELS.map(c => [c.province, c]))

/** 查省级办事渠道；未收录返回 null（调用方应回退到全国统一口径） */
export function channelOf(province: string | null | undefined): ProvinceChannel | null {
  if (!province) return null
  return BY_PROVINCE.get(province) ?? null
}

/** 省级法律援助中心说明：全国 12348 统一热线是主入口，各省中心名称仅作指路 */
export const PROVINCIAL_LEGAL_AID: Record<string, string> = {
  北京: '北京市法律援助中心（12348 转）',
  天津: '天津市法律援助中心（12348 转）',
  河北: '河北省法律援助中心（12348 转）',
  山西: '山西省法律援助中心（12348 转）',
  内蒙古: '内蒙古自治区法律援助中心（12348 转）',
  辽宁: '辽宁省法律援助中心（12348 转）',
  吉林: '吉林省法律援助中心（12348 转）',
  黑龙江: '黑龙江省法律援助中心（12348 转）',
  上海: '上海市法律援助中心（12348 转）',
  江苏: '江苏省法律援助中心（12348 转）',
  浙江: '浙江省法律援助中心（12348 转）',
  安徽: '安徽省法律援助中心（12348 转）',
  福建: '福建省法律援助中心（12348 转）',
  江西: '江西省法律援助中心（12348 转）',
  山东: '山东省法律援助中心（12348 转）',
  河南: '河南省法律援助中心（12348 转）',
  湖北: '湖北省法律援助中心（12348 转）',
  湖南: '湖南省法律援助中心（12348 转）',
  广东: '广东省法律援助局 / 广州市法律援助处（12348 转）',
  广西: '广西壮族自治区法律援助中心（12348 转）',
  海南: '海南省法律援助中心（12348 转）',
  重庆: '重庆市法律援助中心（12348 转）',
  四川: '四川省法律援助中心（12348 转）',
  贵州: '贵州省法律援助中心（12348 转）',
  云南: '云南省法律援助中心（12348 转）',
  西藏: '西藏自治区法律援助中心（12348 转）',
  陕西: '陕西省法律援助中心（12348 转）',
  甘肃: '甘肃省法律援助中心（12348 转）',
  青海: '青海省法律援助中心（12348 转）',
  宁夏: '宁夏回族自治区法律援助中心（12348 转）',
  新疆: '新疆维吾尔自治区法律援助中心（12348 转）',
}

export const NATIONAL_HOTLINES = [
  { number: '12348', label: '法律援助' },
  { number: '12333', label: '人社投诉' },
  { number: '12351', label: '工会维权' },
  { number: '12368', label: '法院热线' },
  { number: '12315', label: '市场监管' },
] as const
