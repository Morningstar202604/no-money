import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { CityRule, WorkParams, CostParams, PersonalParams, ScenarioResult, CompensationResult } from '../types'
import { ScenarioService } from '../application/scenario/ScenarioService'
import type { ScenarioInput } from '../application/scenario/ScenarioService'
import { hydrateParams } from '../utils/params'
import {
  calcCapacity,
  hoursForOrders,
  DEFAULT_CAPACITY,
  type CapacityModel,
} from '../domain/income/capacity'
import { CITY_OPTIONS } from '../data/cities'
import { assetUrl } from '../utils/asset'
import { parseCityRule, ruleTimeNotice as describeRuleTime } from '../utils/cityRule'

// 城市清单以 src/data/cities.ts 注册表为准（含地图坐标）；规则文件在 public/rules/<value>.json
export const CITIES = CITY_OPTIONS

interface CustomPlan {
  id: string
  name: string
  work: WorkParams
  costs: CostParams
}

const PARAMS_KEY = 'nomoney_params_v1'

/** 产能模型参数属于用户可调假设（单均固定耗时/平均速度/休息时间） */
const CAPACITY_KEY = 'nomoney_capacity_v1'

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
  assumedAnnualReturn: undefined,
  pensionAdjustRate: undefined,
  discountRate: undefined,
  selfInvestReturn: undefined,
  deadheadRatio: undefined,
  vehicleProfile: undefined,
  statutoryOverrides: undefined,
  // 税优额度（年缴）：不填即未参加，不参与扣除
  personalPensionAnnual: undefined,
  taxHealthInsuranceAnnual: undefined,
}

/** 品牌重命名前的旧存储键；对话历史和 API Key 不在启动阶段静默迁移 */
const LEGACY_KEYS: Record<string, string> = {
  flexcalc_params_v1: PARAMS_KEY,
  flexcalc_capacity_v1: CAPACITY_KEY,
  flexcalc_onboarding_v1: 'nomoney_onboarding_v1',
  flexcalc_ai_cfg: 'nomoney_ai_cfg',
}

/**
 * 一次性迁移不含秘密或对话内容的旧品牌键。
 * AI Key 与对话历史由 AI composable 根据当前显式偏好处理，避免启动阶段扩大敏感数据读取。
 */
function migrateLegacyKeys(): void {
  for (const [oldKey, newKey] of Object.entries(LEGACY_KEYS)) {
    try {
      const legacy = localStorage.getItem(oldKey)
      if (legacy === null) continue
      if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, legacy)
      if (localStorage.getItem(newKey) !== null) localStorage.removeItem(oldKey)
    } catch {
      // 隐私模式或配额耗尽时保留原键，启动仍可使用默认值
    }
  }
}

/**
 * 用户数据的 schema 版本。
 *
 * 为什么要它：localStorage 里的参数结构会随版本变化（新增字段、重命名字段）。
 * 没有版本号时，老用户升级后读到的是"旧结构"，轻则丢参数，重则算出错误结果。
 * 有了版本号，每次读取都能判断要不要迁移；写回时把当前版本一起存进去。
 *
 * 版本变更规则（与 docs/VERSIONING.md 对应）：
 *   1 → 2：增加 personalPensionAnnual / taxHealthInsuranceAnnual（旧数据无此字段，
 *          迁移为 undefined，由 business 层按"未填写"处理）
 *   2 → 3：增加 capacityModel（旧数据无此字段，迁移为默认产能模型）
 *   3 → 4：参数结构稳定，仅补 schemaVersion 字段本身
 *
 * 当前：4
 */
const SCHEMA_VERSION = 4

/** 把任意历史结构规范化到当前版本；无法识别时返回 null 让调用方回落默认值 */
function migrateParams(raw: Record<string, unknown>): Record<string, unknown> {
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1
  let data: Record<string, unknown> = { ...raw }

  if (version < 2) {
    // v1 没有这两个年度税前扣除项；显式置 undefined 表示"用户未填写"，
    // 而不是 0——0 会被当成"用户明确选择不买"，影响税优测算文案。
    if (!('personalPensionAnnual' in data)) data.personalPensionAnnual = undefined
    if (!('taxHealthInsuranceAnnual' in data)) data.taxHealthInsuranceAnnual = undefined
  }
  if (version < 3) {
    // v2 没有产能模型；缺失时由 loadCapacity 回落 DEFAULT_CAPACITY
    if (!('capacityModel' in data)) delete data.capacityModel
  }
  // v4 只是把 schemaVersion 补进结构，字段本身无需变换

  data.schemaVersion = SCHEMA_VERSION
  return data
}

