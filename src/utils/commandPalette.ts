/**
 * 命令面板的动作注册表与模糊匹配。
 *
 * 为什么单独一个模块：
 * 命令面板本身是 UI，但「有哪些命令」「怎么匹配」是可单测的纯逻辑。
 * 把匹配算法放在这里，就能在 node 环境里验证排序是否正确，
 * 不用启动浏览器（E2E 只验证面板能开、键盘能选）。
 */

export type CommandKind = 'navigate' | 'city' | 'action'

export interface Command {
  id: string
  /** 展示名 */
  label: string
  /** 补充说明，例如「切换到该城市」 */
  hint?: string
  kind: CommandKind
  /** 额外可被搜索的关键词（拼音首字母、别名等） */
  keywords?: string[]
  /** 分组标题，面板按它分栏 */
  group: string
  run: () => void
}

export interface ScoredCommand {
  command: Command
  score: number
  /** 命中字符在 label 中的位置，用于高亮 */
  matches: number[]
}

/**
 * 子序列模糊匹配 + 位置加权。
 *
 * 打分规则（分数越高越靠前）：
 *   - 连续命中加分：`"广"` 匹配到 `"广州"` 的第二个字，比散落命中更相关
 *   - 起始位置命中加分：命令开头就匹配，比中间匹配更可能是用户想要的
 *   - 前缀命中额外加分
 *
 * 不做拼音转换：那需要一张几万字的映射表，对 40 条命令而言收益抵不过体积。
 * 城市名直接用中文匹配，用户输入中文即可。
 */
export function scoreCommand(query: string, command: Command): ScoredCommand | null {
  const q = query.trim().toLowerCase()
  if (!q) return { command, score: 0, matches: [] }

  const haystack = [command.label, ...(command.keywords ?? [])]
  let best: ScoredCommand | null = null

  for (const text of haystack) {
    const lower = text.toLowerCase()
    const matches: number[] = []
    let pos = 0
    let score = 0
    let lastMatch = -2

    for (const ch of q) {
      const found = lower.indexOf(ch, pos)
      if (found === -1) {
        matches.length = 0
        score = 0
        break
      }
      matches.push(found)
      // 连续命中（与上一个命中相邻）给更高权重
      score += found === lastMatch + 1 ? 8 : 3
      // 命中在开头额外加权
      if (found === 0) score += 12
      lastMatch = found
      pos = found + 1
    }

    if (!matches.length) continue

    // 前缀命中再补一刀，让「总览」排在「前往权益护航」前面
    if (lower.startsWith(q)) score += 20
    // 短标签优先：同样的匹配度下，名字短的更可能是目标
    score += Math.max(0, 12 - Math.floor(lower.length / 4))

    if (!best || score > best.score) best = { command, score, matches }
  }

  return best
}

/** 按分数降序，分数相同保持注册顺序（稳定排序，避免每次输入顺序乱跳） */
export function rankCommands(query: string, commands: Command[]): ScoredCommand[] {
  if (!query.trim()) return commands.map((command) => ({ command, score: 0, matches: [] }))

  const scored: ScoredCommand[] = []
  for (const command of commands) {
    const result = scoreCommand(query, command)
    if (result) scored.push(result)
  }

  return scored.sort((a, b) => b.score - a.score)
}

/** 面板里按 group 分组显示，组内保持排序结果 */
export function groupCommands(items: ScoredCommand[]): Array<{ group: string; items: ScoredCommand[] }> {
  const order: string[] = []
  const buckets = new Map<string, ScoredCommand[]>()

  for (const item of items) {
    const g = item.command.group
    if (!buckets.has(g)) {
      buckets.set(g, [])
      order.push(g)
    }
    buckets.get(g)!.push(item)
  }

  return order.map((group) => ({ group, items: buckets.get(group)! }))
}
