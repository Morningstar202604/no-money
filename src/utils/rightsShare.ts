/**
 * 权益卡分享：把一条能办的事变成工友能直接看懂的短文案。
 *
 * 只读 RightsItem，不另写政策内容；分享文案必须带核验日期和来源，
 * 避免截图/转发后失去“这条依据是什么、什么时候核过”的上下文。
 */
import type { RightsItem } from '../data/rights/catalog'
import { isAbortError } from './abort'

export type RightsShareMode = 'shared' | 'copied'

/** 系统分享被用户取消时返回 null；其它失败给一句能照做的中文。 */
export function shareErrorMessage(error: unknown): string | null {
  if (isAbortError(error)) {
    return null
  }
  return error instanceof Error && error.message.includes('不支持')
    ? error.message
    : '分享失败，请手动复制'
}

/** 生成可直接发微信/短信的纯文本，不包含内部 id、埋点或本机状态。 */
export function buildRightsShareText(item: RightsItem): string {
  const lines = [item.title, item.oneLiner, '']

  if (item.whatToGet.length) {
    lines.push(`能拿什么：${item.whatToGet.slice(0, 2).join('；')}`)
  }
  if (item.whatToDo.length) {
    lines.push('怎么办：')
    item.whatToDo.slice(0, 4).forEach((step, index) => lines.push(`${index + 1}. ${step}`))
  }
  if (item.materials?.length) {
    lines.push(`材料：${item.materials.slice(0, 5).join('、')}`)
  }
  if (item.deadline) {
    lines.push(`时限：${item.deadline}`)
  }
  lines.push(`去哪办：${item.whereToGo}`)
  if (item.officialUrl) {
    lines.push(`官方入口：${item.officialUrl}`)
  }
  if (item.caution) {
    lines.push(`注意：${item.caution}`)
  }
  lines.push('', `核验日期：${item.lastVerified}｜来自「没钱 No Money」`)

  return lines.join('\n')
}

/**
 * 优先调用系统分享（手机上可直接发微信）；不支持时复制到剪贴板。
 * 用户主动取消系统分享时抛 AbortError，由调用方静默处理。
 */
export async function shareRightsText(title: string, text: string): Promise<RightsShareMode> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch (error) {
      if (isAbortError(error)) throw error
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return 'copied'
  }
  throw new Error('当前浏览器不支持系统分享或复制，请手动复制')
}
