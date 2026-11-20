/**
 * 七类高频办事模板。
 *
 * 模板不是另一套内容，而是把已经审核过的 RightsItem 按真实办事顺序排好：
 * 用户不跟 AI 对话，也能拿到一张能打印、能保存、能逐项打勾的清单。
 * itemIds 的顺序就是「先办哪件」；第一条永远是整个流程最该先做的动作。
 */
import {
  RIGHTS_CATALOG,
  getRightsForSituation,
  type RightsIdentity,
  type RightsItem,
  type RightsSituation,
} from './catalog'

export type RightsTemplateKey =
  | 'onboard-7'
  | 'resign-handover'
  | 'injury-30'
  | 'unemployment-claim'
  | 'birth-allowance'
  | 'retire-process'
  | 'wage-evidence'

export interface RightsTemplate {
  key: RightsTemplateKey
  /** 快捷入口上的短标题，尽量保留用户原话 */
  label: string
  /** 结果页展示的模板全名 */
  name: string
  hint: string
  /** 一句话说明这张清单解决什么问题 */
  intro: string
  identity: RightsIdentity
  situation: RightsSituation
  itemIds: string[]
  /** 模板自己的交接/取证提醒，不混进 RightsItem 的事实口径 */
  note?: string
}

export const RIGHTS_TEMPLATES: RightsTemplate[] = [
  {
    key: 'onboard-7',
    label: '刚入职 · 入职 7 天',
    name: '入职 7 天清单',
    hint: '合同、试用期、参保、社保卡',
    intro: '入职前 7 天先把用工主体、合同、参保和工资卡确认清楚，避免试用期白干、社保漏缴。',
    identity: 'new-grad',
    situation: 'first-job',
    itemIds: [
      'guide-rookie-first-day',
      'guide-rookie-contract',
      'right-probation',
      'guide-how-to-pay',
      'right-housing-fund',
      'right-social-card',
      'right-social-record',
    ],
  },
  {
    key: 'resign-handover',
    label: '刚离职 · 离职交接',
    name: '离职交接清单',
    hint: '通知、年假、社保转出、失业登记',
    intro: '提离职前后按这张单走：先写通知，再结清年假和工资，最后转社保、办失业登记。',
    identity: 'employee',
    situation: 'unemployment',
    itemIds: [
      'right-resignation',
      'guide-annual-leave',
      'right-social-record',
      'right-social-transfer',
      'right-unemployment-registration',
      'right-unemployment-claim',
      'right-labor-inspection',
    ],
    note: '交接时另做一张交接单：工作事项、账号权限、公司财物、工资结算日各写一行，双方签字后自己留一份照片。',
  },
  {
    key: 'injury-30',
    label: '工伤 · 30 天倒计时',
    name: '工伤 30 天倒计时',
    hint: '认定、职业病、医疗期、监察',
    intro: '出事后先报案和就医，再盯住单位 30 日申请工伤认定这条线；单位不办，个人 1 年内也能申请。',
    identity: 'employee',
    situation: 'injury',
    itemIds: [
      'right-injury-report',
      'right-occupational-disease',
      'right-sick-leave',
      'right-labor-inspection',
      'right-arbitration',
      'right-legal-aid',
    ],
    note: '第一天就留证据：事故时间地点、目击人、现场照片、就医记录、与单位沟通的聊天记录，全部备份。',
  },
  {
    key: 'unemployment-claim',
    label: '失业 · 失业金申领',
    name: '失业金申领清单',
    hint: '三个条件、登记、申领、医保',
    intro: '先确认是不是“非因本人意愿”中断就业、失业保险缴满 1 年，再做失业登记和申领。',
    identity: 'employee',
    situation: 'unemployment',
    itemIds: [
      'right-unemployment-registration',
      'right-unemployment-claim',
      'right-public-employment',
      'right-social-transfer',
      'right-medical-cross-city',
      'right-legal-aid',
    ],
  },
  {
    key: 'birth-allowance',
    label: '生育 · 津贴材料',
    name: '生育津贴材料清单',
    hint: '连续缴费、产检分娩、津贴',
    intro: '怀孕或刚生育先查医保连续缴费月数，再把产检/分娩票据和津贴材料分开准备。',
    identity: 'employee',
    situation: 'birth',
    itemIds: [
      'right-birth-allowance',
      'right-maternity-medical',
      'right-maternity-leave',
      'right-medical-reimburse',
      'right-social-record',
      'right-social-card',
    ],
  },
  {
    key: 'retire-process',
    label: '临近退休 · 退休办理',
    name: '退休办理清单',
    hint: '年龄、缴费年限、档案、认证',
    intro: '退休前 3 个月先核对年龄、缴费年限和档案，再办退休手续，之后每年做一次养老金资格认证。',
    identity: 'employee',
    situation: 'retire',
    itemIds: [
      'right-retire-process',
      'right-pension-certification',
      'right-survivor-benefits',
      'right-social-record',
      'guide-retire-age',
      'right-medical-cross-city',
    ],
    note: '先查档案在哪：单位、人才中心或街道；档案缺失会直接影响视同缴费年限认定。',
  },
  {
    key: 'wage-evidence',
    label: '被欠薪 · 取证清单',
    name: '被欠薪取证清单',
    hint: '证据、监察、仲裁、法援',
    intro: '不要只口头催；先把劳动关系、欠薪金额和时间固定下来，再走监察或仲裁。',
    identity: 'employee',
    situation: 'trouble',
    itemIds: [
      'right-wage-arrears',
      'right-written-contract',
      'right-overtime-pay',
      'right-labor-inspection',
      'right-arbitration',
      'right-legal-aid',
    ],
    note: '证据按时间排序：合同/工牌/考勤、工资条/转账、催款聊天、对方承认欠薪的录音；原始载体不要删。',
  },
]

const BY_ID = new Map(RIGHTS_CATALOG.map((item) => [item.id, item]))

/** 模板引用的条目是否都还在目录里；给单测和内容巡检用。 */
export function missingTemplateItemIds(template: RightsTemplate): string[] {
  return template.itemIds.filter((id) => !BY_ID.has(id))
}

/**
 * 按模板取清单。模板条目不足 3 条时，用同身份/情境的目录条目补齐，
 * 但绝不跨模板硬凑到 7 条——宁可短，也不把不相关的事塞给用户。
 */
export function getRightsForTemplate(template: RightsTemplate): RightsItem[] {
  const picked: RightsItem[] = []
  const seen = new Set<string>()
  for (const id of template.itemIds) {
    const item = BY_ID.get(id)
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    picked.push(item)
  }
  if (picked.length >= 3) return picked.slice(0, 7)

  const fallback = getRightsForSituation(null, template.identity, template.situation)
  for (const item of fallback) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    picked.push(item)
    if (picked.length >= 7) break
  }
  return picked
}

export function findRightsTemplate(key: string): RightsTemplate | undefined {
  return RIGHTS_TEMPLATES.find((template) => template.key === key)
}
