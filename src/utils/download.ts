/**
 * 浏览器端文件下载（纯前端，无需后端）。
 *
 * 抽成独立模块的原因：项目里有两处手写实现（参数导出、文书下载），
 * 且行为不一致——一处把 <a> 挂到 DOM 再移除、一处没有。Firefox 对未挂载
 * 的 <a> 触发 click() 会静默失败，导致「点了下载没反应」。
 *
 * 统一实现：挂载 → 点击 → 移除 → 释放 object URL（顺序不能颠倒，
 * 先 revoke 再 click 会让下载拿不到内容）。
 */

export interface DownloadOptions {
  /** 文件名（含扩展名） */
  filename: string
  /** 内容 */
  content: string
  /** MIME 类型，默认 text/plain;charset=utf-8 */
  mimeType?: string
}

/** 触发一次浏览器下载；返回是否成功发起（不保证用户已保存） */
export function downloadTextFile({ filename, content, mimeType = 'text/plain;charset=utf-8' }: DownloadOptions): boolean {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return false
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  try {
    anchor.click()
    return true
  } finally {
    document.body.removeChild(anchor)
    // 延迟释放：部分浏览器在 click() 同步返回后仍在读取 blob
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

/** 复制文本到剪贴板；优先 Clipboard API，失败回退 execCommand */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 权限被拒或非安全上下文，继续尝试回退方案
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