function loadParams() {
  try {
    migrateLegacyKeys()
    const raw = localStorage.getItem(PARAMS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return migrateParams(parsed as Record<string, unknown>)
  } catch {
    // JSON 损坏：返回 null 回落默认值，而不是让整个应用白屏
    return null
  }
}

/**
 * 产能模型参数校验：非法字段回落默认值，避免 NaN 流入方案对比。
 * 写入端（persist / import）与读取端共用同一份夹取逻辑——
 * 此前 loadCapacity 只读 CAPACITY_KEY，而全仓没有任何地方写它，
 * 结果用户校准的产能参数刷新即丢。
 */
function hydrateCapacity(raw: unknown): CapacityModel {
  const fallback = { ...DEFAULT_CAPACITY }
  if (!raw || typeof raw !== 'object') return fallback
  const parsed = raw as Partial<CapacityModel>
  const pick = (v: unknown, def: number, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, min), max) : def
  return {
    fixedMinutesPerOrder: pick(parsed.fixedMinutesPerOrder, fallback.fixedMinutesPerOrder, 1, 60),
    avgSpeedKmh: pick(parsed.avgSpeedKmh, fallback.avgSpeedKmh, 5, 60),
    breakMinutesPerDay: pick(parsed.breakMinutesPerDay, fallback.breakMinutesPerDay, 0, 480),
  }
}

/** 读取产能模型参数：优先当前快照内的值，其次兼容旧的独立存储键 */
function loadCapacity(saved?: Record<string, unknown> | null): CapacityModel {
  if (saved?.capacityModel) return hydrateCapacity(saved.capacityModel)
  try {
    const raw = localStorage.getItem(CAPACITY_KEY)
    if (!raw) return { ...DEFAULT_CAPACITY }
    return hydrateCapacity(JSON.parse(raw))
  } catch { return { ...DEFAULT_CAPACITY } }
}

