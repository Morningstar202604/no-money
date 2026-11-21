/**
 * 34 城规则的页面级加载器。
 *
 * /admin 与 /audit 的加载状态、错误提示、重载行为此前各写一遍：
 * 两个 ref（rules/loadResult）、一段 loadNotice computed、一个 load()。
 * 0.0.41 已把数据加载收进 src/data/cityRules.ts，但页面层仍复制同一套状态机。
 * 这里只保留一份，页面差异（一致性检查 / 矩阵排序）留在各自视图里。
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

  async function load(): Promise<void> {
    if (inFlight) return
    inFlight = true
    loading.value = true
    try {
      const loaded = await loadCityRules(import.meta.env.BASE_URL)
      loadResult.value = loaded
      rules.value = loaded.rules
    } finally {
      inFlight = false
      loading.value = false
    }
  }

  const notice = computed(() => cityRuleLoadNotice(loadResult.value))

  return { rules, loadResult, loading, notice, load }
}
