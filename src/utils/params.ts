/**
 * 参数夹取工具。
 * 外部输入（滑块、localStorage 恢复）都可能给出 NaN、Infinity 或越界值，
 * 而这类值一旦流入引擎会静默产生 NaN 并被比较运算吞掉（NaN > x 恒为 false），
 * 用户看到的是一个看起来笃定的评级。因此夹取必须发生在唯一的入口处。
 */

/**
 * 严格夹取：只接受真正的 number 类型。
 *
 * 为什么不能直接用 clampNumber：它用 Number(v) 强制转换，于是
 *   "8" → 8（字符串被接受）
 *   null → 0（被当成 0，可能静默改成最小值）
 *   true → 1
 * 而 hydrateParams 处理的是 localStorage / 导入文件里的 JSON，
 * 这三种值都可能出现——旧实现会回退 fallback，语义更安全。
 * 本轮曾把两者合并，属行为回归，此处恢复严格语义。
 */
function clamp(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.min(Math.max(v, min), max)
}

/** 各参数组的合法区间。键名与 WorkParams / CostParams / PersonalParams 对齐。 */
export const PARAM_BOUNDS = {
  work: {
    dailyHours: [1, 24],
    dailyOrders: [0, 200],
    avgDistance: [0, 50],
    // 下限 0 与 domain（允许 0 天：收入 0、成本仍在）和 ScenarioService 的校验一致；
    // 写 1 会让持久化的「本月 0 天」在恢复时被静默改成 1 天，凭空多算一天收入
    workDaysMonth: [0, 31],
    rainDaysMonth: [0, 31],
    holidayDaysMonth: [0, 31],
  },
  costs: {
    fuelCostMonth: [0, 20000],
    electricityCostMonth: [0, 20000],
    maintenanceMonth: [0, 20000],
    insuranceMonth: [0, 20000],
    phoneCostMonth: [0, 20000],
    foodCostMonth: [0, 20000],
    trafficFineMonth: [0, 20000],
    vehicleDepreciationMonth: [0, 20000],
    otherCostMonth: [0, 20000],
  },
  personal: {
    currentAge: [16, 80],
    expectedRetireAge: [16, 90],
    specialDeductionMonth: [0, 5000],
    // 个人账户记账利率假设：允许负值到 10%（养老金账户实际为记账利率，
    // 3% 只是本项目的默认假设，不是市场产品收益率）
    assumedAnnualReturn: [-0.05, 0.1],
    // 精算假设：养老金调整率与贴现率，均以 3% 为默认，可调范围 0-10%
    pensionAdjustRate: [0, 0.1],
    discountRate: [0, 0.1],
    // 自助投资收益率假设：允许 -10%（亏损）到 15%
    selfInvestReturn: [-0.1, 0.15],
    // 空驶率：0-100%
    deadheadRatio: [0, 1],
  },
} as const

const VEHICLE_TYPES = ['electric', 'fuel', 'mixed'] as const

/**
 * 从 localStorage 恢复参数。
 * 白名单取自 fallback 的键 + PARAM_BOUNDS，因此可选字段（如 medicalTierId）
 * 必须显式出现在 fallback 里才会被保留——写入与读取共用同一份 schema，避免读写不对称。
 */
export function hydrateParams<T extends object>(saved: unknown, fallback: T): T {
  if (!saved || typeof saved !== 'object') return { ...fallback }
  const out = { ...fallback } as Record<string, unknown>
  const known = fallback as Record<string, unknown>

  // fallback 中值为 undefined 的可选键也算已知键（写入时同样存在），否则会静默丢字段
  for (const [k, v] of Object.entries(saved as Record<string, unknown>)) {
    if (!(k in known)) continue
    const bounds = lookupBounds(fallback, k)
    if (bounds) {
      const fallbackVal = typeof known[k] === 'number' ? (known[k] as number) : bounds[0]
      out[k] = clamp(v, bounds[0], bounds[1], fallbackVal)
      continue
    }
    if (typeof v === 'number') {
      if (Number.isFinite(v)) out[k] = v
      continue
    }
    if (typeof v === 'boolean' || typeof v === 'string') out[k] = v
    // 嵌套对象（如 incomeOverrides）：逐字段按有限数字白名单重建。
    // 此前只接受数字/布尔/字符串，嵌套对象在恢复与导入时被静默丢弃——
    // 用户填了一整屏「我的计价」，刷新后全部消失
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const clean: Record<string, number> = {}
      for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) {
        if (typeof nv === 'number' && Number.isFinite(nv)) clean[nk] = nv
      }
      if (Object.keys(clean).length > 0) out[k] = clean
    }
  }

  // 联合类型字段单独做枚举校验，字符串白名单挡不住 'gasoline' 这类脏值
  if ('vehicleType' in known) {
    const vt = (saved as Record<string, unknown>).vehicleType
    if (typeof vt === 'string' && !(VEHICLE_TYPES as readonly string[]).includes(vt)) {
      out.vehicleType = known.vehicleType
    }
  }
  if ('city' in known) {
    const c = (saved as Record<string, unknown>).city
    if (typeof c !== 'string' || !/^[a-z]{2,12}$/.test(c)) out.city = known.city
  }

  return out as T
}

function lookupBounds(fallback: object, key: string): readonly [number, number] | null {
  for (const group of Object.values(PARAM_BOUNDS)) {
    const b = (group as Record<string, readonly [number, number]>)[key]
    if (b) return b
  }
  return null
}
