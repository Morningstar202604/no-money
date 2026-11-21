/**
 * 34 城规则的页面级加载器。
 *
 * /admin、/audit、/policy 的加载状态、错误提示、重载行为此前各写一遍：
 * 两个 ref（rules/loadResult）、一段 loadNotice computed、一个 load()。
 * 这里只保留一份，页面差异（一致性检查 / 矩阵排序 / 新鲜度总览）留在各自视图里。
 */
import { computed, ref } from 'vue'
import type { CityRule } from '../types'
import {
  loadCityRules,
  cityRuleLoadNotice,
  type CityRuleLoadResult,
} from '../data/cityRules'

export function useCityRules() {
  const rules = ref<CityRule[]>([])
  const loadResult = ref<CityRuleLoadResult | null>(null)
  const loading = ref(false)
  /** 同时点“重新统计”与挂载加载时不并发拉两轮 34 城 */
  let inFlight = false
  /** 首次成功后才置位：失败后再次进入页签仍会重试，而不是永久卡空态 */
  let loaded = false

  async function run(force: boolean): Promise<void> {
    if (inFlight) return
    if (loaded && !force) return
    inFlight = true
    loading.value = true
    try {
      const result = await loadCityRules(import.meta.env.BASE_URL)
      loadResult.value = result
      rules.value = result.rules
      loaded = true
    } finally {
      inFlight = false
      loading.value = false
    }
  }

  /** 幂等加载：页面挂载 / 首次切到数据页签时调用 */
  const load = (): Promise<void> => run(false)
  /** 用户明确点“重试/重新统计”时调用 */
  const reload = (): Promise<void> => run(true)

  const notice = computed(() => cityRuleLoadNotice(loadResult.value))

  return { rules, loadResult, loading, notice, load, reload }
}
