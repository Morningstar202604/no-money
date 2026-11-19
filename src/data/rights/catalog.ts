/**
 * 权益导航内容层（P0）
 *
 * 这一层只放“用户要办的事”，不放计算公式。每条必须能回答：
 *   我该做什么 / 我能拿什么 / 去哪办 / 什么时候办 / 凭什么。
 *
 * 内容纪律：
 * - 现有 23 条民生手册（审核过的 steps + 官方链接）直接迁移，不重写、不丢链接。
 * - 新增条目只写政策框架，不写具体金额；金额/比例一律“以当地标准为准”。
 * - officialUrl 必须是可打开的官方站点或原文；没有核到就不填，不允许编。
 * - lastVerified 必须真实；到期未复核的条目由 UI 标“待复核”。
 */
import { GUIDE_ITEMS, type GuideGroupKey, type GuideItem } from '../../utils/livingGuide'
import { PROVINCE_CHANNELS, type ProvinceChannel } from '../provinceChannels'
import { provinceOf } from '../provinces'

export type RightsIntent = 'do' | 'get' | 'both'
export type RightsCategory =
  | 'onboard'
  | 'social'
  | 'medical'
  | 'housing'
  | 'injury'
  | 'unemployment'
  | 'birth'
  | 'heat'
  | 'subsidy'
  | 'tax'
  | 'retire'
  | 'trouble'

export type RightsAudience = 'all' | 'new' | 'flex'
export type RightsConfidence = 'official' | 'derived' | 'platform' | 'unverified'
export type RightsLevel = 'L1' | 'L2'

export interface RightsItem {
  id: string
  category: RightsCategory
  intent: RightsIntent
  audience: RightsAudience[]
  title: string
  oneLiner: string
  whatToDo: string[]
  whatToGet: string[]
  whereToGo: string
  officialUrl?: string
  deadline?: string
  materials?: string[]
  caution?: string
  confidence: RightsConfidence
  /** L1=知道有这件事；L2=有材料、编号步骤、坑与官方入口，能直接照着办 */
  level: RightsLevel
  lastVerified: string
  sourceTitle?: string
  /** 若来自民生手册，保留原 id，便于旧页面继续引用 */
  guideId?: string
  /** 越小越靠前；用于向导与列表的稳定排序 */
  priority: number
}

export type RightsIdentity = 'employee' | 'flex' | 'new-grad' | 'unsure'
export type RightsSituation =
  | 'first-job'
  | 'social'
  | 'benefits'
  | 'medical'
  | 'housing'
  | 'birth'
  | 'injury'
  | 'unemployment'
  | 'retire'
  | 'trouble'
  | 'all'

export const IDENTITY_OPTIONS: { value: RightsIdentity; label: string; hint: string }[] = [
  { value: 'employee', label: '企业职工', hint: '有劳动合同、单位缴社保' },
  { value: 'flex', label: '灵活就业', hint: '骑手、网约车、零工、个体' },
  { value: 'new-grad', label: '刚毕业/第一次工作', hint: '还在试用期或刚入职' },
  { value: 'unsure', label: '不确定', hint: '先按“都要知道”给你列' },
]

export const SITUATION_OPTIONS: { value: RightsSituation; label: string; hint: string }[] = [
  { value: 'first-job', label: '刚入职，先办什么', hint: '合同、试用期、社保、工资条' },
  { value: 'benefits', label: '有哪些钱可以领', hint: '补贴、津贴、公积金、生育、失业' },
  { value: 'social', label: '社保医保怎么办', hint: '参保、断缴、转移、异地就医' },
  { value: 'medical', label: '医保断了/要报销', hint: '断缴、等待期、异地备案' },
  { value: 'housing', label: '公积金/租房', hint: '开户、租房提取、装修物业费' },
  { value: 'birth', label: '生育津贴', hint: '连续缴费、材料、申领' },
  { value: 'injury', label: '工伤/职业伤害', hint: '30 日认定、证据、待遇' },
  { value: 'unemployment', label: '失业金', hint: '三个条件、期限、申领' },
  { value: 'retire', label: '退休办理', hint: '年龄、缴费年限、提前准备' },
  { value: 'trouble', label: '被欠薪/被辞退', hint: '取证、投诉、仲裁、文书' },
  { value: 'all', label: '先给我一份完整清单', hint: '按高频优先列 7 条' },
]

const GUIDE_CATEGORY: Record<GuideGroupKey, RightsCategory> = {
  rookie: 'onboard',
  enroll: 'social',
  medical: 'medical',
  pension: 'retire',
  taxsave: 'tax',
}

/**
 * 民生手册里可直接照着办的 10 条：补材料/时限，不改原文步骤。
 * 只升级“有明确动作、材料、官方入口”的条目；概念型条目继续留在 L1。
 */
