// @vitest-environment happy-dom
/**
 * 「我的清单」只存 id + 收藏/已办状态，不存城市、身份、工资。
 * 这里是真实 Pinia store，不读源码文本。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  RIGHTS_CHECKLIST_STORAGE_KEY,
  useRightsChecklistStore,
} from '../src/stores/rightsChecklist'

function freshStore() {
  localStorage.clear()
  const pinia = createPinia()
  setActivePinia(pinia)
  return useRightsChecklistStore()
}

beforeEach(() => {
  localStorage.clear()
})

describe('我的清单本机持久化', () => {
  it('加入清单只写 id/状态，不写城市或工资', () => {
    const store = freshStore()
    store.toggleSaved('right-housing-fund')
    const raw = localStorage.getItem(RIGHTS_CHECKLIST_STORAGE_KEY) ?? ''
    expect(raw).toContain('right-housing-fund')
    expect(raw).not.toContain('city')
    expect(raw).not.toContain('salary')
    expect(store.isSaved('right-housing-fund')).toBe(true)
  })

  it('刷新/重新创建 store 后收藏仍在', () => {
    const store = freshStore()
    store.toggleSaved('right-wage-arrears')
    const pinia = createPinia()
    setActivePinia(pinia)
    const reloaded = useRightsChecklistStore()
    expect(reloaded.isSaved('right-wage-arrears')).toBe(true)
    expect(reloaded.trackedCount).toBe(1)
  })

  it('标记已办、清空已办，不误删收藏', () => {
    const store = freshStore()
    store.toggleSaved('right-injury-report')
    store.toggleDone('right-injury-report')
    expect(store.doneCount).toBe(1)
    store.clearDone()
    expect(store.doneCount).toBe(0)
    expect(store.isSaved('right-injury-report')).toBe(true)
    expect(store.isDone('right-injury-report')).toBe(false)
  })

  it('取消收藏且未办时，条目从清单里移除', () => {
    const store = freshStore()
    store.toggleSaved('right-birth-allowance')
    expect(store.trackedCount).toBe(1)
    store.toggleSaved('right-birth-allowance')
    expect(store.trackedCount).toBe(0)
    expect(localStorage.getItem(RIGHTS_CHECKLIST_STORAGE_KEY)).toBeNull()
  })

  it('批量加入一张模板的清单，不重复计数', () => {
    const store = freshStore()
    expect(store.saveMany(['right-injury-report', 'right-arbitration', 'right-legal-aid'])).toBe(3)
    expect(store.trackedCount).toBe(3)
    expect(store.saveMany(['right-injury-report', 'right-arbitration'])).toBe(0)
    expect(store.trackedCount).toBe(3)
    const raw = localStorage.getItem(RIGHTS_CHECKLIST_STORAGE_KEY) ?? ''
    expect(raw).toContain('right-arbitration')
    expect(raw).not.toContain('city')
  })

  it('损坏的本地数据不会让页面崩', () => {
    localStorage.setItem(RIGHTS_CHECKLIST_STORAGE_KEY, '{broken')
    const store = freshStore()
    expect(store.trackedCount).toBe(0)
  })

  it('设置提醒后刷新仍在，非法日期按清除处理', () => {
    const store = freshStore()
    expect(store.setReminder('right-injury-report', '2026-12-01')).toBe('2026-12-01')
    expect(store.isSaved('right-injury-report')).toBe(true)
    expect(store.remindAt('right-injury-report')).toBe('2026-12-01')
    expect(store.reminderCount).toBe(1)

    const pinia = createPinia()
    setActivePinia(pinia)
    const reloaded = useRightsChecklistStore()
    expect(reloaded.remindAt('right-injury-report')).toBe('2026-12-01')

    expect(reloaded.setReminder('right-injury-report', '2026-02-30')).toBeNull()
    expect(reloaded.remindAt('right-injury-report')).toBeUndefined()
    expect(reloaded.isSaved('right-injury-report')).toBe(true)
  })

  it('提醒日期只写日期，不写城市、工资或身份', () => {
    const store = freshStore()
    store.setReminder('right-housing-fund', '2026-12-15')
    const raw = localStorage.getItem(RIGHTS_CHECKLIST_STORAGE_KEY) ?? ''
    expect(raw).toContain('2026-12-15')
    expect(raw).not.toContain('city')
    expect(raw).not.toContain('salary')
    expect(raw).not.toContain('identity')
  })
})