export const useMainStore = defineStore('main', () => {
  const rule = ref<CityRule | null>(null)
  const ruleTimeNotice = computed(() => rule.value ? describeRuleTime(rule.value) : '')
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

  /**
   * 产能模型参数（单均固定耗时/平均速度/休息时间）。
   * 默认值是行业量级假设，用户可用自己的实际数据校准后重算方案对比。
   */
  const capacityModel = ref<CapacityModel>(loadCapacity(saved))

  /** 收入波动率假设（月度变异系数），默认 20%：灵活就业收入的常见量级，可调 */
  const volatilityCv = ref<number>(
    typeof saved?.volatilityCv === 'number' && Number.isFinite(saved.volatilityCv as number)
      ? Math.max(0.05, Math.min(0.6, saved.volatilityCv as number))
      : 0.2,
  )

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
    return new ScenarioService(rule.value, personal.value.incomeOverrides, personal.value.statutoryOverrides)
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
      const res = await fetch(assetUrl(`rules/${city}.json`), { signal: controller.signal })
      if (!res.ok) throw new Error(`规则文件加载失败（HTTP ${res.status}）`)
      // 不信任 content-type（CDN 对 .json 可能回 octet-stream），直接按文本读再解析：
      // 静态托管的 SPA 回退会用 200 + HTML 应答缺失文件，JSON.parse 在此自然拦截
      const text = await res.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new Error(`未找到 ${city} 的规则文件（响应不是合法 JSON）`)
      }
      const data = parseCityRule(parsed)
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
        // 计价覆盖同理：用户填的是「某城某平台的单价」，跨城沿用等于把广州单价
        // 套到深圳——正是本项目反复防范的「深圳抄广州」类事故。
        // 必须清空并提示，否则用户会拿错误的单价看新城市的结论。
        if (personal.value.incomeOverrides !== undefined) {
          const hadOverride = Object.keys(personal.value.incomeOverrides).length > 0
          personal.value.incomeOverrides = undefined
          if (hadOverride) {
            notices.push('你在「我的计价」里填的单价属于上一城市，已清空；请按新城市的 APP 流水重新填写。')
          }
        }
        // 法定参数覆盖同理：填的是「本省社保基数上下限」，跨省沿用等于把广东的
        // 基数套到北京规则上——与 incomeOverrides 同类跨城串值。
        if (personal.value.statutoryOverrides !== undefined) {
          const hadStatutory = Object.keys(personal.value.statutoryOverrides).length > 0
          personal.value.statutoryOverrides = undefined
          if (hadStatutory) {
            notices.push('你在「本省法定参数」里填的社保基数属于上一省份，已清空；请按新省份人社厅公布的值重新填写。')
          }
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
        schemaVersion: SCHEMA_VERSION,
        work: work.value, costs: costs.value, personal: personal.value, customPlans: customPlans.value,
        capacityModel: capacityModel.value, volatilityCv: volatilityCv.value,
      }))
      persistError.value = null
    } catch (err) {
      // 隐私模式或配额耗尽：此前静默吞掉，用户以为参数已保存，刷新后全丢
      persistError.value = err instanceof Error && err.name === 'QuotaExceededError'
        ? '本地存储空间不足，参数无法自动保存（本次测算仍可正常使用）'
        : '当前浏览器禁止本地存储（可能处于隐私模式），参数无法自动保存'
    }
  }

  watch([work, costs, personal, customPlans, capacityModel, volatilityCv], () => {
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
    // 导出带上 schemaVersion：用户备份文件可能跨多个版本恢复，
    // 没有版本号时导入端只能猜结构，猜错会静默丢字段。
    return JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: '3.1.0',
      work: work.value, costs: costs.value, personal: personal.value, customPlans: customPlans.value,
      capacityModel: capacityModel.value, volatilityCv: volatilityCv.value,
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
    if (typeof snap.volatilityCv === 'number' && Number.isFinite(snap.volatilityCv)) {
      volatilityCv.value = Math.max(0.05, Math.min(0.6, snap.volatilityCv))
    }
    if (snap.capacityModel && typeof snap.capacityModel === 'object') {
      const cm = snap.capacityModel as Record<string, unknown>
      const pick = (v: unknown, def: number, min: number, max: number) =>
        typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, min), max) : def
      capacityModel.value = {
        fixedMinutesPerOrder: pick(cm.fixedMinutesPerOrder, DEFAULT_CAPACITY.fixedMinutesPerOrder, 1, 60),
        avgSpeedKmh: pick(cm.avgSpeedKmh, DEFAULT_CAPACITY.avgSpeedKmh, 5, 60),
        breakMinutesPerDay: pick(cm.breakMinutesPerDay, DEFAULT_CAPACITY.breakMinutesPerDay, 0, 480),
      }
    }
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
    // 这些是独立 ref（不在 personal/work 里），此前「重置为默认参数」没复位它们，
    // 用户以为全清了、实际产能与波动率还是上次调过的值
    capacityModel.value = { ...DEFAULT_CAPACITY }
    volatilityCv.value = 0.2
    // 补偿结果属于「上一套参数」的产物：重置后若不清空，文书生成器会把
    // 旧金额当成本次测算结果写进仲裁请求——这是会被提交给仲裁委的金额，必须清
    compensation.value = null
    paramsRestored.value = false
    return loadRule(keepCity)
  }

  // 场景输入的单一真相：scenarios 与 comparison 都基于它，避免 compare() 用 personal.value
  // 覆盖各场景自己的 personal，导致「缴齐社保」被按未参保重算（卡片与图表数值打架）
  const scenarioInputs = computed<ScenarioInput[]>(() => {
    // 工时与单量受产能模型约束，不能当自由变量各改一个：
    // 「多跑2小时」必须同时按产能换算单量；「多接5单」必须换算所需工时。
    // 旧实现只改一边，导致「多跑2小时净收入不变」与「凭空缩短单均耗时」两种失真。
    // 单量与工时两侧都必须走 calcCapacity 同一口径（扣休息 + 疲劳折减），
    // 否则会生成按本工具自己的产能卡都超载的方案，并因单量虚高当选「最优」。
    const cap = capacityModel.value
    const hoursCap = Math.min(work.value.dailyHours + 2, 14)
    const moreHoursOrders = Math.floor(calcCapacity(hoursCap, 0, work.value.avgDistance, cap).maxOrdersPerDay)
    const targetOrders = work.value.dailyOrders + 5
    // 目标单量若在 16 小时产能内都跑不完，就不能再造这个方案：工时封顶后单量同步截断，
    // 提示用户现实约束（而不是给一个算得出但物理上不可达的「多接5单」）
    const hoursNeeded = hoursForOrders(targetOrders, work.value.avgDistance, cap, 16)
    const feasibleOrders = hoursNeeded >= 16
      ? Math.floor(calcCapacity(16, 0, work.value.avgDistance, cap).maxOrdersPerDay)
      : targetOrders
    const moreOrdersHours = Math.min(Math.max(work.value.dailyHours, hoursNeeded), 16)
    const list: ScenarioInput[] = [
      { id: 'current', name: '当前方案', work: work.value, costs: costs.value, personal: personal.value },
      { id: 'more_hours', name: '多跑2小时', work: { ...work.value, dailyHours: hoursCap, dailyOrders: moreHoursOrders }, costs: costs.value, personal: personal.value },
      { id: 'more_orders', name: feasibleOrders > work.value.dailyOrders ? '多接5单' : '跑满16小时', work: { ...work.value, dailyOrders: feasibleOrders, dailyHours: moreOrdersHours }, costs: costs.value, personal: personal.value },
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

  // ---------- 主题（浅/深） ----------
  // 默认浅色：产品主要在白天户外使用，强光下浅色可读性更好。
  // 只有用户显式选过深色才用深色；不跟随系统偏好（系统深色 ≠ 这里要深色）。
  const isDark = ref(false)
  try {
    isDark.value = localStorage.getItem('theme') === 'dark'
  } catch {
    /* localStorage 不可用时保持默认浅色 */
  }

  function toggleTheme() {
    isDark.value = !isDark.value
    try {
      localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    } catch {
      /* 隐私模式下无法持久化，忽略 */
    }
  }

  return { rule, ruleTimeNotice, loading, loadError, paramsRestored, cityNotice, persistError, work, costs, personal, customPlans, compensation, setCompensation, scenarios, comparison, isDark, toggleTheme, loadRule, setCity, resetParams, addScenario, removeScenario, exportParams, importParams, capacityModel, volatilityCv }
})
