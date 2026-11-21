/**
 * Node 侧入口（CLI / HTTP API / MCP）共用的规则读取工具。
 *
 * 三个入口此前各自实现 `nodeRuleLoader`、`listCities`，连「未收录城市」
 * 的错误文案与排序都各写一份；任何一处加了规则校验，另两处就会悄悄绕过。
 * 这里只做两件事：从 public/rules 读 JSON、列城市元数据。
 * 校验仍由调用方决定（Web 走 parseCityRule，入口层依赖内核的 calculate 校验）。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { CityRule } from '../types'
import type { RuleLoader } from './calculate'

export function readPackageVersion(rootDir: string): string {
  return (JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')) as { version: string }).version
}

export interface CityMeta {
  id: string
  name: string
  year: number
  verified: boolean
}

/** 规则目录下的 JSON 文件即城市清单；排序保证 CLI/API/MCP 输出一致 */
export function listRuleCities(rulesDir: string): CityMeta[] {
  if (!existsSync(rulesDir)) throw new Error(`规则目录不存在：${rulesDir}`)
  return readdirSync(rulesDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(join(rulesDir, file), 'utf8')) as CityRule)
    .map((rule) => ({
      id: rule.city,
      name: rule.cityName,
      year: rule.year,
      verified: rule.verified,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * 读本地规则文件；未收录时给出可用城市，避免调用方只拿到一个孤零零的 id。
 */
export function createNodeRuleLoader(rulesDir: string): RuleLoader {
  return async (city: string) => {
    const file = join(rulesDir, `${city}.json`)
    if (!existsSync(file)) {
      const available = readdirSync(rulesDir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => name.replace('.json', ''))
      throw new Error(
        `未收录城市「${city}」。可用城市：${available.slice(0, 10).join(', ')} 等 ${available.length} 个`,
      )
    }
    return JSON.parse(readFileSync(file, 'utf8')) as CityRule
  }
}
