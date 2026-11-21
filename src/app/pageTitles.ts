/**
 * 页面标题的唯一来源。
 *
 * router 的 meta.title（浏览器标签 / 历史记录）与 PageHeading 的 sr-only h1
 * 必须永远一致；两边各写一份中文字面量，改一处漏一处时用户看到的就是
 * 「标签页说 A、页面标题说 B」。这里只保留一份，路由与页面标题都从这里取。
 */
export const PAGE_TITLES = {
  start: '办事入口 — 该做什么、能拿什么、去哪办',
  dashboard: '总览 — 月净收入与权益评分',
  employee: '企业职工 — 工资条算到手',
  scenario: '方案对比与收支明细',
  planning: '税务优化与养老规划',
  rights: '权益护航 — 补偿计算与文书',
  guides: '怎么弄 — 办事教程、材料与官方入口',
  policy: '政策百科与民生手册',
  admin: '数据管理后台',
  audit: '数据核验对账',
  notfound: '页面不存在',
} as const

export type PageKey = keyof typeof PAGE_TITLES
