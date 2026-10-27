/**
 * 体验欠债回归（UX Debt Regression）
 *
 * 这些缺陷的共同点：功能"都在"，但接线错了——数字算得对，用户却会误读。
 * 纯函数测试对它们完全无感，因此这里直接断言源码契约（与 app-wiring.spec.ts 同一思路）。
 *
 * 覆盖：
 *   1. 未知路径必须显式 404，不得静默重定向（否则用户以为地址是对的）
 *   2. 页签必须与 URL 双向同步（否则复制地址/返回键无法复现当前页签）
 *   3. 占位数据下「最优/推荐」必须降级为「假设」
 *   4. 文书必须把"可直接主张"与"条件项"分开，不得合成一个总额
 *   5. localStorage 写入失败必须可见，不得静默吞掉
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8')

describe('路由契约', () => {
  const router = read('src/app/router.ts')

  it('未知路径指向 NotFound 组件而不是重定向到 dashboard', () => {
    expect(router, '通配路由必须渲染 404 页').toMatch(/pathMatch\(\.\*\)\*'[\s\S]{0,120}NotFound/)
    expect(router, '不得再用 redirect 吞掉未知路径').not.toMatch(/pathMatch\(\.\*\)\*',\s*redirect/)
  })

  it('404 页面存在且提供返回出口', () => {
    const view = read('src/views/NotFoundView.vue')
    expect(view).toMatch(/status="404"/)
    expect(view, '404 页必须能回到总览').toMatch(/push\('\/dashboard'\)/)
  })
})

describe('页签与 URL 双向同步', () => {
  for (const [file, names] of [
    ['src/views/PolicyView.vue', 'TAB_NAMES'],
    ['src/views/PlanningView.vue', 'TAB_NAMES'],
  ] as const) {
    it(`${file} 读取 query 且切换时写回`, () => {
      const src = read(file)
      expect(src, '必须定义页签名白名单').toContain(names)
      expect(src, '必须从 route.query 读初始页签').toMatch(/route\.query\.tab/)
      expect(src, '切换页签必须写回 URL（replace 避免历史污染）').toMatch(/router\.replace\(/)
    })
  }

  it('PolicyView 的 tab 是 computed 双向绑定，不是一次性 ref', () => {
    const src = read('src/views/PolicyView.vue')
    expect(src, 'tab 必须是可写 computed，否则 URL 与页签会脱钩').toMatch(/const tab = computed\(\{[\s\S]{0,400}set:/)
  })
})

describe('占位数据门禁的 UI 落实', () => {
  it('首页把「推荐」降级为「假设」并给出未核实字段', () => {
    const src = read('src/views/DashboardView.vue')
    expect(src).toMatch(/dataQuality/)
    expect(src, 'provisional 时评级不得显示为「推荐」').toMatch(/provisional\.value \? '假设'/)
    expect(src, '必须列出未核实字段').toMatch(/unverifiedFields/)
  })

  it('方案对比页的「最优」在占位数据下降级为「假设最优」', () => {
    const src = read('src/components/panels/ScenarioCompare.vue')
    expect(src).toMatch(/provisional \? '假设最优' : '最优'/)
  })
})

describe('文书：城市联动与金额分章', () => {
  const src = read('src/components/panels/DocumentGenerator.vue')

  it('城市选项来自全国城市注册表，不再写死 6 城', () => {
    expect(src, '必须引用 CITY_OPTIONS').toMatch(/CITY_OPTIONS/)
    expect(src, '不得内联写死城市数组').not.toMatch(/label: '佛山', value: '佛山市'/)
  })

  it('文书城市默认取当前测算城市，不一致时有提示', () => {
    expect(src).toMatch(/store\.rule \? `\$\{store\.rule\.cityName\}市`/)
    expect(src, '城市不一致必须提示重新测算').toMatch(/cityMismatch/)
  })

  it('可直接主张与条件项分开列示，不合成单一总额', () => {
    expect(src, 'claim 与 conditional 必须分章').toMatch(/condItems\.value\.length/)
    expect(src).toMatch(/可直接主张金额合计/)
    expect(src).toMatch(/条件项合计/)
    expect(src, '不得再把两类合成 requestTotal 作为请求总额').not.toMatch(/requestTotal/)
  })
})

describe('本地存储失败可见', () => {
  it('store 在写入失败时记录原因而不是静默吞掉', () => {
    const src = read('src/stores/main.ts')
    expect(src).toMatch(/persistError/)
    expect(src, '必须区分配额不足与隐私模式').toMatch(/QuotaExceededError/)
  })

  it('侧栏展示保存失败与切城重置提示', () => {
    const src = read('src/components/ParamSidebar.vue')
    expect(src).toMatch(/store\.persistError/)
    expect(src).toMatch(/store\.cityNotice/)
  })
})

describe('退休页的数字必须反映用户选择', () => {
  const src = read('src/components/panels/RetirementPlanner.vue')

  it('首屏与年限对比表都用「用户自选基数优先」，不是恒取下限', () => {
    expect(src, '必须有统一的有效基数计算').toMatch(/effectivePensionBase/)
    // 不得再出现「const base = store.rule?.benefit.pension.baseMin」这类恒定取值
    expect(src, '不应再直接按下限取基数').not.toMatch(/const base = store\.rule\?\.benefit\.pension\.baseMin/)
    expect(src, '年限对比表也要用有效基数').toMatch(/const base = effectivePensionBase\.value/)
  })

  it('未参保时必须声明这是推演而非已有权益', () => {
    expect(src).toMatch(/不是已有权益/)
    expect(src, '必须提示不含历史缴费').toMatch(/不含你过去任何已缴年限/)
  })

  it('档次与年限对比都要传该基数对应的缴费指数', () => {
    expect(src).toMatch(/socialAverageWage/)
    expect(src, '年限对比表必须传 paymentIndex').toMatch(/annualReturnVal, paymentIndex\)/)
  })
})

describe('退休年龄跨字段约束', () => {
  const src = read('src/stores/main.ts')

  it('store 在运行期与初始化时都保证 retireAge > currentAge', () => {
    // 运行期：同步 watcher（异步 flush 会让 UI 先闪一帧空测算）
    expect(src).toMatch(/flush: 'sync'/)
    // 初始化：hydrate 之后立刻修正，watcher 不在赋初值时触发
    expect(src, '恢复矛盾年龄也必须修正').toMatch(/expectedRetireAge <= personal\.value\.currentAge/)
  })
})

describe('政策页不得把广东政策当成全国通用', () => {
  const src = read('src/views/PolicyView.vue')

  it('省级页签标题跟随当前城市，非广东时明示不适用', () => {
    expect(src).toMatch(/provinceTabLabel/)
    expect(src).toMatch(/CITY_REGISTRY/)
    expect(src, '非广东必须有提示').toMatch(/不能直接套用/)
    expect(src, '不得写死页签名').not.toMatch(/tab="广东省 \/ 广州"/)
  })
})

describe('AI 流式响应不得静默失败', () => {
  const src = read('src/composables/useAIChat.ts')

  it('服务端错误与空响应必须报出来，不留在空气泡里', () => {
    expect(src, '必须识别流内错误').toMatch(/obj\?\.error/)
    expect(src, '空内容必须抛出可诊断错误').toMatch(/模型未返回任何内容/)
    expect(src, '非标准 SSE 要给出样本计数').toMatch(/malformed/)
  })

  it('清理流式消息按 id 精确定位，不用 isStreaming 找第一条', () => {
    expect(src).toMatch(/const idx = aiId \? messages\.value\.findIndex\(m => m\.id === aiId\) : -1/)
    expect(src, '不得再按 isStreaming 定位待清理消息').not.toMatch(/findIndex\(m => m\.isStreaming\)\n\s*if \(idx >= 0\) \{\n\s*messages\.value\[idx\]\.isStreaming = false/)
  })
})

describe('补偿计算：示例金额不得被当成已确认主张', () => {
  const src = read('src/components/panels/RightsCompensation.vue')

  it('切场景必须复位确认状态，否则新场景默认金额会进文书', () => {
    expect(src).toMatch(/function selectScene/)
    expect(src).toMatch(/userTouched\.value = false/)
    expect(src, '场景卡片必须走 selectScene').toMatch(/@click="selectScene\(s\.id\)"/)
  })

  it('重置回默认值后不得仍算作已确认', () => {
    expect(src).toMatch(/重置回示例值后同样不能算作/)
  })

  it('首屏示例结果必须有标识，不能伪装成用户的可主张金额', () => {
    expect(src).toMatch(/isExample/)
    expect(src).toMatch(/示例可直接主张合计/)
  })
})
