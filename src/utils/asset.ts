/**
 * 静态资源 URL 解析。
 *
 * 为什么需要：`public/` 下的文件此前都按根路径硬编码（`/rules/x.json`、
 * `/maps/china.json`、`/knowledge/kb.json`）。应用部署到子路径（如
 * `https://host/app/`）时这些请求会全部 404，首屏白屏且没有任何提示。
 * Vite 的 `import.meta.env.BASE_URL` 在构建时由 `base` 注入（默认 `/`），
 * 所有运行时资源引用都必须经过这里。
 */

/** 把 public 下的相对路径解析成带 base 前缀的绝对路径 */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const clean = path.replace(/^\/+/, '')
  return `${base}${clean}`
}
