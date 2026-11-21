/**
 * 民生手册测试
 *
 * 1. 数据纪律：每条必须有问题、一句结论、至少一条官方原文链接；链接必须是 http(s) 全地址，
 *    禁止空标题——避免"文号没有链接可点"回到用户抱怨的旧状态。
 * 2. 内容实体：每条至少有要点/数字/步骤之一，不能只有标题。
 * 3. 接线：<GuideCard 使用者必须 import；跨页深链 ?tab=xxx 必须在 PolicyView 页签白名单里。
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import {
  GUIDE_ITEMS,
  GUIDE_GROUP_ORDER,
  GUIDE_GROUP_LABELS,
} from '../src/utils/livingGuide'

const read = (p: string) => readFileSync(p, 'utf8')

function walkVue(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${e.name}`
    if (e.isDirectory()) out.push(...walkVue(full))
    else if (e.name.endsWith('.vue')) out.push(full)
  }
  return out
}

const VUE_FILES = [...walkVue('src/components'), ...walkVue('src/views'), ...walkVue('src/layouts')]

describe('民生手册数据纪律', () => {
  it('id 唯一，问题与一句话结论非空', () => {
    const ids = GUIDE_ITEMS.map(i => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const i of GUIDE_ITEMS) {
      expect(i.question.length, `${i.id} 缺问题`).toBeGreaterThan(0)
      expect(i.oneLiner.length, `${i.id} 缺一句话结论`).toBeGreaterThan(10)
    }
  })

  it('每条至少 1 条官方原文链接，且必须是 http(s) 完整地址、标题非空', () => {
    for (const i of GUIDE_ITEMS) {
      expect(i.links.length, `${i.id} 没有原文链接`).toBeGreaterThan(0)
      for (const l of i.links) {
        expect(l.title.length, `${i.id} 的链接缺标题`).toBeGreaterThan(0)
        expect(l.url, `${i.id} 的链接不是 http(s) 全地址: ${l.url}`).toMatch(/^https?:\/\/[^\s]+$/)
      }
    }
  })

  it('每条至少有要点 / 关键数字 / 步骤之一（不能只有标题）', () => {
    for (const i of GUIDE_ITEMS) {
      const substance = (i.keyPoints?.length ?? 0) + (i.numbers?.length ?? 0) + (i.steps?.length ?? 0)
      expect(substance, `${i.id} 没有任何实质内容`).toBeGreaterThan(0)
    }
  })

  it('数字条目的 label/value 非空', () => {
    for (const i of GUIDE_ITEMS) {
      for (const n of i.numbers ?? []) {
        expect(n.label.length, `${i.id} 数字缺标签`).toBeGreaterThan(0)
        expect(n.value.length, `${i.id} 数字缺取值`).toBeGreaterThan(0)
      }
    }
  })

  it('分组标签齐全，且每个分组至少有一条', () => {
    for (const g of GUIDE_GROUP_ORDER) {
      expect(GUIDE_GROUP_LABELS[g], `分组 ${g} 缺标签`).toBeTruthy()
      expect(GUIDE_ITEMS.filter(i => i.group === g).length, `分组 ${g} 没有条目`).toBeGreaterThan(0)
    }
  })
})

describe('民生手册接线', () => {
  it('用了 <GuideCard 的文件必须 import 它', () => {
    for (const file of VUE_FILES) {
      const src = read(file)
      if (!/<GuideCard\b/.test(src)) continue
      expect(src, `${file} 用了 <GuideCard> 但没有 import`).toMatch(/import\s+GuideCard\s+from/)
    }
  })

  it('PolicyView 只渲染手册独有正文，其余改入口', () => {
    const policy = read('src/views/PolicyView.vue')
    expect(policy).toMatch(/splitManualGuides/)
    expect(policy).toMatch(/manualLinks/)
    expect(policy).toMatch(/manualFull/)
    expect(policy).not.toMatch(/GUIDE_ITEMS/)
    expect(policy).not.toMatch(/GUIDE_GROUP_ORDER/)
  })

  it('RightsItemCard 对指南条目复用 GuideCard，不再手写第二套详情', () => {
    const card = read('src/components/RightsItemCard.vue')
    expect(card, '必须 import GuideCard').toMatch(/import GuideCard from '\.\/GuideCard\.vue'/)
    expect(card, '展开详情必须渲染 GuideCard').toMatch(/<GuideCard/)
    expect(card, '必须按 guideId 找回手册正文').toMatch(/guideId/)
  })

  it('跨页深链 ?tab=xxx 的值必须在 PolicyView 页签白名单里', () => {
    const policy = read('src/views/PolicyView.vue')
    const whitelistMatch = policy.match(/TAB_NAMES\s*=\s*\[([^\]]*)\]/)
    expect(whitelistMatch).toBeTruthy()
    const whitelist = [...whitelistMatch![1].matchAll(/'([^']+)'/g)].map(m => m[1])
    expect(whitelist.length).toBeGreaterThan(0)
    for (const file of VUE_FILES) {
      const src = read(file)
      for (const m of src.matchAll(/query:\s*\{\s*tab:\s*'([^']+)'\s*\}/g)) {
        expect(whitelist, `${file} 深链 tab=${m[1]} 不在 PolicyView 白名单里`).toContain(m[1])
      }
    }
  })
})
