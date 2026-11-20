/**
 * 「我的清单」导出/打印。
 *
 * 只接收用户已保存/已办的条目，不读取城市、身份、工资；导出的纯文本
 * 不含身份证、手机号、银行卡，适合发给家人或带到窗口。
 */
import type { RightsItem } from '../data/rights/catalog'

function status(item: RightsItem, done: (id: string) => boolean): string {
  return done(item.id) ? '已办' : '待办'
}

function exportedAt(): string {
  return new Date().toISOString().slice(0, 10)
}

function listHeading(title?: string): string {
  return title ? `没钱 No Money · ${title}` : '没钱 No Money · 我的办事清单'
}

export function buildChecklistText(
  items: RightsItem[],
  done: (id: string) => boolean,
  date = exportedAt(),
  title?: string,
): string {
  const lines = [
    listHeading(title),
    '本清单保存在本机；不含身份证、工资、城市信息。',
    `导出日期：${date}`,
    '',
  ]
  if (!items.length) {
    lines.push('清单为空。先到办事入口勾选「加入清单」。')
  }
  items.forEach((item, index) => {
    lines.push(`${index + 1}. [${status(item, done)}] ${item.title}`)
    lines.push(`   一句话：${item.oneLiner}`)
    if (item.deadline) lines.push(`   时限：${item.deadline}`)
    lines.push(`   去哪办：${item.whereToGo}`)
    if (item.officialUrl) lines.push(`   官方入口：${item.officialUrl}`)
    lines.push('')
  })
  lines.push('提醒：金额、比例、截止日期以当地最新文件为准；本平台不代办、不代缴。')
  return lines.join('\n')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function buildChecklistHtml(
  items: RightsItem[],
  done: (id: string) => boolean,
  date = exportedAt(),
  title?: string,
): string {
  const rows = items.length
    ? items.map((item, index) => `
      <article class="item ${done(item.id) ? 'done' : ''}">
        <div class="head"><span class="no">${index + 1}</span><h2>${escapeHtml(item.title)}</h2><span class="status">${status(item, done)}</span></div>
        <p>${escapeHtml(item.oneLiner)}</p>
        ${item.deadline ? `<p><b>时限：</b>${escapeHtml(item.deadline)}</p>` : ''}
        <p><b>去哪办：</b>${escapeHtml(item.whereToGo)}</p>
        ${item.officialUrl ? `<p class="url"><b>官方入口：</b>${escapeHtml(item.officialUrl)}</p>` : ''}
      </article>`).join('')
    : '<p class="empty">清单为空。先到办事入口勾选「加入清单」。</p>'

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${escapeHtml(listHeading(title))}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 28px; color: #1a1a1a; font: 13px/1.65 -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
  header { border-bottom: 2px solid #1a1a1a; padding-bottom: 10px; margin-bottom: 16px; }
  h1 { margin: 0; font-size: 20px; }
  .meta { margin: 4px 0 0; color: #555; font-size: 12px; }
  .item { border: 1px solid #d8d8d8; border-radius: 6px; padding: 10px 12px; margin: 0 0 10px; break-inside: avoid; }
  .item.done { border-color: #2f8f4e; }
  .head { display: flex; align-items: baseline; gap: 8px; }
  .no { color: #777; font-size: 12px; }
  h2 { flex: 1; margin: 0; font-size: 15px; }
  .status { flex: none; color: #777; font-size: 12px; }
  .item.done .status { color: #2f8f4e; font-weight: 700; }
  p { margin: 6px 0 0; }
  b { font-weight: 600; }
  .url { color: #555; word-break: break-all; }
  .empty { color: #777; }
  footer { margin-top: 16px; padding-top: 10px; border-top: 1px solid #d8d8d8; color: #666; font-size: 12px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<header><h1>${escapeHtml(listHeading(title))}</h1><p class="meta">本清单保存在本机；不含身份证、工资、城市信息。导出日期：${escapeHtml(date)}</p></header>
${rows}
<footer>提醒：金额、比例、截止日期以当地最新文件为准；本平台不代办、不代缴。</footer>
</body>
</html>`
}
