import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * 页签与 ?tab= 双向同步。
 *
 * 三个页面此前各自复制了同一段 getter/setter；抽到这里后，
 * 深链、复制地址、返回键行为只维护一份。
 */
export function useTabQuery<T extends string>(names: readonly T[], defaultTab: T) {
  const route = useRoute()
  const router = useRouter()

  return computed<T>({
    get: () => {
      const q = route.query.tab
      return typeof q === 'string' && (names as readonly string[]).includes(q) ? (q as T) : defaultTab
    },
    set: (value: T) => {
      // replace：点页签不往历史里压记录，返回键退整页而不是逐页签退
      void router.replace({ query: { ...route.query, tab: value === defaultTab ? undefined : value } })
    },
  })
}
