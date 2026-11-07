import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * 规则快照/回滚工具的行为测试：在系统临时目录里搭一个最小仓库形态
 * （public/rules/*.json），通过 NOMONEY_RULES_ROOT 覆盖根目录实跑 CLI，
 * 断言快照、漂移检测与回滚的真实退出码与文件内容。
 *
 * 注意：seedRules 的键是城市名，会自动补 .json 后缀——此前直接拿键当文件名，
 * 写出无后缀文件，脚本按 *.json 过滤后为空，曾导致整组测试假失败。
 */
const SCRIPT = join(__dirname, '..', 'scripts', 'rules-snapshot.mjs')

let root: string

function seedRules(files: Record<string, string>) {
  mkdirSync(join(root, 'public', 'rules'), { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    const file = name.endsWith('.json') ? name : `${name}.json`
    writeFileSync(join(root, 'public', 'rules', file), content)
  }
}

function run(args: string[]): { status: number; out: string } {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args], {
      env: { ...process.env, NOMONEY_RULES_ROOT: root },
      encoding: 'utf8',
    })
    return { status: 0, out }
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string }
    return { status: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'rules-snap-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('规则数据快照与回滚', () => {
  it('snapshot 生成 manifest 与 latest 指针，verify 在无漂移时通过', () => {
    seedRules({ guangzhou: '{"city":"guangzhou"}', shenzhen: '{"city":"shenzhen"}' })
    const snap = run(['snapshot'])
    expect(snap.status, snap.out).toBe(0)
    expect(snap.out).toContain('2 个规则文件')

    const latest = JSON.parse(readFileSync(join(root, '.rules-snapshots', 'latest.json'), 'utf8')) as { count: number }
    expect(latest.count).toBe(2)

    const verify = run(['verify'])
    expect(verify.status, verify.out).toBe(0)
    expect(verify.out).toContain('与快照一致')
  })

  it('verify 能发现改动/缺失/新增三类漂移并返回非零', () => {
    seedRules({ guangzhou: '{"a":1}', shenzhen: '{"b":2}', beijing: '{"c":3}' })
    const snap = run(['snapshot'])
    expect(snap.status, snap.out).toBe(0)

    writeFileSync(join(root, 'public', 'rules', 'guangzhou.json'), '{"a":999}')
    rmSync(join(root, 'public', 'rules', 'shenzhen.json'))
    writeFileSync(join(root, 'public', 'rules', 'tianjin.json'), '{"d":4}')

    const verify = run(['verify'])
    expect(verify.status).not.toBe(0)
    expect(verify.out).toContain('CHANGED  guangzhou.json')
    expect(verify.out).toContain('MISSING  shenzhen.json')
    expect(verify.out).toContain('ADDED    tianjin.json')
  })

  it('rollback 单城恢复改动文件，未确认时拒绝执行', () => {
    seedRules({ guangzhou: '{"base":100}' })
    const snap = run(['snapshot'])
    expect(snap.status, snap.out).toBe(0)
    writeFileSync(join(root, 'public', 'rules', 'guangzhou.json'), '{"base":999}')

    // 未加 --yes 必须拒绝：回滚是覆盖性操作
    const refused = run(['rollback', 'guangzhou'])
    expect(refused.status).not.toBe(0)
    expect(refused.out).toContain('--yes')
    expect(readFileSync(join(root, 'public', 'rules', 'guangzhou.json'), 'utf8')).toBe('{"base":999}')

    const done = run(['rollback', 'guangzhou', '--yes'])
    expect(done.status, done.out).toBe(0)
    expect(done.out).toContain('RESTORED guangzhou.json')
    expect(readFileSync(join(root, 'public', 'rules', 'guangzhou.json'), 'utf8')).toBe('{"base":100}')
  })

  it('rollback all 跳过与快照一致的文件，快照中没有的城报错', () => {
    seedRules({ guangzhou: '{"v":1}', shenzhen: '{"v":2}' })
    const snap = run(['snapshot'])
    expect(snap.status, snap.out).toBe(0)
    writeFileSync(join(root, 'public', 'rules', 'guangzhou.json'), '{"v":42}')

    const done = run(['rollback', 'all', '--yes'])
    expect(done.status, done.out).toBe(0)
    expect(done.out).toContain('RESTORED guangzhou.json')
    expect(done.out).toContain('跳过')
    expect(readFileSync(join(root, 'public', 'rules', 'shenzhen.json'), 'utf8')).toBe('{"v":2}')

    const unknown = run(['rollback', 'hangzhou', '--yes'])
    expect(unknown.status).not.toBe(0)
    expect(unknown.out).toContain('快照中没有该城')
  })
})
