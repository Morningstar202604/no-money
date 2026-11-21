/**
 * 判断错误是否为「用户/代码主动取消」。
 *
 * 不用 `instanceof DOMException`：部分旧 WebView 没有 DOMException 构造函数，
 * 取消会被误判成失败并再弹一次错误；按 `name` 判断更稳。
 * 这个判断此前在权益分享、规则加载、AI 请求三处各写一遍，且后两处口径更弱，
 * 统一到这里，避免某处改了口径另一处没改。
 */
export function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && 'name' in error && (error as { name?: unknown }).name === 'AbortError'
}
