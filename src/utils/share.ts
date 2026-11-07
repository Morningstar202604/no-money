/**
 * 场景分享（URL 编解码）
 *
 * 为什么做这个功能：
 * 骑手算出一个数，第一反应是发给同行/家人问"你觉得这个靠谱吗"。
 * 此前只能口头描述"我一天跑 35 单"，对方还得在手机上重设一遍参数。
 * URL 分享让"把我的情况原样发给你"变成一次点击。
 *
 * 编码选择（为什么不用 JSON 压缩库）：
 * 参数体 ~500 字节，JSON.stringify + URL-safe Base64 后 ~700 字符，
 * 远低于浏览器 2KB 的安全 URL 长度上限。引入 lz-string 之类压缩库
 * 能省 200 字符，代价是加依赖 + 调试时看不到明文——不值得。
 *
 * 安全边界：
 * 只编码测算参数（work/costs/personal/capacity/volatility），
 * 不含 API Key、对话历史、补偿结果——分享出去的东西要经得起被转发。
 */
import type { WorkParams, CostParams, PersonalParams } from '../types'
import type { CapacityModel } from '../domain/income/capacity'

/** 可分享的参数形状（与 exportParams 对齐，但不含 schemaVersion 等本地元数据） */
export interface ShareableParams {
  work: WorkParams
  costs: CostParams
  personal: PersonalParams
  capacityModel: CapacityModel
  volatilityCv: number
}

/** URL 查询参数名 */
export const SHARE_PARAM = 's'

/** 是否包含全部必需段（work/costs/personal 三者缺一不可） */
function isShareable(v: unknown): v is ShareableParams {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return !!o.work && !!o.costs && !!o.personal
}

/** URL-safe Base64：+ → -，/ → _，去掉填充（避免 URL 编码歧义） */
function toUrlSafe(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromUrlSafe(s: string): string {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  return b64
}

/**
 * 编码为分享 URL 查询串（含 `s=` 前缀；不含 `?`，由调用方拼接）。
 * 抛错 = 输入不可分享，调用方应隐藏分享入口而不是吞掉。
 */
export function encodeShare(params: ShareableParams): string {
  if (!isShareable(params)) throw new Error('参数缺少 work/costs/personal，无法分享')
  // 挑字段而不是整对象序列化：personal 里可能有 incomeOverrides 等大对象，
  // 分享时显式列出字段，防止未来新增敏感字段被无意带出去。
  const slim = {
    work: params.work,
    costs: params.costs,
    personal: {
      currentAge: params.personal.currentAge,
      expectedRetireAge: params.personal.expectedRetireAge,
      hasSocialInsurance: params.personal.hasSocialInsurance,
      specialDeductionMonth: params.personal.specialDeductionMonth,
      personalPensionAnnual: params.personal.personalPensionAnnual,
      taxHealthInsuranceAnnual: params.personal.taxHealthInsuranceAnnual,
    },
    capacityModel: params.capacityModel,
    volatilityCv: params.volatilityCv,
  }
  const json = JSON.stringify(slim)
  // encodeURIComponent 先转 UTF-8，再 btoa：直接 btoa(中文) 会抛 InvalidCharacterError
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return toUrlSafe(btoa(bin))
}

/**
 * 从 URL 查询参数解码出参数对象。
 * 返回 null 表示无分享参数或格式非法——调用方按"没有分享"处理，不弹错误。
 */
export function decodeShare(search: string): ShareableParams | null {
  try {
    const raw = new URLSearchParams(search).get(SHARE_PARAM)
    if (!raw || raw.length > 4000) return null
    const bin = atob(fromUrlSafe(raw))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const json = new TextDecoder().decode(bytes)
    const obj = JSON.parse(json) as unknown
    return isShareable(obj) ? obj : null
  } catch {
    return null
  }
}

/** 从当前 location 移除分享参数（消费后不留痕，避免刷新时重复应用） */
export function stripShareFromUrl(): void {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(SHARE_PARAM)) return
    url.searchParams.delete(SHARE_PARAM)
    // replaceState 不产生历史记录，回退键不会回到带参链接
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  } catch {
    /* 非 http 环境（单测/SSR）静默跳过 */
  }
}
