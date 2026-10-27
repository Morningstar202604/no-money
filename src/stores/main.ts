import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { CityRule, WorkParams, CostParams, PersonalParams, ScenarioResult, CompensationResult } from '../types'
import { ScenarioService } from '../application/scenario/ScenarioService'
import type { ScenarioInput } from '../application/scenario/ScenarioService'
import { hydrateParams } from '../utils/params'
import { CITY_OPTIONS } from '../data/cities'

// 城市清单以 src/data/cities.ts 注册表为准（含地图坐标）；规则文件在 public/rules/<value>.json
export const CITIES = CITY_OPTIONS

interface CustomPlan {
  id: string
  name: string
  work: WorkParams
  costs: CostParams
}

const PARAMS_KEY = 'nomoney_params_v1'

const DEFAULT_WORK: WorkParams = {
  city: 'guangzhou', dailyHours: 10, dailyOrders: 35,
  avgDistance: 2.5, workDaysMonth: 26, rainDaysMonth: 3, holidayDaysMonth: 2,
}
const DEFAULT_COSTS: CostParams = {
  vehicleType: 'electric', fuelCostMonth: 0,
  electricityCostMonth: 300, maintenanceMonth: 200,
  insuranceMonth: 100, phoneCostMonth: 100, foodCostMonth: 800,
  trafficFineMonth: 50, vehicleDepreciationMonth: 300, otherCostMonth: 100,
}
const DEFAULT_PERSONAL: PersonalParams = {
  currentAge: 25, expectedRetireAge: 60, hasSocialInsurance: false,
  specialDeductionMonth: 0,
  // 可选键必须显式出现在 fallback 中：hydrate 的白名单取自 fallback 的键，
  // 缺键会让写入端存下、读取端静默丢弃（medicalTierId 曾因此每次刷新都丢）
  medicalTierId: undefined,
  pensionBase: undefined,
  medicalBase: undefined,
  // 同上：可选键必须显式出现，否则导入/恢复时被白名单静默丢弃
  incomeOverrides: undefined,
}

