import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * 架构边界门禁。
 *
 * 这不是「源码文本契约」的滥用：分层/入口/旧引擎允许清单是无法通过挂载组件
 * 验证的结构约束，必须在静态层面守住。测试只检查 import 路径与少数 I/O 标识，
 * 不检查样式、文案或布局。
 */
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'src')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (/\.(ts|vue)$/.test(name)) out.push(full)
  }
  return out
}

function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8')
  return [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
}

function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')
}

function rel(file: string): string {
  return relative(ROOT, file).replace(/\\/g, '/')
}

const FORBIDDEN_IN_DOMAIN = [
  /^vue$/,
  /^pinia$/,
  /^@vue\//,
  /(^|\/)stores\//,
  /(^|\/)components\//,
  /(^|\/)views\//,
  /(^|\/)engine\//,
]

const FORBIDDEN_IN_APPLICATION = [
  /^vue$/,
  /^pinia$/,
  /^@vue\//,
  /(^|\/)stores\//,
  /(^|\/)components\//,
  /(^|\/)views\//,
  /(^|\/)engine\//,
]

const FORBIDDEN_IN_KERNEL = [
  /^vue$/,
  /^pinia$/,
  /^@vue\//,
  /(^|\/)stores\//,
  /(^|\/)components\//,
  /(^|\/)views\//,
  /(^|\/)engine\//,
]

const ENGINE_ALLOWLIST = new Set([
  'src/components/panels/TaxOptimizer.vue',
  'src/components/panels/RetirementPlanner.vue',
  'src/utils/pensionSeries.ts',
])

describe('architecture boundaries', () => {
  it('domain is framework-free and does not reach upward', () => {
    const offenders: string[] = []
    for (const file of walk(join(SRC, 'domain'))) {
      const badImports = importsOf(file).filter((p) => FORBIDDEN_IN_DOMAIN.some((re) => re.test(p)))
      const code = codeOf(file)
      const badIo = ['localStorage', 'sessionStorage', 'XMLHttpRequest', 'fetch(']
        .filter((token) => code.includes(token))
        .map((token) => `uses ${token}`)
      if (badImports.length || badIo.length) {
        offenders.push(`${rel(file)}: ${[...badImports, ...badIo].join(', ')}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('application orchestrates without UI, stores or legacy engines', () => {
    const offenders: string[] = []
    for (const file of walk(join(SRC, 'application'))) {
      const badImports = importsOf(file).filter((p) => FORBIDDEN_IN_APPLICATION.some((re) => re.test(p)))
      if (badImports.length) offenders.push(`${rel(file)}: ${badImports.join(', ')}`)
    }
    expect(offenders).toEqual([])
  })

  it('kernel stays a thin contract without UI, stores or legacy engines', () => {
    const offenders: string[] = []
    for (const file of walk(join(SRC, 'kernel'))) {
      const badImports = importsOf(file).filter((p) => FORBIDDEN_IN_KERNEL.some((re) => re.test(p)))
      if (badImports.length) offenders.push(`${rel(file)}: ${badImports.join(', ')}`)
    }
    expect(offenders).toEqual([])
  })

  it('CLI / API / MCP enter through the kernel, never through domain or application', () => {
    const offenders: string[] = []
    for (const dir of ['cli', 'mcp', 'server']) {
      for (const file of walk(join(ROOT, dir))) {
        const bad = importsOf(file).filter((p) => /(^|\/)(domain|application)\//.test(p))
        if (bad.length) offenders.push(`${rel(file)}: ${bad.join(', ')}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('only allowlisted production files import the legacy engine', () => {
    const offenders: string[] = []
    for (const file of walk(SRC)) {
      if (rel(file).startsWith('src/engine/')) continue
      const bad = importsOf(file).filter((p) => /(^|\/)engine\//.test(p))
      if (bad.length && !ENGINE_ALLOWLIST.has(rel(file))) {
        offenders.push(`${rel(file)}: ${bad.join(', ')}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