const GUIDE_L2_DETAILS: Record<string, { materials: string[]; deadline?: string; steps?: string[] }> = {
  'rookie-first-day': {
    materials: ['身份证', '健康证（食品配送等按岗位要求）', '银行卡', '电动车/手机等工具'],
    deadline: '入职第一天前备齐；当天先查企业与计价/扣款规则',
  },
  'rookie-deposit': {
    materials: ['合同/租车协议', '盖章收据或转账记录', '对方公司全称与联系人'],
    deadline: '交任何钱之前完成核验',
  },
  'rookie-contract': {
    materials: ['身份证', '劳动合同/合作协议原件', '附件与签名页照片'],
    deadline: '签字前逐页确认',
  },
  'rookie-penalty': {
    materials: ['扣款记录截图', '订单详情与时间/位置', 'APP 工单与书面回复', '工资条/流水'],
    deadline: '发现扣款立即取证，申诉越早越好',
  },
  'how-to-pay': {
    materials: ['身份证', '居住证（如当地要求）', '银行卡', '社保卡'],
    deadline: '按月缴费；基数调整按当地年度申报期',
  },
  'annual-leave': {
    materials: ['劳动合同', '考勤/排班记录', '工资条', '未休年假书面确认（如有）'],
    deadline: '离职前或年度结束前主张；仲裁时效通常 1 年',
  },
  'pension-exit': {
    materials: ['身份证', '社保卡', '银行卡', '出国定居/达到退休年龄等情形材料（按当地）'],
    deadline: '达到退休年龄或符合法定情形时；退休前一般不能提前支取',
  },
  'personal-pension': {
    materials: ['身份证', '个人养老金账户/资金账户信息', '银行流水或缴费凭证'],
    deadline: '每年 12 月 31 日前缴费；次年 3–6 月汇算扣除',
  },
  'tax-health-insurance': {
    materials: ['税优健康险保单', '税优识别码/凭证', '身份证'],
    deadline: '购买后留存凭证；次年 3–6 月汇算申报',
  },
  'special-deductions': {
    steps: [
      '打开「个人所得税」APP → 专项附加扣除填报',
      '按实际情况选择子女教育、住房租金、赡养老人、继续教育等项目',
      '留存证明并提交；次年 3–6 月汇算时多退少补',
    ],
    materials: ['子女出生医学证明/学籍信息', '住房租赁合同/贷款合同', '赡养老人关系证明', '继续教育/大病医疗票据'],
    deadline: '每年 12 月确认次年扣除；次年 3–6 月汇算',
  },
}

const GUIDE_INTENT: Record<string, RightsIntent> = {
  'annual-leave': 'get',
  'what-can-join': 'both',
  'medical-choose': 'both',
  'pension-formula': 'both',
  'personal-pension': 'get',
  'tax-health-insurance': 'get',
  'special-deductions': 'get',
}

function fromGuide(item: GuideItem, index: number): RightsItem {
  const firstLink = item.links[0]
  const l2 = GUIDE_L2_DETAILS[item.id]
  return {
    id: `guide-${item.id}`,
    guideId: item.id,
    category: GUIDE_CATEGORY[item.group],
    intent: GUIDE_INTENT[item.id] ?? 'do',
    audience: item.group === 'rookie' ? ['all', 'new'] : ['all'],
    title: item.question,
    oneLiner: item.oneLiner,
    whatToDo: (l2?.steps ?? item.steps ?? item.keyPoints ?? [item.oneLiner]).slice(0, 4),
    whatToGet: item.numbers?.map((n) => `${n.label}：${n.value}`) ?? [],
    whereToGo: firstLink?.title ?? '当地人社 / 医保 / 公积金经办机构',
    officialUrl: firstLink?.url,
    caution: item.caution,
    materials: l2?.materials,
    deadline: l2?.deadline,
    confidence: 'official',
    level: l2 ? 'L2' : 'L1',
    lastVerified: '2026-10',
    sourceTitle: firstLink?.title,
    priority: index,
  }
}

const GUIDE_RIGHTS: RightsItem[] = GUIDE_ITEMS.map(fromGuide)