function loadParams() {
  try {
    const raw = localStorage.getItem(PARAMS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Record<string, unknown>
  } catch { return null }
}

export const useMainStore = defineStore('main', () => {
  const rule = ref<CityRule | null>(null)
  const loading = ref(false)
  const loadError = ref<string | null>(null)
  const paramsRestored = ref(false)
  /** 一次性提示（如切城重置了自选基数）；由 ParamSidebar 展示后可清空 */
  const cityNotice = ref<string | null>(null)
  /** 本地存储写入失败原因：隐私模式/配额耗尽时不是"已保存"，UI 必须能区分 */
  const persistError = ref<string | null>(null)
  let loadSeq = 0
  let persistTimer: ReturnType<typeof setTimeout> | undefined
  const saved = loadParams()

  const work = ref<WorkParams>(hydrateParams(saved?.work, DEFAULT_WORK))
  const costs = ref<CostParams>(hydrateParams(saved?.costs, DEFAULT_COSTS))
  const personal = ref<PersonalParams>(hydrateParams(saved?.personal, DEFAULT_PERSONAL))
  // 恢复的旧参数可能自带矛盾组合（老版本写入、用户手改存储）：单字段夹取管不住
  // 跨字段约束，必须在赋初值时修一次，否则 scenarios 从一开始就是空数组
  if (personal.value.expectedRetireAge <= personal.value.currentAge) {
    personal.value.expectedRetireAge = Math.min(personal.value.currentAge + 1, 90)
  }
  paramsRestored.value = !!saved

  /** 自选缴费基数所属城市：恢复的基数与恢复的 work.city 同源；同城重载不得清掉 */
  let basesCity: string = work.value.city

  /** 自定义方案是嵌套结构，数组不能走 hydrate 的键值白名单，需单独校验必要字段 */
  const customPlans = ref<CustomPlan[]>(
    Array.isArray(saved?.customPlans)
      ? (saved!.customPlans as unknown[]).filter((p): p is CustomPlan => {
          const o = p as Record<string, unknown> | null
          return !!o && typeof o.id === 'string' && typeof o.name === 'string'
            && !!o.work && typeof o.work === 'object' && !!o.costs && typeof o.costs === 'object'
        }).map(p => ({ id: p.id, name: p.name, work: hydrateParams(p.work, DEFAULT_WORK), costs: hydrateParams(p.costs, DEFAULT_COSTS) }))
      : []
  )

  /** 补偿计算面板的最近一次「用户已确认」结果，文书生成器据此填充真实金额 */
  const compensation = ref<CompensationResult | null>(null)
  function setCompensation(r: CompensationResult | null) { compensation.value = r }

  // 编排走 application 层 ScenarioService（内部已切到 domain 引擎），
  // 与旧 ScenarioEngine 的数值等价性由 tests/parity/old-vs-domain.spec.ts 保证
  // overrides 进入引擎构造：用户改了「自己的计价」必须重建引擎，
  // 否则引擎仍持有构造时的旧计价，改了参数数字不动
  const engine = computed(() => {
    if (!rule.value) return null
    return new ScenarioService(rule.value, personal.value.incomeOverrides)
  })

  /** 取出 Result 的成功值；失败时返回 null，让 UI 走空态而不是抛错白屏 */
  function unwrap<T>(r: { ok: true; value: T } | { ok: false }): T | null {
    return r.ok ? r.value : null
  }

  async function loadRule(city: string) {
    const seq = ++loadSeq
    loading.value = true
    loadError.value = null
    // 切城时先作废旧规则：否则在新规则到达前，engine 仍按旧城口径计算，
    // 而 work.city / 标签已是新城，出现「深圳标签 + 广州数字」的窗口
    const prevRuleCity = rule.value?.city ?? null
    if (rule.value && prevRuleCity !== city) rule.value = null
    // 无超时的 fetch 在弱网或 SPA 回退挂起时会让 finally 不执行，loading 永久为 true，
    // 城市选择器被禁用后用户无法自救，只能靠手动刷新
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    try {
      const res = await fetch(`/rules/${city}.json`, { signal: controller.signal })
      if (!res.ok) throw new Error(`规则文件加载失败（HTTP ${res.status}）`)
      // 不信任 content-type（CDN 对 .json 可能回 octet-stream），直接按文本读再解析：
      // 静态托管的 SPA 回退会用 200 + HTML 应答缺失文件，JSON.parse 在此自然拦截
      const text = await res.text()
      let data: CityRule
      try {
        data = JSON.parse(text) as CityRule
      } catch {
        throw new Error(`未找到 ${city} 的规则文件（响应不是合法 JSON）`)
      }
      // CDN 边缘节点返回错版本时，规则里的 cityName 会与用户选的城市静默不一致，
      // 而侧边栏显示的是 work.city —— 正是本项目反复要防的"深圳抄广州"类事故
      if (data.city !== city) throw new Error(`规则文件与请求城市不一致（期望 ${city}，实际 ${data.city}）`)
      if (seq !== loadSeq) return
      rule.value = data

      // 以下清理只在「确实换了城市」时执行：启动失败后的同城重试（prevRuleCity===null
      // 但 basesCity===city）按本城口径填写的基数与方案必须原样保留
      const switchedCity = prevRuleCity !== null ? prevRuleCity !== city : basesCity !== city
      const notices: string[] = []
      if (switchedCity) {
        // 医保档次与缴费基数是各城规则文件自己的条目，切换城市后旧值在新城中无意义
        const tierId = personal.value.medicalTierId
        if (tierId && !data.benefit.medicalTiers?.some(t => t.id === tierId)) {
          personal.value.medicalTierId = undefined
        }
        // 自选缴费基数是按旧城上下限填的，跨城沿用会算出越界/无意义的金额。
        // 清空是对的，但必须告知——否则用户以为自己的设置"自己丢了"
        const hadBase = personal.value.pensionBase !== undefined || personal.value.medicalBase !== undefined
        if (hadBase) {
          notices.push('此前自选的缴费基数按上一城市口径填写，已重置为该城默认（按申报收入夹取）。如需固定基数请在左侧重新选择。')
        }
        personal.value.pensionBase = undefined
        personal.value.medicalBase = undefined
        basesCity = city
        // 自定义方案与补偿金额都属于旧城口径（补偿含本城社保基数封顶/保底），
        // 必须在切换「成功」后才清：加载失败就清，弱网一次超时即永久丢失用户搭建的方案
        if (customPlans.value.length > 0) {
          notices.push(`自定义方案属于上一城市，已清空（${customPlans.value.length} 个）。`)
          customPlans.value = []
        }
        if (compensation.value !== null) {
          notices.push('上一城市的补偿测算结果已作废，请在新城市下重新计算。')
          compensation.value = null
        }
        if (notices.length > 0) {
          cityNotice.value = `已切换到${data.cityName}：${notices.join('')}`
        }
      }
    } catch (err) {
      if (seq !== loadSeq) return
      rule.value = null
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      loadError.value = aborted ? '加载超时（12秒），请检查网络后重试' : (err instanceof Error ? err.message : String(err))
    } finally {
      clearTimeout(timer)
      if (seq === loadSeq) loading.value = false
    }
  }

  function setCity(city: string) {
    work.value.city = city
    // 方案/补偿/基数的清空延迟到 loadRule 成功路径（见 switchedCity 分支）：
    // 在此先清的话，目标城市加载失败会把原城市数据永久丢掉
    return loadRule(city)
  }

  /**
   * 当前年龄与退休年龄是一对跨字段约束：服务层要求「退休年龄 > 当前年龄」，
   * 一旦违反，整批场景被拒 → scenarios 变空数组 → 页面显示「正常但全是零」，
   * 而用户完全看不出是自己把年龄调矛盾了。
   *
   * 两个滑块各自独立（当前年龄上限 65、退休年龄下限 currentAge+1），挡不住
   * 「先设退休年龄 60 再把当前年龄拉到 65」以及恢复旧参数造成的矛盾，故在 store 兜底。
   * flush:'sync' 必须保留：异步 flush 会让 UI 先闪过一帧空测算，
   * 且非组件环境（单测）同步读取时约束尚未生效。
   */
  watch(
    () => [personal.value.currentAge, personal.value.expectedRetireAge] as const,
    ([age, retireAge]) => {
      if (!Number.isFinite(age) || !Number.isFinite(retireAge)) return
      if (retireAge <= age) {
        // 退休年龄上限与 PARAM_BOUNDS 对齐（90）；至少要留出 1 年缴费期
        personal.value.expectedRetireAge = Math.min(age + 1, 90)
      }
    },
    { flush: 'sync' },
  )

  /**
   * 基数一旦被用户改动，就视为「按当前城市口径填写」：此后即使规则尚未加载成功
   * （启动失败重试），loadRule 也能凭 basesCity 区分「本城重试」与「跨城切换」。
   */
  watch(
    () => [personal.value.pensionBase, personal.value.medicalBase] as const,
    ([pension, medical]) => {
      if (pension !== undefined || medical !== undefined) basesCity = work.value.city
    },
    { flush: 'sync' },
  )

  /** 参数是用户逐项调出来的，刷新即丢会让"方案对比"无法复现，故落本地存储 */
  function writePersist() {
    try {
      localStorage.setItem(PARAMS_KEY, JSON.stringify({
        work: work.value, costs: costs.value, personal: personal.value, customPlans: customPlans.value,
      }))
      persistError.value = null
    } catch (err) {
      // 隐私模式或配额耗尽：此前静默吞掉，用户以为参数已保存，刷新后全丢
      persistError.value = err instanceof Error && err.name === 'QuotaExceededError'
        ? '本地存储空间不足，参数无法自动保存（本次测算仍可正常使用）'
        : '当前浏览器禁止本地存储（可能处于隐私模式），参数无法自动保存'
    }
  }

  watch([work, costs, personal, customPlans], () => {
    clearTimeout(persistTimer)
    persistTimer = setTimeout(writePersist, 300)
  }, { deep: true })

  // 300ms 防抖的最后一笔改动可能在落盘前就遇到刷新/关标签页，pagehide 时同步冲刷
  function flushPersistOnLeave() {
    if (persistTimer === undefined) return
    clearTimeout(persistTimer)
    persistTimer = undefined
    writePersist()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushPersistOnLeave)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushPersistOnLeave()
    })
  }

  /** 导出参数快照（与持久化同构，换设备/清缓存迁移用；不含 AI Key 等敏感数据） */
  function exportParams(): string {
    return JSON.stringify({
      work: work.value, costs: costs.value, personal: personal.value, customPlans: customPlans.value,
    }, null, 2)
  }

  /**
   * 导入参数快照：与初始化恢复共用同一套白名单校验（hydrateParams），
   * 非法/缺失字段落回默认值而不是整包拒绝——与手改 localStorage 的容错口径一致。
   * 返回错误文案；null 表示已应用（含跨城时触发 loadRule）。
   */
  function importParams(raw: unknown): string | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '文件内容不是参数快照（应为 JSON 对象）'
    const snap = raw as Record<string, unknown>
    const nextWork = hydrateParams(snap.work, DEFAULT_WORK)
    const nextCosts = hydrateParams(snap.costs, DEFAULT_COSTS)
    const nextPersonal = hydrateParams(snap.personal, DEFAULT_PERSONAL)
    if (nextPersonal.expectedRetireAge <= nextPersonal.currentAge) {
      nextPersonal.expectedRetireAge = Math.min(nextPersonal.currentAge + 1, 90)
    }
    const plans = Array.isArray(snap.customPlans)
      ? (snap.customPlans as unknown[]).filter((p): p is CustomPlan => {
          const o = p as Record<string, unknown> | null
          return !!o && typeof o.id === 'string' && typeof o.name === 'string'
            && !!o.work && typeof o.work === 'object' && !!o.costs && typeof o.costs === 'object'
        }).map(p => ({ id: p.id, name: p.name, work: hydrateParams(p.work, DEFAULT_WORK), costs: hydrateParams(p.costs, DEFAULT_COSTS) }))
      : []
    work.value = nextWork
    costs.value = nextCosts
    personal.value = nextPersonal
    customPlans.value = plans
    basesCity = nextWork.city
    paramsRestored.value = false
    void loadRule(nextWork.city)
    return null
  }

  function resetParams() {
    // 保留当前城市：DEFAULT_WORK.city 是 guangzhou，直接展开会把用户从深圳/东莞静默切回广州
    const keepCity = work.value.city
    work.value = { ...DEFAULT_WORK, city: keepCity }
    costs.value = { ...DEFAULT_COSTS }
    personal.value = { ...DEFAULT_PERSONAL }
    customPlans.value = []
    paramsRestored.value = false
    return loadRule(keepCity)
  }

  // 场景输入的单一真相：scenarios 与 comparison 都基于它，避免 compare() 用 personal.value
  // 覆盖各场景自己的 personal，导致「缴齐社保」被按未参保重算（卡片与图表数值打架）
  const scenarioInputs = computed<ScenarioInput[]>(() => {
    const list: ScenarioInput[] = [
      { id: 'current', name: '当前方案', work: work.value, costs: costs.value, personal: personal.value },
      { id: 'more_hours', name: '多跑2小时', work: { ...work.value, dailyHours: Math.min(work.value.dailyHours + 2, 14) }, costs: costs.value, personal: personal.value },
      { id: 'more_orders', name: '多接5单', work: { ...work.value, dailyOrders: work.value.dailyOrders + 5 }, costs: costs.value, personal: personal.value },
    ]
    if (!personal.value.hasSocialInsurance) {
      list.push({ id: 'with_insurance', name: '缴齐社保', work: work.value, costs: costs.value, personal: { ...personal.value, hasSocialInsurance: true } })
    }
    for (const p of customPlans.value) {
      list.push({ id: p.id, name: p.name, work: p.work, costs: p.costs, personal: personal.value })
    }
    return list
  })

  const scenarios = computed<ScenarioResult[]>(() => {
    const eng = engine.value
    if (!eng) return []
    return scenarioInputs.value
      .map(s => unwrap(eng.runScenario(s)))
      .filter((s): s is ScenarioResult => s !== null)
  })

  function addScenario(name: string, w: WorkParams, c: CostParams) {
    customPlans.value.push({ id: `custom_${Date.now()}`, name, work: { ...w }, costs: { ...c } })
  }

  function removeScenario(id: string) {
    customPlans.value = customPlans.value.filter(p => p.id !== id)
  }

  const comparison = computed(() => {
    const eng = engine.value
    const list = scenarioInputs.value
    if (!eng || list.length === 0) return null
    return unwrap(eng.compare({ scenarios: list }))
  })

  // ---------- 主题（深/浅） ----------
  // 默认深色（品牌基调）。初值读取 localStorage，其次跟随系统偏好。
  const isDark = ref(false)
  try {
    const savedTheme = localStorage.getItem('theme')
    isDark.value = savedTheme
      ? savedTheme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    /* localStorage 不可用时保持默认深色 */
  }

  function toggleTheme() {
    isDark.value = !isDark.value
    try {
      localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    } catch {
      /* 隐私模式下无法持久化，忽略 */
    }
  }

  return { rule, loading, loadError, paramsRestored, cityNotice, persistError, work, costs, personal, customPlans, compensation, setCompensation, scenarios, comparison, isDark, toggleTheme, loadRule, setCity, resetParams, addScenario, removeScenario, exportParams, importParams }
})
