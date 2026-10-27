/**
 * 现实核查（真话层）
 *
 * 把「官方/宣传口径」与「现实反馈」的差距写进产品。证据分级（从强到弱）：
 * - law：法律条文（可逐字核对）
 * - official：官方文件（文号可查）
 * - media：媒体报道（多家可交叉核对）
 * - experience：经验总结（无权威统计，必须给出自验方法，不得冒充事实）
 *
 * 纪律：
 * 1. 凡可核实数字/条文，必须给 source；查不到出处的，一律降到 experience 并给 verify；
 * 2. detail 里禁止出现「权威统计显示 X%」这类无法回溯的量化断言；
 * 3. 新条目进 catalogs 前过 tests/reality.spec.ts 的结构校验。
 */

export type EvidenceLevel = 'law' | 'official' | 'media' | 'experience'

export type RealityCategory = 'income' | 'rights' | 'social' | 'data'

export const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  law: '法律条文',
  official: '官方文件',
  media: '媒体报道',
  experience: '经验·待自验',
}

export const REALITY_CATEGORY_LABELS: Record<RealityCategory, string> = {
  income: '收入口径：广告说的和你拿到的',
  rights: '维权现实：哪些仗打不赢',
  social: '社保与养老：退出的代价',
  data: '数据与假设：本工具自己的边界',
}

export interface RealityFact {
  id: string
  category: RealityCategory
  title: string
  detail: string
  evidence: EvidenceLevel
  /** law / official / media 条目的依据出处 */
  source?: string
  /** experience 条目的自验方法（必填） */
  verify?: string
  /** 可点开的官方原文（核验过的链接） */
  links?: { title: string; url: string }[]
}