/** 新增条目：只写“怎么查、去哪办、带什么”，不写具体金额。 */
const NEW_RIGHTS: RightsItem[] = [
  {
    id: 'right-housing-fund',
    category: 'housing',
    intent: 'get',
    audience: ['all', 'flex'],
    title: '公积金：开户、租房提取、装修/物业费',
    oneLiner: '有单位的由单位缴；灵活就业可自愿缴存。2026-09-20 新规明确装修自住住房、物业费可以提取；租房提取按当地限额。',
    whatToDo: [
      '先查账户是否已开立：当地公积金 APP/小程序、支付宝/微信城市服务，或打 12329。',
      '租房提取：准备租赁合同/发票、本人身份证与银行卡，按当地限额申请。',
      '装修/物业费提取：2026-09-20 新规已明确可提取，按当地材料清单提交。',
    ],
    whatToGet: ['单位缴存部分归个人账户', '租房提取按当地限额', '装修自住住房、物业费可提取（2026-09-20 起）'],
    whereToGo: '当地住房公积金管理中心 / 公积金 APP / 12329',
    officialUrl: 'https://www.gov.cn/gongbao/2026/issue_12946/202608/content_7079363.html',
    materials: ['身份证', '银行卡', '租赁合同/发票（租房提取）', '装修/物业费票据（按当地）'],
    deadline: '租房/装修提取按当地时限；购房贷款先做资格预审',
    caution: '公积金提取没有“全国统一代办”，不要交给收费中介；先打 12329 或走官方 APP。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '住房公积金管理条例（2026 年修订）',
    priority: 100,
  },
  {
    id: 'right-birth-allowance',
    category: 'birth',
    intent: 'get',
    audience: ['all'],
    title: '生育津贴：谁能领、怎么领',
    oneLiner: '参保女职工生育后可申领生育津贴，金额按单位上年度职工月平均工资和产假天数计；连续缴费月数各地不同，以当地规定为准。',
    whatToDo: [
      '先确认生育保险连续缴费月数：打 12333 或当地医保 APP 查。',
      '生育后由单位/个人向医保经办机构提交材料（各地时限不同，尽早办）。',
      '准备出生医学证明、身份证、银行卡、生育服务证（按当地要求）。',
    ],
    whatToGet: ['生育医疗费用报销', '生育津贴（产假工资替代）'],
    whereToGo: '当地医保经办机构 / 医保 APP / 12333',
    officialUrl: 'https://www.gov.cn/zhengce/202505/content_7022301.htm',
    deadline: '生育后按当地时限申请，通常越早越好',
    materials: ['出生医学证明', '身份证', '银行卡', '生育服务证（按当地）'],
    caution: '各地对连续缴费月数、灵活就业是否享受生育津贴规定不同；不要用外省标准套本地。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '国家医保局关于生育保险待遇的政策文件',
    priority: 101,
  },
  {
    id: 'right-heat-allowance',
    category: 'heat',
    intent: 'get',
    audience: ['all'],
    title: '高温津贴：35℃室外、33℃室内',
    oneLiner: '日最高气温 ≥35℃露天作业，或室内工作场所 ≥33℃且无法降温，用人单位应发放高温津贴；标准由省级制定，不得用饮料/实物冲抵。',
    whatToDo: [
      '记录高温作业天数、当天温度与工作地点（截图天气预警）。',
      '查本省高温津贴标准与发放月份：省人社厅官网或 12333。',
      '核对工资条是否单列“高温津贴”，而不是被并入绩效。',
    ],
    whatToGet: ['按月/按天高温津贴（各省标准不同）'],
    whereToGo: '省人社厅 / 12333 / 当地劳动监察',
    officialUrl: 'https://www.mohrss.gov.cn/xxgk2020/fdzdgknr/ldgx_4234/ldyg/202507/t20250718_549757.html',
    materials: ['考勤/排班记录', '工作场所温度记录或天气预警截图', '工资条', '高温作业岗位证明（按当地）'],
    deadline: '按本省规定发放月份，通常在 6–9 月',
    caution: '高温津贴是工资组成部分，不是福利；用绿豆汤、饮料代替发放不合规。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '高温天气劳动保护与高温津贴政策',
    priority: 102,
  },
  {
    id: 'right-flex-subsidy',
    category: 'subsidy',
    intent: 'get',
    audience: ['all', 'flex'],
    title: '灵活就业社保补贴：最多补 2/3，最长 3 年',
    oneLiner: '就业困难人员、离校未就业高校毕业生等以灵活就业身份参保，可申请社保补贴，原则上不超过实际缴费的 2/3，最长 3 年；距退休不足 5 年可延至退休。',
    whatToDo: [
      '先确认自己是否属于当地“就业困难人员”或“离校未就业高校毕业生”。',
      '以灵活就业身份正常缴纳社保（先缴后补，各地口径不同）。',
      '到街道/社区人社服务窗口或当地人社 APP 提交补贴申请。',
    ],
    whatToGet: ['社保补贴（按当地标准，不超过实际缴费 2/3）', '最长 3 年；距退休不足 5 年可延至退休'],
    whereToGo: '街道/社区人社服务窗口 / 当地人社 APP / 12333',
    officialUrl: 'https://www.gov.cn/zhengce/zhengceku/202401/content_6926462.htm',
    deadline: '按当地集中申报期，错过要等下一年',
    materials: ['身份证', '灵活就业登记证明', '社保缴费凭证', '银行卡'],
    caution: '补贴是“先缴后补”，不是免缴；各地对年龄、收入、毕业年限有门槛，先问 12333。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '就业补助资金管理办法',
    priority: 103,
  },
  {
    id: 'right-medical-cross-city',
    category: 'medical',
    intent: 'do',
    audience: ['all'],
    title: '异地就医：先备案，再去看病',
    oneLiner: '跨省/跨市就医前先在国家医保服务平台 APP 或当地医保 APP 办理异地就医备案；急诊可先就医后补备案，报销比例按参保地政策。',
    whatToDo: [
      '打开“国家医保服务平台”APP → 异地就医备案。',
      '选择就医地、备案类型（长期居住/临时外出/转诊）。',
      '就诊时出示医保电子凭证；保存发票、费用清单、出院小结。',
    ],
    whatToGet: ['住院/门诊费用按参保地政策报销', '直接结算或回参保地手工报销'],
    whereToGo: '国家医保服务平台 APP / 参保地医保局 / 12393',
    officialUrl: 'https://www.nhsa.gov.cn/',
    materials: ['医保电子凭证/社保卡', '发票', '费用清单', '出院小结'],
    deadline: '就医前先备案；急诊后按参保地时限补备案/报销',
    caution: '没备案直接去外地住院，报销比例可能下降；急诊留好急诊证明，回参保地补备案。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '国家医疗保障局',
    priority: 104,
  },
  {
    id: 'right-retire-process',
    category: 'retire',
    intent: 'do',
    audience: ['all'],
    title: '退休办理：提前 3 个月准备',
    oneLiner: '达到法定退休年龄且缴费满最低年限，建议提前 3 个月到社保经办机构/APP 办理退休；2030 年起最低缴费年限逐步从 15 年提高到 20 年。',
    whatToDo: [
      '查养老保险累计缴费年限与个人账户：国家社会保险公共服务平台或当地人社 APP。',
      '提前 3 个月准备身份证、社保卡、人事档案（按当地要求）。',
      '到社保经办机构或当地人社 APP 提交退休申请，确认养老金发放账户。',
    ],
    whatToGet: ['按月养老金', '医保退休待遇（需满足当地医保缴费年限）'],
    whereToGo: '当地社保经办机构 / 人社 APP / 12333',
    officialUrl: 'https://www.gov.cn/yaowen/liebiao/202409/content_6974294.htm',
    deadline: '建议退休前 3 个月启动；医保年限不足需提前补缴/续缴',
    materials: ['身份证', '社保卡', '人事档案（按当地）', '养老金发放账户'],
    caution: '2030-01-01 起最低缴费年限逐步提高，每年 +6 个月；不要按“15 年就够了”的老口径规划。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '渐进式延迟法定退休年龄与最低缴费年限政策',
    priority: 105,
  },
  {
    id: 'right-unemployment-claim',
    category: 'unemployment',
    intent: 'get',
    audience: ['all'],
    title: '失业金：三个条件 + 怎么申领',
    oneLiner: '缴费满 1 年、非因本人意愿中断就业、已办理失业登记并有求职要求，可申领失业保险金；期限按缴费年限 12/18/24 个月。',
    whatToDo: [
      '让单位出具解除/终止劳动合同证明，注明“非因本人意愿”。',
      '到当地人社 APP/窗口办理失业登记，填写求职意向。',
      '提交失业金申领，按月完成资格认证（各地方式不同）。',
    ],
    whatToGet: ['失业保险金（按当地标准）', '领取期间代缴职工医保（按当地）'],
    whereToGo: '当地人社 APP / 失业保险经办机构 / 12333',
    officialUrl: 'https://www.mohrss.gov.cn/xxgk2020/fdzdgknr/zcfg/fl/202011/t20201102_394629.html',
    deadline: '解除劳动合同后尽快办理；各地对申领时限有规定',
    materials: ['解除/终止劳动合同证明', '身份证', '社保卡/银行卡', '失业登记信息'],
    caution: '主动辞职通常不符合“非因本人意愿”；被辞退、合同到期不续签、单位倒闭等才在范围内。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '失业保险条例',
    priority: 106,
  },
  {
    id: 'right-injury-report',
    category: 'injury',
    intent: 'do',
    audience: ['all'],
    title: '工伤认定：单位 30 日、个人 1 年',
    oneLiner: '事故伤害发生之日起 30 日内，用人单位应向社保行政部门提出工伤认定申请；单位不申请的，个人可在 1 年内申请。',
    whatToDo: [
      '先就医并保留：病历、诊断证明、费用票据、现场照片/视频、证人联系方式。',
      '要求单位在 30 日内申请工伤认定；单位不办，自己 1 年内向当地人社部门提交。',
      '认定后申请劳动能力鉴定，再按伤残等级主张待遇。',
    ],
    whatToGet: ['工伤医疗费用', '停工留薪期工资', '伤残待遇/一次性补助（按鉴定等级）'],
    whereToGo: '当地人社局工伤认定窗口 / 12333 / 劳动能力鉴定委员会',
    officialUrl: 'https://xzfg.moj.gov.cn/front/law/detail?LawID=610',
    deadline: '单位 30 日内；个人 1 年内（从事故伤害发生之日起）',
    materials: ['工伤认定申请表', '劳动关系证明', '医疗诊断证明', '事故经过与证人材料'],
    caution: '超过 1 年个人申请时限，工伤认定可能不被受理；不要只和单位“私了”而不做认定。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '工伤保险条例',
    priority: 107,
  },
  {
    id: 'right-wage-arrears',
    category: 'trouble',
    intent: 'do',
    audience: ['all'],
    title: '被欠薪：先留证据，再走监察/仲裁',
    oneLiner: '欠薪不要只靠口头承诺。先固定考勤、工资条、聊天记录、转账记录，再向劳动监察投诉；投诉无果，在 1 年内申请劳动仲裁。',
    whatToDo: [
      '保存证据：考勤记录、工资条、工作群聊天、派单记录、银行流水、欠条。',
      '向当地劳动监察大队投诉（可拨 12333 问地址），要求出具受理凭证。',
      '投诉无果，在知道权利被侵害之日起 1 年内申请劳动仲裁；可申请法律援助。',
    ],
    whatToGet: ['被拖欠的工资', '符合条件的经济补偿/赔偿金', '法律援助（符合条件）'],
    whereToGo: '当地劳动监察大队 / 劳动人事争议仲裁院 / 12333 / 12348',
    officialUrl: 'https://www.mohrss.gov.cn/',
    deadline: '劳动仲裁时效通常 1 年；欠薪越早取证越好',
    materials: ['身份证', '劳动关系证明', '工资/考勤/聊天记录', '欠条或结算单'],
    caution: '不要签“已结清”字样再拿部分钱；不要暴力讨薪；先投诉/仲裁，保留受理回执。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '人力资源和社会保障部',
    priority: 108,
  },
  {
    id: 'right-social-transfer',
    category: 'social',
    intent: 'do',
    audience: ['all', 'flex'],
    title: '社保转移：换城市工作，养老和医保怎么转',
    oneLiner: '跨省/跨市换工作，先在新城市参保，再申请养老保险关系转移；医保关系可转移接续。不是把账户里的钱取出来，而是把缴费记录接上。',
    whatToDo: [
      '先在新城市办理参保登记，拿到新参保地账户。',
      '打开国家社会保险公共服务平台/掌上12333，选「社保关系转移」提交转入申请。',
      '查原参保地是否转出、新参保地是否接收；医保转移按当地医保 APP 另办。',
    ],
    whatToGet: ['养老保险缴费年限累计计算', '个人账户余额按规定转移', '医保关系接续（按当地）'],
    whereToGo: '国家社会保险公共服务平台 / 掌上12333 / 新参保地社保经办',
    officialUrl: 'https://si.12333.gov.cn/',
    deadline: '新参保后尽快办；退休前必须把各地记录归集',
    materials: ['身份证', '社保卡', '新参保地参保证明', '原参保地账户信息（按当地）'],
    caution: '转移不是退保，不能把统筹部分取现；不要找收费代办。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '国家社会保险公共服务平台',
    priority: 109,
  },
  {
    id: 'right-medical-reimburse',
    category: 'medical',
    intent: 'get',
    audience: ['all'],
    title: '医保手工报销：异地/急诊先垫钱，回去怎么报',
    oneLiner: '没直接结算的异地就医、急诊、转诊，保留发票和费用清单，回参保地医保经办机构/APP 申请手工报销；能不能报、报多少看参保地政策。',
    whatToDo: [
      '确认就医医院与费用是否在医保范围；急诊要留急诊证明。',
      '保留发票原件、费用清单、出院小结、病历、医保卡。',
      '回参保地医保 APP/窗口提交手工报销；已备案的按备案类型处理。',
    ],
    whatToGet: ['符合政策范围的医疗费按参保地比例报销', '急诊/转诊按当地规定处理'],
    whereToGo: '参保地医保经办机构 / 国家医保服务平台 / 12393',
    officialUrl: 'https://www.nhsa.gov.cn/',
    deadline: '就医后按参保地时限申请，越早越好',
    materials: ['发票原件', '费用清单', '出院小结/病历', '医保卡/电子凭证', '急诊或转诊证明（如有）'],
    caution: '能直接结算优先直接结算；工伤、第三方责任等不能重复报；发票原件别丢。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '国家医疗保障局',
    priority: 110,
  },
  {
    id: 'right-housing-fund-loan',
    category: 'housing',
    intent: 'get',
    audience: ['all'],
    title: '公积金贷款：先查资格，再交定金',
    oneLiner: '公积金贷款不是有账户就能贷：要看连续缴存月数、账户余额、当地额度与楼盘准入。先做资格预审，再签购房合同/交定金。',
    whatToDo: [
      '查连续缴存月数、账户余额与当地贷款政策（公积金 APP/12329）。',
      '确认楼盘是否支持公积金贷款，做额度与资格预审。',
      '准备材料提交申请；审批通过后再签借款合同、办抵押。',
    ],
    whatToGet: ['合规范围内申请公积金贷款', '按当地利率与额度政策执行'],
    whereToGo: '当地住房公积金管理中心 / 公积金 APP / 12329',
    officialUrl: 'https://www.gov.cn/gongbao/2026/issue_12946/202608/content_7079363.html',
    deadline: '签购房合同/交定金前先预审；具体时限按当地',
    materials: ['身份证', '婚姻状况证明（按当地）', '购房合同/认购书', '收入与银行流水', '公积金缴存证明'],
    caution: '各城额度、缴存月数、首付比例不同，别套外地；开发商拒绝公积金贷款可向公积金中心投诉。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '住房公积金管理条例（2026 年修订）',
    priority: 111,
  },
  {
    id: 'right-vocational-subsidy',
    category: 'subsidy',
    intent: 'get',
    audience: ['all', 'flex'],
    title: '职业技能提升补贴：考了证，怎么领补贴',
    oneLiner: '不是所有证书都能补：先查当地补贴目录和证书范围，再在人社 APP/窗口申请；通常要求在职/参保状态，具体以当地为准。',
    whatToDo: [
      '查当地职业技能提升补贴目录，确认证书在不在范围内。',
      '在人社 APP/窗口提交申请，按要求填证书编号与参保信息。',
      '等待审核与公示；通过后补贴打到本人账户。',
    ],
    whatToGet: ['按当地目录和标准发放的职业培训/技能提升补贴', '紧缺工种可能上浮（按当地）'],
    whereToGo: '当地人社 APP / 街道人社窗口 / 12333',
    officialUrl: 'https://www.gov.cn/zhengce/zhengceku/202401/content_6926462.htm',
    deadline: '证书核发后按当地时限，通常越早越好',
    materials: ['身份证', '职业资格证书/技能等级证书', '社保缴费记录', '银行卡', '申请表（按当地）'],
    caution: '先查目录，别为补贴去考不在目录的证；不要交“包过/代办”费。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '就业补助资金管理办法',
    priority: 112,
  },
  {
    id: 'right-contract-renewal',
    category: 'trouble',
    intent: 'get',
    audience: ['all'],
    title: '合同到期不续签：经济补偿怎么主张',
    oneLiner: '合同到期，单位不续签，或续签时降低工资/条件，通常要按工作年限支付经济补偿；你自己主动不续签、或单位维持/提高条件你不签，通常没有。',
    whatToDo: [
      '保存合同、到期通知、工资流水、社保记录。',
      '判断是单位不续签/降低条件，还是自己拒绝续签。',
      '先书面沟通；协商不成，离职后 1 年内申请劳动仲裁，主张经济补偿。',
    ],
    whatToGet: ['按工作年限计算的经济补偿（符合条件）', '欠付工资/未休年假另算'],
    whereToGo: '当地劳动人事争议仲裁院 / 12333 / 12348',
    officialUrl: 'https://www.gov.cn/gongbao/content/2007/content_711013.htm',
    deadline: '离职后 1 年内申请劳动仲裁',
    materials: ['劳动合同', '到期通知/续签条件', '工资流水', '社保记录', '解除/终止证明'],
    caution: '不要先签“个人原因离职”；单位降低条件续签要留证据；经济补偿与赔偿金不是一回事。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '中华人民共和国劳动合同法',
    priority: 113,
  },
  {
    id: 'right-occupational-disease',
    category: 'injury',
    intent: 'do',
    audience: ['all'],
    title: '职业病诊断：粉尘、噪声、化学品岗位怎么查',
    oneLiner: '长期接触粉尘/噪声/化学品，怀疑职业病，要去有资质的职业病诊断机构，不是普通医院体检；诊断后符合条件的再走工伤认定。',
    whatToDo: [
      '做职业健康检查，保留岗位、工龄、危害接触史。',
      '向职业病诊断机构提交职业史、危害接触史、工作场所检测资料。',
      '诊断/鉴定后，向人社部门申请工伤认定与劳动能力鉴定。',
    ],
    whatToGet: ['职业病诊断/鉴定结论', '符合条件的工伤待遇'],
    whereToGo: '职业病诊断机构 / 当地人社局工伤认定窗口 / 12333',
    officialUrl: 'https://www.gov.cn/zhengce/zhengceku/2010-12/24/content_7254.htm',
    deadline: '发现异常尽早诊断；工伤认定按当地时限',
    materials: ['职业史/劳动关系证明', '职业健康检查报告', '工作场所职业病危害检测资料', '身份证'],
    caution: '单位不给资料可向卫健/人社投诉；不要找无资质机构“代体检”。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '工伤保险条例',
    priority: 114,
  },
  {
    id: 'right-unemployment-registration',
    category: 'unemployment',
    intent: 'do',
    audience: ['all'],
    title: '失业登记：领失业金、找工作前先办这一件事',
    oneLiner: '失业登记不等于领失业金，但领失业金、参加免费培训、申请就业援助通常要先登记。',
    whatToDo: [
      '拿解除/终止劳动合同证明。',
      '在当地人社 APP/街道窗口办失业登记，填求职意向。',
      '符合条件再申领失业金；参加培训/招聘会。',
    ],
    whatToGet: ['失业登记记录', '符合条件的失业保险金/就业援助'],
    whereToGo: '当地人社 APP / 街道人社窗口 / 12333',
    officialUrl: 'https://www.mohrss.gov.cn/',
    deadline: '解除后尽快；各地申领时限不同',
    materials: ['身份证', '解除/终止劳动合同证明', '社保卡/银行卡', '失业登记信息'],
    caution: '主动辞职也可登记失业，但通常不符合失业金“非因本人意愿”条件；登记后配合求职。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '人力资源和社会保障部',
    priority: 115,
  },
  {
    id: 'right-maternity-medical',
    category: 'birth',
    intent: 'get',
    audience: ['all'],
    title: '生育医疗费：产检、分娩怎么报',
    oneLiner: '生育医疗费用和生育津贴是两笔：定点医院可直接结算，未直接结算的保留票据回参保地报销；津贴另按产假天数申请。',
    whatToDo: [
      '确认生育保险参保/连续缴费状态。',
      '定点医院就医，出示医保电子凭证；能直接结算直接结算。',
      '未直接结算的，留发票/清单/出院小结，回参保地医保提交；同时申请津贴。',
    ],
    whatToGet: ['产检/分娩医疗费按当地政策报销', '生育津贴（符合条件）'],
    whereToGo: '参保地医保经办机构 / 医保 APP / 12393',
    officialUrl: 'https://www.gov.cn/zhengce/202505/content_7022301.htm',
    deadline: '分娩后按当地时限申请',
    materials: ['身份证', '医保卡/电子凭证', '出生医学证明', '发票/费用清单/出院小结', '生育服务证（按当地）'],
    caution: '灵活就业是否纳入生育保险看当地；不要用外省标准；津贴和医疗费别只报一项。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '国家医保局生育保险政策解读',
    priority: 116,
  },
  {
    id: 'right-tax-annual',
    category: 'tax',
    intent: 'get',
    audience: ['all'],
    title: '个税年度汇算：补税、退税怎么操作',
    oneLiner: '每年 3–6 月对上一年的工资、劳务报酬、稿酬等做汇算；专项附加扣除、个人养老金、税优健康险没报的，汇算时补上。',
    whatToDo: [
      '下载「个人所得税」APP，查收入纳税明细。',
      '核对专项附加扣除、个人养老金、税优健康险、公益捐赠等。',
      '在 3–6 月汇算，按提示补税或申请退税；补税要按期。',
    ],
    whatToGet: ['多预缴税款的退税（符合条件）', '应补税款按 APP 计算'],
    whereToGo: '「个人所得税」APP / 当地税务局 / 12366',
    officialUrl: 'https://www.chinatax.gov.cn/',
    deadline: '次年 3 月 1 日–6 月 30 日',
    materials: ['身份证', '银行卡', '专项附加扣除证明', '个人养老金/税优健康险凭证'],
    caution: '不要虚假填报；补税逾期可能产生滞纳金；是否免申报以 APP 提示和现行规定为准。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '国家税务总局',
    priority: 117,
  },
  {
    id: 'right-flex-registration',
    category: 'social',
    intent: 'do',
    audience: ['all', 'flex'],
    title: '灵活就业登记：参保、领补贴的前置步骤',
    oneLiner: '很多城市要求先做灵活就业登记，才能以灵活就业身份参保或申请社保补贴；登记不等于参保。',
    whatToDo: [
      '到街道/社区人社窗口或当地人社 APP 办灵活就业登记。',
      '准备身份证、照片、就业状态证明（按当地）。',
      '登记后再办养老/医保参保；申请补贴另按当地流程。',
    ],
    whatToGet: ['灵活就业登记记录', '凭登记办理参保/补贴的资格'],
    whereToGo: '街道/社区人社窗口 / 当地人社 APP / 12333',
    officialUrl: 'https://www.mohrss.gov.cn/',
    deadline: '参保/申请补贴前办；按当地年度申报期',
    materials: ['身份证', '照片', '灵活就业证明（按当地）', '银行卡'],
    caution: '登记不等于自动参保，也不等于自动发补贴；各地认定口径不同，先问 12333。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '人力资源和社会保障部',
    priority: 118,
  },
  {
    id: 'right-pension-certification',
    category: 'retire',
    intent: 'do',
    audience: ['all'],
    title: '养老金领取资格认证：每年一次，别让养老金停发',
    oneLiner: '已领养老金的人一般要按当地周期做资格认证；逾期可能暂停发放，补认证后恢复并补发。',
    whatToDo: [
      '打开当地人社 APP/掌上12333，找「养老金资格认证」。',
      '按提示人脸识别；不会用手机可去社区/银行网点。',
      '认证后查发放状态；逾期停发尽快补认证。',
    ],
    whatToGet: ['继续按月领取养老金', '补认证后恢复/补发（按当地）'],
    whereToGo: '当地人社 APP / 掌上12333 / 社区或银行网点',
    officialUrl: 'https://si.12333.gov.cn/',
    deadline: '按当地周期（通常每年一次），以当地通知为准',
    materials: ['身份证', '社保卡', '本人人脸识别'],
    caution: '不要给陌生人代办；认证免费；停发不等于取消资格。',
    confidence: 'official',
    level: 'L2',
    lastVerified: '2026-11-19',
    sourceTitle: '国家社会保险公共服务平台',
    priority: 119,
  },
]

