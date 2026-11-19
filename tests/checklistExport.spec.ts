import { describe, expect, it } from 'vitest'
import type { RightsItem } from '../src/data/rights/catalog'
import { buildChecklistHtml, buildChecklistText } from '../src/utils/checklistExport'

const saved: RightsItem = {
  id: 'right-test-a',
  category: 'social',
  intent: 'do',
  audience: ['all'],
  title: '测试待办：社保卡激活',
  oneLiner: '带身份证去银行网点激活金融账户。',
  whatToDo: ['带身份证'],
  whatToGet: ['能收养老金'],
  whereToGo: '社保卡服务银行 / 12333',
  officialUrl: 'https://si.12333.gov.cn/',
  deadline: '入职后尽快',
  confidence: 'official',
  level: 'L1',
  lastVerified: '2026-11-19',
  sourceTitle: '国家社会保险公共服务平台',
  priority: 200,
}

const doneItem: RightsItem = {
  ...saved,
  id: 'right-test-b',
  title: '测试已办：医保备案',
  oneLiner: '已在本机标记为办完。',
}

function makeDone(ids: string[]) {
  return (id: string) => ids.includes(id)
}

describe('清单导出/打印', () => {
  it('纯文本包含标题、状态、时限和官方入口，不带敏感字段', () => {
    const text = buildChecklistText([saved, doneItem], makeDone(['right-test-b']), '2026-11-19')
    expect(text).toContain('没钱 No Money · 我的办事清单')
    expect(text).toContain('[待办] 测试待办：社保卡激活')
    expect(text).toContain('[已办] 测试已办：医保备案')
    expect(text).toContain('时限：入职后尽快')
    expect(text).toContain('https://si.12333.gov.cn/')
    expect(text).not.toMatch(/身份证号|银行卡号|手机号|工资\s*¥/)
  })

  it('空清单给出下一步，而不是空白文件', () => {
    const text = buildChecklistText([], makeDone([]), '2026-11-19')
    expect(text).toContain('清单为空')
    expect(text).toContain('加入清单')
  })

  it('打印页对标题做 HTML 转义，不执行用户内容', () => {
    const html = buildChecklistHtml(
      [{ ...saved, title: '<script>alert(1)</script>', oneLiner: 'A & B', whereToGo: '"窗口"' }],
      makeDone([]),
      '2026-11-19',
    )
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('A &amp; B')
    expect(html).toContain('&quot;窗口&quot;')
    expect(html).toContain('@media print')
  })

  it('打印页含已办/待办状态和免责声明', () => {
    const html = buildChecklistHtml([saved], makeDone([]), '2026-11-19')
    expect(html).toContain('待办')
    expect(html).toContain('本平台不代办、不代缴')
  })
})
