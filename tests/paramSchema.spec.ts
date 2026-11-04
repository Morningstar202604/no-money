// @vitest-environment happy-dom
/**
 * 用户参数的 schema 版本与迁移
 *
 * 为什么必须测：老用户升级后读到的是旧结构参数。如果迁移逻辑错了，
 * 轻则参数丢失（用户以为自己的设置没了），重则用错误参数算出错误收入——
// 而这个错误不会报错，只会安静地给出一个假数字。
 *
 * 这里直接驱动真实 store，不 mock 迁移函数：
 * 迁移是否正确，只有在"写入 localStorage → 重新初始化 store → 读回来"这条链上才看得到。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const PARAMS_KEY = 'nomoney_params_v1'

/** 每个用例前重置模块与存储，模拟"用户第二次打开应用" */
async function freshStore() {
  vi.resetModules()
  setActivePinia(createPinia())
  const { useMainStore } = await import('../src/stores/main')
  return useMainStore()
}

beforeEach(() => {
  localStorage.clear()
})

describe('参数 schema 版本', () => {
  it('全新用户没有存储时使用默认值，且不报错', async () => {
    const store = await freshStore()
    expect(store.work.dailyHours).toBe(10)
    expect(store.work.dailyOrders).toBe(35)
  })

  it('写入时带上 schemaVersion', async () => {
    const store = await freshStore()
    store.work.dailyHours = 12
    // 触发持久化（store 内部 watch 会写）
    await new Promise((r) => setTimeout(r, 450))

    const raw = localStorage.getItem(PARAMS_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.schemaVersion).toBe(4)
  })

  it('v1 旧数据（无 schemaVersion）能被读取并补齐版本号', async () => {
    // 模拟旧版本写入的结构：没有 schemaVersion，也没有后来的字段
    localStorage.setItem(
      PARAMS_KEY,
      JSON.stringify({
        work: { dailyHours: 8, dailyOrders: 20, avgDistance: 2, workDaysMonth: 22, rainDaysMonth: 2, holidayDaysMonth: 1, city: 'guangzhou' },
        costs: { vehicleType: 'electric', fuelCostMonth: 0, electricityCostMonth: 200, maintenanceMonth: 100, insuranceMonth: 0, phoneCostMonth: 50, foodCostMonth: 1000, trafficFineMonth: 0, vehicleDepreciationMonth: 150, otherCostMonth: 0 },
        personal: { currentAge: 30, expectedRetireAge: 60, hasSocialInsurance: false, specialDeductionMonth: 0 },
      }),
    )

    const store = await freshStore()
    // 旧值必须被保留，而不是被默认值覆盖
    expect(store.work.dailyHours).toBe(8)
    expect(store.work.dailyOrders).toBe(20)
    expect(store.personal.currentAge).toBe(30)
  })

  it('损坏的 JSON 不会让应用崩溃，回落默认值', async () => {
    localStorage.setItem(PARAMS_KEY, '{ this is not json')
    const store = await freshStore()
    expect(store.work.dailyHours).toBe(10)
  })

  it('存的是数组而不是对象时也回落默认值', async () => {
    localStorage.setItem(PARAMS_KEY, '[1,2,3]')
    const store = await freshStore()
    expect(store.work.dailyHours).toBe(10)
  })

  it('存的是 null 时回落默认值', async () => {
    localStorage.setItem(PARAMS_KEY, 'null')
    const store = await freshStore()
    expect(store.work.dailyHours).toBe(10)
  })

  it('超出合理范围的旧值会被夹取，不会算出荒谬结果', async () => {
    localStorage.setItem(
      PARAMS_KEY,
      JSON.stringify({
        work: { dailyHours: 999, dailyOrders: 99999, avgDistance: 2, workDaysMonth: 22, rainDaysMonth: 2, holidayDaysMonth: 1, city: 'guangzhou' },
      }),
    )
    const store = await freshStore()
    // hydrateParams 应该把越界值夹到合法区间
    expect(store.work.dailyHours).toBeLessThanOrEqual(24)
    expect(store.work.dailyOrders).toBeLessThanOrEqual(10000)
  })
})

describe('导出快照', () => {
  it('导出内容带 schemaVersion、时间戳与应用版本', async () => {
    const store = await freshStore()
    const snapshot = JSON.parse(store.exportParams())

    expect(snapshot.schemaVersion).toBe(4)
    expect(typeof snapshot.exportedAt).toBe('string')
    expect(snapshot.appVersion).toBeTruthy()
    // 关键字段齐全
    expect(snapshot.work).toBeTruthy()
    expect(snapshot.costs).toBeTruthy()
    expect(snapshot.personal).toBeTruthy()
  })

  it('导出的快照能被自己导入回来，关键参数不丢', async () => {
    const store = await freshStore()
    store.work.dailyHours = 9
    store.work.dailyOrders = 28
    await new Promise((r) => setTimeout(r, 450))

    const snapshot = store.exportParams()

    // 改掉参数
    store.work.dailyHours = 14
    expect(store.work.dailyHours).toBe(14)

    // 导入回来
    const err = store.importParams(JSON.parse(snapshot))
    expect(err).toBeNull()
    expect(store.work.dailyHours).toBe(9)
    expect(store.work.dailyOrders).toBe(28)
  })

  it('导入损坏的结构返回错误信息而不是静默接受', async () => {
    const store = await freshStore()
    const err = store.importParams('not an object')
    expect(err).toBeTruthy()
  })
})