export const REALITY_FACTS: RealityFact[] = [
  {
    id: 'ad-upper-bound',
    category: 'income',
    title: '招聘广告上的薪资是上限口径，不是中位口径',
    detail:
      '招聘平台（BOSS直聘等）上的薪资由发布方自行填写，普遍按「跑得最好的那批人＋最旺的月份＋补贴全拿」标注。骑手岗位的「月入过万」几乎从不说明：需要多少单量、多长在线时长、是否扣成本与罚款。《网络招聘服务管理规定》要求招聘信息真实、合法，但薪资数字通常只做形式审核，标的数字也不构成任何承诺。',
    evidence: 'media',
    source: '多家媒体曾就「招聘薪资注水」做过调查报道（可用关键词「招聘平台 薪资注水 调查」复核）；人社部令第 44 号《网络招聘服务管理规定》',
    verify: '对照招聘广告与在职骑手最近 3 个月的实际到手流水，重点看淡季月份；面试时要求对方写明保底单价与考核规则，口头承诺不算数。',
    links: [
      { title: '网络招聘服务管理规定（人力资源社会保障部令第 44 号）', url: 'https://www.gov.cn/zhengce/zhengceku/2020-12/25/content_5573141.htm' },
    ],
  },
  {
    id: 'rookie-gap',
    category: 'income',
    title: '新手期与熟练期的收入差距极大',
    detail:
      '2021 年 4 月，北京市人社局一位副处长（王林）跟岗体验送外卖，12 小时收入 41 元，据报道大部分时间花在等单与找路上。这是极端个案，不能当均值，但方向是真实的：路况不熟、账号权重低、找楼耗时长，都会让头 1-2 个月收入显著低于稳态，招聘话术从不提这段折扣期。',
    evidence: 'media',
    source: '北京卫视《我为群众办实事》节目（2021-04），人民日报、新华社等多家央媒跟进报道（可检索「王林 12小时 41元」）',
    verify: '找身边入职未满 3 个月的骑手，对比其首月与第 3 个月的月到手金额。',
  },
  {
    id: 'penalty-reality',
    category: 'income',
    title: '罚款与扣款：政策要求「算法取中」，现实执行因地制宜',
    detail:
      '市场监管总局等七部门 2021 年 7 月明确要求：平台不得将「最严算法」作为考核要求，应通过「算法取中」适当放宽配送时限、畅通申诉渠道。但骑手社区投诉中，超时、差评、提前点送达等扣款仍是高频词，规则改了、执行体感因人因城而异。本工具的成本表里，把近 3 个月账单的「扣款合计」除以月数填进「其他」，才算真实成本。',
    evidence: 'official',
    source: '市场监管总局等七部门《关于落实网络餐饮平台责任切实维护外卖送餐员权益的指导意见》（2021-07）',
    verify: '打开自己 APP 的账单-扣款明细，统计近 3 个月扣款合计，与成本表中已填数字对比。',
  },
  {
    id: 'seasonal-gap',
    category: 'income',
    title: '淡旺季差距很大，别拿旺季月份做全年预期',
    detail:
      '骑手收入高度依赖单量与补贴：恶劣天气、节假日、平台补贴战是旺季；开春与盛夏的普通工作日，单量和单价都会回落。用旺季数据做月度预算是最常见的误判。本工具的「月工作天 / 雨天 / 节假日」三个参数，就是让你把淡季和旺季各算一遍。',
    evidence: 'experience',
    verify: '导出自己连续 6 个月的平台流水，对比最高月与最低月，取中间两个月做基准预期。',
  },
  {
    id: 'relation-gate',
    category: 'rights',
    title: '确认劳动关系是道门槛，多数骑手在第一关就被卡住',
    detail:
      '欠薪、加班费、经济补偿、工伤待遇，几乎都以「劳动关系」为前提。平台普遍以承揽协议、外包公司、引导注册个体工商户来隔离劳动关系；人社部发〔2021〕56号确立的「不完全符合确立劳动关系情形」，保障水平低于劳动法基准——本工具补偿计算页里标注「条件」的项目，正是在提示这层风险。',
    evidence: 'official',
    source: '人社部发〔2021〕56号（本城规则文件与政策页已收录原文链接）',
    verify: '在中国裁判文书网检索「外卖骑手 确认劳动关系」，按你所在城市筛选，看同类案件的裁判结果再决定路径。',
    links: [
      { title: '关于维护新就业形态劳动者劳动保障权益的指导意见', url: 'https://hrss.sz.gov.cn/ztfw/xjyxtfwbzzt/xjyxtldzzcwj/content/post_10413952.html' },
    ],
  },
  {
    id: 'conditional-gap',
    category: 'rights',
    title: '「不完全劳动关系」下，有些项目天然拿不到',
    detail:
      '加班费、未签合同二倍工资、违法解除 2N 赔偿、工伤保险待遇——这四类的共同前提都是标准劳动关系。若最终被认定为「不完全符合确立劳动关系情形」，它们大概率不会获得支持，能走的通常只剩报酬争议与服务合同/侵权路径。这不是工具算错了，是救济路径本身受限。',
    evidence: 'official',
    source: '人社部发〔2021〕56号；本工具「权益补偿计算器」中全部标注「条件」的项目',
    verify: '对每个条件项，把仲裁请求先写出来，拿去 12348 法律援助热线做一次可受理性预评估。',
  },
  {
    id: 'evidence-hold',
    category: 'rights',
    title: '证据在平台手里，举证窗口随时会关闭',
    detail:
      '劳动争议中，与争议事项有关的证据由单位掌握管理的，单位应当提供（举证责任倒置）。但这条只在「劳动争议」里生效——关系没认定、走民事路径时，就是「谁主张谁举证」，而派单、计价、扣款数据全在平台服务器。账号一旦被封禁或数据被清理，APP 内的历史记录可能再也导不出来。',
    evidence: 'law',
    source: '《劳动争议调解仲裁法》第 6 条',
    verify: '发现争议当天，先按本工具「维权指南」第 1 步完成取证动作，再谈主张金额。',
  },
  {
    id: 'limitation-clock',
    category: 'rights',
    title: '时效不等人：仲裁 1 年、工伤认定 1 年，超期即败',
    detail:
      '劳动仲裁申请时效为 1 年，自知道或应当知道权利被侵害之日起算；工伤认定由个人申请的期限同样只有 1 年（用人单位是 30 日）。超期基本意味着丧失胜诉权，与是非对错无关——这是维权的第一号杀手。',
    evidence: 'law',
    source: '《劳动争议调解仲裁法》第 27 条；《工伤保险条例》第 17 条',
    verify: '拨 12333 或 12348，报出你的争议发生日期，对方会直接告诉你是否还在时效内。',
  },
  {
    id: 'time-cost',
    category: 'rights',
    title: '一场完整维权以年计，而你要继续靠这个账号吃饭',
    detail:
      '仲裁庭应在受理后 45 日内结案（可延 15 日）；对裁决不服可起诉，一审、二审走完，半年到两年是常态。劳动仲裁不收费，收费的是你的时间与注意力——期间每跑一次窗口、开一次庭，都是当天的收入损失。',
    evidence: 'law',
    source: '《劳动争议调解仲裁法》第 43 条（审限）、第 53 条（仲裁不收费）',
    verify: '把预计开庭/跑窗口的天数 × 你的日均净收入，算进维权的「成本」再决定是否启动。',
  },
  {
    id: 'enforcement',
    category: 'rights',
    title: '胜诉 ≠ 拿到钱：执行环节可能查无财产',
    detail:
      '骑手案件的被告常是轻资产的外包服务商：没有自有车辆与房产，甚至在争议期间就已注销。即便拿到胜诉裁决，执行阶段也可能因查无可供执行财产而终结。平台本身通常不在被诉主体之列。',
    evidence: 'experience',
    verify: '仲裁/起诉前先查被告主体：国家企业信用信息公示系统看注册资本与经营状态，中国执行信息公开网看是否已有被执行记录。',
  },
  {
    id: 'account-risk',
    category: 'rights',
    title: '争议期间，账号仍是你的软肋',
    detail:
      '行业普遍反映：与平台发生争议后，账号出现限单、降权甚至封禁。因果关系难以证明，但风险真实存在——账号一封，收入立刻归零，连取证入口都关闭。这不是劝退，是让你在启动程序前把「账号风险」算进成本。',
    evidence: 'experience',
    verify: '争议发生后先导出全部订单与账单记录、对账号状态录屏存档，再启动投诉或仲裁流程。',
  },
  {
    id: 'refund-only-personal',
    category: 'social',
    title: '不满 15 年退出，只退个人账户那 8%',
    detail:
      '灵活就业养老缴费的 20% 里，12% 进统筹基金、8% 记个人账户。若达到退休年龄时累计不满 15 年且不再续缴，按现行规定只能一次性取回个人账户储存额——统筹部分的 12% 留在池子里，不随人走。所以「先缴几年试试、不行再退」的代价，是把大部分缴费留在体系内。',
    evidence: 'law',
    source: '《实施〈中华人民共和国社会保险法〉若干规定》（人社部令第 13 号）；《社会保险法》第十二条（单位缴费与个人缴费分别记入统筹基金与个人账户）。12%/8% 分账为全国统一口径，广东的实施细则见粤人社规〔2026〕14 号第七条',
    verify: '用本工具「养老规划」把「缴 15 年停缴」与「缴至退休」两个方案都算一遍，看月养老金与总投入的差距。',
    links: [
      { title: '人力资源和社会保障部令（第 13 号） 实施《中华人民共和国社会保险法》若干规定', url: 'http://www.gov.cn/gongbao/content/2012/content_2041881.htm' },
    ],
  },
  {
    id: 'employment-injury-gap',
    category: 'social',
    title: '职业伤害保障 ≠ 工伤保险',
    detail:
      '平台按单缴费的职业伤害保障自 2022 年试点、2025 年扩围，但它不是工伤保险：覆盖限于接单过程，待遇项目少于工伤保险，认定与发放按平台规则执行。出事故后走哪条路径，直接决定赔偿量级，两条线要同时报案、别等结果。',
    evidence: 'official',
    source: '人社部等九部门 2025 年 8 月职业伤害保障扩围通知（本城政策页已收录）',
    verify: '出险后当天：平台侧职业伤害报案 + 人社侧工伤认定申请（个人时效 1 年）同时启动，不互相等待。',
    links: [
      { title: '关于扩大新就业形态人员职业伤害保障试点的通知', url: 'https://guangdong.chinatax.gov.cn/gdsw/zjfg/2025-08/18/content_8a392a22eed04f0f9477c8ee5294cbeb.shtml' },
    ],
  },
  {
    id: 'delay-retirement',
    category: 'social',
    title: '63 岁才领养老金（男），且最低缴费年限要涨到 20 年',
    detail:
      '2025 年起实施渐进式延迟法定退休年龄：男职工由 60 岁逐步延至 63 岁，女职工由 50/55 岁分别延至 55/58 岁；同时从 2030 年起，领取养老金的最低缴费年限将由 15 年逐步提高到 20 年。对 40 岁以下的骑手，「按 60 岁退休、缴满 15 年」的旧口径已经作废——本工具养老规划页按你填写的退休年龄测算，请按新政重填。',
    evidence: 'official',
    source: '全国人大常委会《关于实施渐进式延迟法定退休年龄的决定》（2024-09-13）',
    verify: '对照人社部发布的「退休年龄对照表」核你的出生年月；在养老规划页把退休年龄改为新政值后重看结论。',
    links: [
      { title: '关于印发《实施弹性退休制度暂行办法》的通知（人社部发〔2024〕94号）', url: 'https://www.gov.cn/zhengce/zhengceku/202501/content_6995747.htm' },
      { title: '办法公布！2025 年起弹性退休这样实施（解读，含「2030 年起由 15 年逐步提高至 20 年」）', url: 'https://www.gov.cn/zhengce/202501/content_6995752.htm' },
    ],
  },
  {
    id: 'medical-lapse',
    category: 'social',
    title: '医保断缴期间，报销即刻消失',
    detail:
      '医保按月缴费、按月生效：断缴期间发生的医疗费用不能报销，补缴后待遇恢复的规则各统筹区不同（是否设等待期、连续缴费年限如何计算，以参保地医保局口径为准）。灵活就业者的收入波动大，医保是全套社保里最不该断的一项——大额住院费用会瞬间吞掉数月净收入。',
    evidence: 'experience',
    verify: '致电参保地医保热线 12393，报出你的参保身份，直接问「断缴几个月会怎样、补缴如何恢复」。',
  },
  {
    id: 'fee-scam',
    category: 'income',
    title: '入职前收费：押金、培训费、软件费——这类钱基本要不回来',
    detail:
      '常见名目：车辆押金、装备押金、保证金、培训费、软件开通费、加盟费。共同点是「先交钱才能开始赚」。这是行业里最常见的骗局入口之一：对方往往是刚注册的服务商或空壳公司，钱交出去之后，要么人消失，要么以各种理由不退还，而你要回来需要打民事诉讼——金额通常小于维权成本。《网络招聘服务管理规定》要求招聘信息真实合法，但收费环节发生在平台之外，平台不承担担保。',
    evidence: 'official',
    source: '《网络招聘服务管理规定》（人力资源社会保障部令第 44 号）',
    verify: '交钱前做三件事：① 到「国家企业信用信息公示系统」查对方公司全名是否存在、有无经营异常；② 要求出具盖章收据并写明退还条件；③ 拒绝个人收款码。三条有一条不满足就换一家。',
    links: [
      { title: '网络招聘服务管理规定（人力资源社会保障部令第 44 号）', url: 'https://www.gov.cn/zhengce/zhengceku/2020-12/25/content_5573141.htm' },
      { title: '国家企业信用信息公示系统（查对方公司是否真实存在）', url: 'https://www.gsxt.gov.cn/' },
    ],
  },
  {
    id: 'vehicle-trap',
    category: 'income',
    title: '租车跑单：月租、绑定期限与违约金是最容易被忽略的三项',
    detail:
      '「平台提供车辆、你按月付租」的模式下，收入要先被租金吃掉一块，且合同常含绑定期限（提前退租要付违约金）、车辆损耗定损条款（小额剐蹭按高价索赔）。很多人算的时候只算租金，不算绑定与定损，退出时才发现倒欠钱。这不是说租车一定不划算，而是必须把这三项写进成本再决策。',
    evidence: 'experience',
    verify: '签租车合同前逐条问清并写进合同：① 月租多少、押金多少、押金多久退；② 有无最短租期、提前退租违约金多少；③ 车辆损坏如何定损、单价依据是什么。然后把月租填进本工具成本表的「维护费」，看净收入被吃掉多少。',
  },
  {
    id: 'recruit-quota',
    category: 'income',
    title: '「推荐入职给奖励」的招聘话术，成本最终落在跑单的人身上',
    detail:
      '大量招聘方是外包服务商或加盟站，拉人头的奖励机制使「招你进来」本身成了一门生意。这解释了为什么招聘话术普遍夸大收入、回避成本与罚款：招人方的收益与你的实际到手金额并不挂钩。判断方法很简单——问对方「你自己跑过吗？最近的流水能看吗？」',
    evidence: 'experience',
    verify: '面试时直接要求看「在职骑手最近 3 个月的实际到手流水截图」（遮挡姓名即可）。对方若无法提供或含糊其辞，把招聘数字按五折甚至更低理解。',
  },
  {
    id: 'no-social-insurance',
    category: 'social',
    title: '「不交社保多发钱」是可选的，但代价推迟到你需要它的时候',
    detail:
      '灵活就业身份的养老与医保全靠自己缴，很多新人因此选择不缴——当期到手通常多出 1,000–2,500 元/月（按你所在城市的基数下限与费率而定）。代价是：住院费用全自付、退休时没有累计缴费年限、无法享受终身医保。这笔账在年轻健康时看不出问题，但它是一次性不可逆的选择：断缴期间的年限补不回来（可补缴的情形与等待期以参保地规定为准，各地不同）。',
    evidence: 'law',
    source: '《社会保险法》第十条、第二十三条（灵活就业人员可参加职工基本养老、职工基本医疗保险）；各省实施细则不同，广东见粤人社规〔2026〕14 号',
    verify: '用本工具把「参保 / 不参保」两个方案各算一遍，重点看两个数字：当期净收入差多少、退休时养老金差多少（养老规划页）。再决定值不值。',
    links: [
      { title: '国办发〔2024〕38号 · 国务院办公厅关于健全基本医疗保险参保长效机制的指导意见（断缴等待期规则）', url: 'https://www.gov.cn/zhengce/zhengceku/202408/content_6965742.htm' },
    ],
  },
  {
    id: 'first-3-months',
    category: 'income',
    title: '前三个月是「学费期」：效率低不等于你不适合',
    detail:
      '新手期的三个客观折扣：路况不熟（找楼、绕路耗掉大量在线时间）、账号权重低（派单质量与优先级偏低）、流程不熟（取餐、应对异常、处理差评都慢）。同工时的单量往往显著低于稳态。很多人在这段时间用「招聘承诺的收入」给自己打分，得出「我不行」的错误结论——真实原因是没有把学习曲线算进去。',
    evidence: 'experience',
    verify: '把第 1 个月与第 3 个月的「时薪」做成两个数字记录：如果第 3 个月明显高于第 1 个月，说明在正常爬坡；如果两个月都在当地非全日制最低工资以下且不涨，再考虑换行。',
  },

  {
    id: 'median-vs-mean',
    category: 'data',
    title: '别用「平均」对照自己',
    detail:
      '行业「平均收入」与你的实际位置是两个概念：收入分布右偏，少数高收入者会把平均值拉高，相当比例的人处于中位数以下。官方与平台口径还常用「峰值月」「日均单量最高时段」，个人决策应该看自己流水的「中位数」与「淡季月」。',
    evidence: 'experience',
    verify: '把自己的 6 个月流水从低到高排序，取中间两个月做基准，而不是取最高月或别人的晒单。',
  },
  {
    id: 'rule-unilateral',
    category: 'data',
    title: '计价规则可被单方调整，你签的协议允许这一点',
    detail:
      '起步价、距离费、补贴系数、冲单奖门槛均属平台商业规则，平台可单方修订服务协议。政策层面 2021 年以来要求「算法取中」、畅通申诉，但调价与考核规则变更仍是骑手收入波动的主要外因。本工具里输入的计价参数只是「今天的规则」，不是承诺。',
    evidence: 'experience',
    verify: '每月对比一次 APP 计价规则页与上月截图；发现变化时，用自己的新流水重跑本工具再判断收入走向。',
  },
  {
    id: 'tool-baseline',
    category: 'data',
    title: '本工具自己的边界：第一层假设也可能不成立',
    detail:
      '计价参数（单价/距离费/补贴系数）无权威公开来源，当前用的是占位假设，必须替换为你 APP 内的实际计价；个税按年度汇算口径测算，与平台按月预扣的现金感受不同；社保与退休测算含假设收益率。结论的精度上限＝输入与参数的精度——所有结果在「依据」标签里都标了置信度，凡标「待核实/占位」的，不要对外引用。',
    evidence: 'experience',
    verify: '逐条打开界面上的「依据」标签，核对置信度；把「unverified」参数全部替换后再看结论。',
  },
]