export const RIGHTS_CATALOG: RightsItem[] = [...GUIDE_RIGHTS, ...NEW_RIGHTS]

const SITUATION_CATEGORIES: Record<RightsSituation, RightsCategory[]> = {
  'first-job': ['onboard', 'social'],
  social: ['social', 'medical'],
  benefits: ['housing', 'birth', 'heat', 'subsidy', 'tax', 'unemployment'],
  medical: ['medical'],
  housing: ['housing'],
  birth: ['birth'],
  injury: ['injury'],
  unemployment: ['unemployment'],
  retire: ['retire', 'social'],
  trouble: ['trouble', 'injury', 'onboard'],
  all: [],
}

const SITUATION_INTENT: Partial<Record<RightsSituation, RightsIntent>> = {
  benefits: 'get',
}

export function getProvinceChannel(city?: string | null): ProvinceChannel | undefined {
  const province = provinceOf(city)
  if (!province) return undefined
  return PROVINCE_CHANNELS.find((c) => c.province === province)
}

/**
 * 按“城市 + 身份 + 想解决的事”生成 3–7 条清单。
 * 没有城市也能返回全国框架条目；城市只影响“本地入口”卡片，不影响条目真假。
 */
export function getRightsForSituation(
  _city: string | null | undefined,
  identity: RightsIdentity,
  situation: RightsSituation,
): RightsItem[] {
  const audienceOk = (item: RightsItem) =>
    identity === 'unsure' || item.audience.includes('all') || item.audience.includes(identity as RightsAudience)
  const categories = SITUATION_CATEGORIES[situation]
  const intent = SITUATION_INTENT[situation]

  let candidates = RIGHTS_CATALOG.filter((item) => {
    if (!audienceOk(item)) return false
    if (intent && item.intent !== intent) return false
    if (categories.length && !categories.includes(item.category)) return false
    return true
  })

  // 某个情境条目太少时，退回“该身份可看的全部条目”，保证向导至少给 3 条
  if (candidates.length < 3) {
    candidates = RIGHTS_CATALOG.filter(audienceOk)
  }

  return candidates
    .slice()
    .sort((a, b) => {
      // L2 优先：先给能直接照着办的，L1 只用于“知道有这件事”的兜底。
      if (a.level !== b.level) return a.level === 'L2' ? -1 : 1
      return a.priority - b.priority
    })
    .slice(0, 7)
}

export function rightsForEntry(entry: 'tasks' | 'benefits' | 'social' | 'trouble'): RightsItem[] {
  if (entry === 'benefits') return RIGHTS_CATALOG.filter((i) => i.intent !== 'do').slice(0, 20)
  if (entry === 'social') return RIGHTS_CATALOG.filter((i) => ['social', 'medical'].includes(i.category)).slice(0, 12)
  if (entry === 'trouble') return RIGHTS_CATALOG.filter((i) => ['trouble', 'injury'].includes(i.category)).slice(0, 12)
  return RIGHTS_CATALOG.filter((i) => ['onboard', 'social'].includes(i.category)).slice(0, 12)
}
