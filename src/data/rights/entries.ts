/**
 * 四个办事入口的唯一定义。
 *
 * /start 的四个页签从这里取标题、序号和描述；
 * 页面不要再内联一份，否则文案和跳转参数迟早漂移。
 */
export type RightsEntryKey = 'tasks' | 'benefits' | 'social' | 'trouble'

export interface RightsEntry {
  key: RightsEntryKey
  index: string
  title: string
  desc: string
}

export const RIGHTS_ENTRIES: RightsEntry[] = [
  {
    key: 'tasks',
    index: '01',
    title: '我该做什么',
    desc: '刚入职、换工作、参保前，先列一张该办的清单。',
  },
  {
    key: 'benefits',
    index: '02',
    title: '我能拿什么',
    desc: '补贴、津贴、公积金、生育、失业金，一条条对照。',
  },
  {
    key: 'social',
    index: '03',
    title: '社保医保怎么办',
    desc: '参保、断缴、转移、异地就医，给教程和官方入口。',
  },
  {
    key: 'trouble',
    index: '04',
    title: '遇到麻烦怎么办',
    desc: '欠薪、辞退、工伤，先取证，再走监察/仲裁。',
  },
]
