/**
 * 「我的清单」本机状态。
 *
 * 只保存权益条目的 id + 是否收藏 + 是否已办，不保存城市、身份、工资、身份证。
 * 目的：用户下次打开还能接着办；换设备不迁移、不上传、不需要账号。
 */
import { defineStore } from 'pinia'
import { normalizeReminderDate } from '../utils/checklistCalendar'
import { localDateString } from '../utils/localDate'

export const RIGHTS_CHECKLIST_STORAGE_KEY = 'nomoney_rights_checklist_v1'

export interface RightsChecklistEntry {
  saved: boolean
  done: boolean
  updatedAt: string
  /** 用户自选的日历提醒日期，YYYY-MM-DD；没有就不写 */
  remindAt?: string
}

type ChecklistEntries = Record<string, RightsChecklistEntry>

function readEntries(): ChecklistEntries {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(RIGHTS_CHECKLIST_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const entries: ChecklistEntries = {}
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!id || typeof value !== 'object' || value === null) continue
      const v = value as Record<string, unknown>
      if (typeof v.saved !== 'boolean' || typeof v.done !== 'boolean') continue
      entries[id] = {
        saved: v.saved,
        done: v.done,
        updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : '',
      }
      const remindAt = normalizeReminderDate(v.remindAt)
      if (remindAt) entries[id].remindAt = remindAt
    }
    return entries
  } catch {
    // 隐私模式/存储损坏：按空清单处理，不阻断页面
    return {}
  }
}

export const useRightsChecklistStore = defineStore('rightsChecklist', {
  state: () => ({
    entries: readEntries() as ChecklistEntries,
  }),

  getters: {
    trackedCount: (state) =>
      Object.values(state.entries).filter((e) => e.saved || e.done).length,
    doneCount: (state) => Object.values(state.entries).filter((e) => e.done).length,
    isSaved: (state) => (id: string) => Boolean(state.entries[id]?.saved),
    isDone: (state) => (id: string) => Boolean(state.entries[id]?.done),
    remindAt: (state) => (id: string) => state.entries[id]?.remindAt,
    reminderCount: (state) => Object.values(state.entries).filter((e) => e.remindAt).length,
  },

  actions: {
    ensure(id: string): RightsChecklistEntry {
      const current = this.entries[id]
      if (current) return current
      const entry: RightsChecklistEntry = { saved: false, done: false, updatedAt: localDateString() }
      this.entries[id] = entry
      return entry
    },

    persist() {
      if (typeof localStorage === 'undefined') return
      try {
        const cleaned: ChecklistEntries = {}
        for (const [id, entry] of Object.entries(this.entries)) {
          if (entry.saved || entry.done || entry.remindAt) cleaned[id] = entry
        }
        if (Object.keys(cleaned).length === 0) {
          localStorage.removeItem(RIGHTS_CHECKLIST_STORAGE_KEY)
        } else {
          localStorage.setItem(RIGHTS_CHECKLIST_STORAGE_KEY, JSON.stringify(cleaned))
        }
      } catch {
        // 存储不可用时只影响“下次还在”，不影响本次操作
      }
    },

    /** 设置/清除日历提醒；设置时把条目录入清单，日期非法按清除处理 */
    setReminder(id: string, date: string | null | undefined): string | null {
      const normalized = normalizeReminderDate(date)
      const entry = this.ensure(id)
      if (normalized) {
        entry.remindAt = normalized
        entry.saved = true
      } else {
        delete entry.remindAt
      }
      entry.updatedAt = localDateString()
      if (!entry.saved && !entry.done && !entry.remindAt) delete this.entries[id]
      this.persist()
      return normalized
    },

    toggleSaved(id: string) {
      const entry = this.ensure(id)
      entry.saved = !entry.saved
      entry.updatedAt = localDateString()
      if (!entry.saved && !entry.done) delete this.entries[id]
      this.persist()
    },

    /** 一次把一张模板的全部条目加入「我的清单」，已收藏的不重复切换 */
    saveMany(ids: string[]): number {
      let added = 0
      for (const id of ids) {
        const entry = this.ensure(id)
        if (!entry.saved) {
          entry.saved = true
          entry.updatedAt = localDateString()
          added += 1
        }
      }
      if (added) this.persist()
      return added
    },

    toggleDone(id: string) {
      const entry = this.ensure(id)
      entry.done = !entry.done
      entry.updatedAt = localDateString()
      if (!entry.saved && !entry.done) delete this.entries[id]
      this.persist()
    },

    clearDone() {
      for (const [id, entry] of Object.entries(this.entries)) {
        entry.done = false
        entry.updatedAt = localDateString()
        if (!entry.saved) delete this.entries[id]
      }
      this.persist()
    },

    reset() {
      this.entries = {}
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem(RIGHTS_CHECKLIST_STORAGE_KEY)
        } catch {
          // 忽略存储异常
        }
      }
    },
  },
})
