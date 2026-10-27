/**
 * 应用接线回归测试（Wiring Tests）
 *
 * 为什么需要这类测试：
 * 697 个单元/对拍测试全绿时，应用依然可能是「启动不加载规则、导航点不动、
 * AI 助手没渲染」的死界面——因为这类缺陷位于模块之间的**接线**，不在任何
 * 单个模块内部。纯函数测试对此完全无感。
 *
 * 这里直接对源码与路由表做断言，把「接线」当成可测对象。
 * 任何断言失败都意味着应用在真实浏览器里不可用。
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8')

/**
 * 路由表以源码文本解析而非 import。
 * 原因：import src/app/router 会执行 createWebHistory()，在 node 环境下需要
 * window/dom；为此引入 jsdom 属于为一个测试增加运行时依赖，代价大于收益。
 * 这里校验的是「两份源码的契约是否一致」，正是接线回归要防的那类缺陷。
 */
function parseRoutes(src: string): Array<{ path: string; name?: string }> {
  // 路由表中具名路由的写法是 { path: '/x', name: 'X', component: ... }
  // 重定向路由没有 name，此处只取具名项（重定向目标由 path 断言覆盖）
  return [...src.matchAll(/path:\s*'([^']+)',\s*name:\s*'([^']+)'/g)].map(m => ({
    path: m[1],
    name: m[2],
  }))
}

const ROUTES = parseRoutes(read('src/app/router.ts')).filter(r => r.name)
const ROUTE_NAMES = ROUTES.map(r => r.name!)
const ROUTE_PATHS = ROUTES.map(r => r.path)

