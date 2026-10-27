/**
 * 测试共享辅助：加载 public/rules 下的城市规则文件。
 *
 * 抽出的原因：cities / dataQuality / pensionSeries 三个 spec 各写了一遍
 * readdirSync + JSON.parse。规则目录结构调整时（如本轮从 15 城扩到 34 城）
 * 要改三处，容易漏改导致测试口径不一致。
 */

import { readFileSync, readdirSync } from 'node:fs'
import type { CityRule } from '../../src/types'

export const RULES_DIR = 'public/rules'

/** 所有规则文件名（如 guangzhou.json），顺序稳定 */
export function listRuleFiles(): string[] {
  return readdirSync(RULES_DIR).filter(f => f.endsWith('.json')).sort()
}

/** 按文件名读取单个规则 */
export function loadRuleFile(filename: string): CityRule {
  return JSON.parse(readFileSync(`${RULES_DIR}/${filename}`, 'utf8')) as CityRule
}

/** 读取全部规则，按 city id 建索引 */
export function loadAllRules(): Record<string, CityRule> {
  return Object.fromEntries(listRuleFiles().map(f => {
    const rule = loadRuleFile(f)
    return [rule.city, rule]
  }))
}

/** 读取全部规则为数组（顺序稳定，便于快照式断言） */
export function loadAllRulesArray(): CityRule[] {
  return listRuleFiles().map(loadRuleFile)
}