export function realityFactsBy(ids: string[]): RealityFact[] {
  return ids
    .map(id => REALITY_FACTS.find(f => f.id === id))
    .filter((f): f is RealityFact => !!f)
}

export const REALITY_CATEGORY_ORDER: RealityCategory[] = ['income', 'rights', 'social', 'data']

/**
 * 广告口径换算：求解「要达到招聘广告标的月净收入，需要多少单量/工时」。
 * 保持当前「单量-工时」配比不变（同强度加量），工时上限 16h/天（人体可持续上限的粗界）。
 * 返回 null 表示在该强度界内不可达——广告数字另有来源（其他城市计价/未披露补贴期）。
 */
export interface AdClaimSolveInput {
  targetNetMonthly: number
  currentOrdersPerDay: number
  currentHoursPerDay: number
  /** 纯函数注入：给定单量与工时返回月净收入 */
  netAt: (ordersPerDay: number, hoursPerDay: number) => number
  maxOrdersPerDay?: number
  maxHoursPerDay?: number
}

export interface AdClaimSolveResult {
  ordersPerDay: number
  hoursPerDay: number
  intensityRatio: number
}

export function solveAdClaim(input: AdClaimSolveInput): AdClaimSolveResult | null {
  const { targetNetMonthly, currentOrdersPerDay, currentHoursPerDay, netAt } = input
  const maxOrders = input.maxOrdersPerDay ?? 120
  const maxHours = input.maxHoursPerDay ?? 16
  if (!(targetNetMonthly > 0) || !(currentOrdersPerDay > 0) || !(currentHoursPerDay > 0)) return null
  const hoursFor = (orders: number) => currentHoursPerDay * (orders / currentOrdersPerDay)
  const maxOrdersByHours = Math.floor(currentOrdersPerDay * (maxHours / currentHoursPerDay))
  const upper = Math.min(maxOrders, maxOrdersByHours)
  if (upper < 1) return null
  if (netAt(upper, hoursFor(upper)) < targetNetMonthly) return null
  let lo = 1
  let hi = upper
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (netAt(mid, hoursFor(mid)) >= targetNetMonthly) hi = mid
    else lo = mid + 1
  }
  return {
    ordersPerDay: lo,
    hoursPerDay: Math.round(hoursFor(lo) * 10) / 10,
    intensityRatio: Math.round((lo / currentOrdersPerDay) * 100) / 100,
  }
}