describe('启动加载：App.vue 必须挂载时加载本城规则', () => {
  const app = read('src/App.vue')

  it('App.vue 引入了 store', () => {
    expect(app).toMatch(/useMainStore/)
  })

  it('App.vue 的 onMounted 调用了 store.loadRule(store.work.city)', () => {
    // rule 为 null 时 scenarios/comparison 全空，界面会显示为「正常但全是零」
    expect(app).toMatch(/onMounted\s*\(/)
    expect(app).toMatch(/loadRule\s*\(\s*store\.work\.city\s*\)/)
  })
})

describe('导航接线：navItems 的 key 必须命中路由 name', () => {
  const layout = read('src/layouts/MainLayout.vue')

  // 提取 navItems 中的 { key: 'X', label: 'Y', path: '/Z' ... }
  const entries = [...layout.matchAll(/key:\s*'([^']+)'[^}]*?path:\s*'([^']+)'/g)].map(m => ({
    key: m[1],
    path: m[2],
  }))

  it('能从 MainLayout 中解析出 navItems', () => {
    expect(entries.length).toBeGreaterThan(0)
  })

  it('每个 navItem 的 key 都是已注册的路由 name', () => {
    const names = ROUTE_NAMES
    // onNav 用 router.push({ name: key })，key 不存在会静默失败
    for (const e of entries) {
      expect(names, `navItem key "${e.key}" 不是已注册路由名`).toContain(e.key)
    }
  })

  it('每个 navItem 的 path 都是已注册的路径', () => {
    const paths = ROUTE_PATHS
    for (const e of entries) {
      expect(paths, `navItem path "${e.path}" 不是已注册路径`).toContain(e.path)
    }
  })

  it('导航高亮可用：activeKey 比较的 route.name 能命中某个 key', () => {
    // activeKey = route.name as string，大小写不符会导致导航永远无高亮
    expect(layout).toMatch(/activeKey\s*=\s*computed\(\s*\(\)\s*=>\s*route\.name/)
    const keys = new Set(entries.map(e => e.key))
    const dashboard = ROUTES.find(r => r.path === '/dashboard')?.name
    expect(typeof dashboard === 'string' && keys.has(dashboard)).toBe(true)
  })

  it('首页重定向目标存在，且 logo 跳转用的是合法路由名', () => {
    expect(ROUTE_PATHS).toContain('/dashboard')
    expect(layout).not.toMatch(/router\.push\(\{\s*name:\s*'(?!Dashboard|Scenario|Planning|Rights|Policy)\w+'\s*\}\)/)
  })
})

describe('AI 助手接线', () => {
  const layout = read('src/layouts/MainLayout.vue')

  it('MainLayout 渲染了 ChatAssistant 组件', () => {
    expect(layout).toMatch(/<ChatAssistant\b/)
    expect(layout).toMatch(/import ChatAssistant from/)
  })

  it('不存在未被渲染的重复触发器', () => {
    // ChatAssistant 自带悬浮按钮，额外的 Trigger 只会产生两个 FAB 且无人监听 open 事件
    expect(layout).not.toMatch(/ChatAssistantTrigger/)
  })

  it('子组件 emit 的事件必须至少被一处父组件监听', () => {
    // 原实现匹配 `*Trigger` 组件名——全仓没有任何此类组件，triggers 恒为空，
    // 该测试永远通过（空转）。改为检查真实组件的 defineEmits 是否有人监听。
    const dirFiles: string[] = []
    const walk = (p: string) => {
      for (const e of readdirSync(p, { withFileTypes: true })) {
        const full = p + '/' + e.name
        if (e.isDirectory()) walk(full)
        else if (e.name.endsWith('.vue')) dirFiles.push(full)
      }
    }
    walk('src/components')
    walk('src/layouts')
    const allSources = dirFiles.map(f => ({ file: f, src: read(f) }))

    const unlistened: string[] = []
    for (const { file, src } of allSources) {
      const emitMatch = src.match(/defineEmits<\{([^}]+)\}>/)
      if (!emitMatch) continue
      const events = [...emitMatch[1].matchAll(/(\w+)\s*:\s*\[/g)].map(m => m[1])
      const componentName = file.split('/').pop()?.replace('.vue', '') ?? ''
      if (!componentName || events.length === 0) continue

      const usedSomewhere = allSources.some(other => {
        if (other.file === file) return false
        if (!new RegExp('<' + componentName + '\\b').test(other.src)) return false
        return events.some(ev => {
          const kebab = ev.replace(/([A-Z])/g, '-$1').toLowerCase()
          return new RegExp('@' + ev + '\\b').test(other.src) || new RegExp('@' + kebab + '\\b').test(other.src)
        })
      })
      if (!usedSomewhere) unlistened.push(`${file}: emits ${events.join(',')} 但无父组件监听`)
    }
    expect(unlistened, unlistened.join('\n')).toEqual([])
  })
})

describe('naive-ui Provider 唯一性', () => {
  const app = read('src/App.vue')
  const layout = read('src/layouts/MainLayout.vue')

  it('只有 App.vue 提供 n-message-provider', () => {
    expect(app).toMatch(/<n-message-provider>/)
    // 嵌套两层会让 useMessage() 归属不确定
    expect(layout).not.toMatch(/<n-message-provider/)
  })
})

describe('localStorage 写入异常保护', () => {
  it('主题持久化（store.toggleTheme）中的 setItem 在 try/catch 内', () => {
    const store = read('src/stores/main.ts')
    const guarded = /try\s*\{[^}]*localStorage\.setItem[^}]*\}\s*catch/
    expect(guarded.test(store)).toBe(true)
  })
})

describe('移动端参数栏可达', () => {
  const layout = read('src/layouts/MainLayout.vue')

  it('mobileSidebarOpen 存在且被模板绑定', () => {
    expect(layout).toMatch(/mobileSidebarOpen/)
    // 必须有地方把它置为 true，否则抽屉永远打不开
    expect(layout).toMatch(/mobileSidebarOpen\.value\s*=\s*!mobileSidebarOpen\.value/)
  })

  it('提供移动端菜单按钮', () => {
    expect(layout).toMatch(/mobile-menu-btn/)
    expect(layout).toMatch(/toggleMobileSidebar/)
  })

  it('移动端抽屉由独立 class 驱动，而非复用 collapsed', () => {
    expect(layout).toMatch(/\.sidebar\.mobile-open/)
    expect(layout).not.toMatch(/\.sidebar:not\(\.collapsed\)\s*\{[^}]*translateX\(0\)/)
  })
})