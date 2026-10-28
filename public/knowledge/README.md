# 没钱 No Money 知识库（Agent / RAG 摄取说明）

`kb.json` 由 `npm run kb:export` 生成（源码：`src/utils/knowledge.ts`）。
内容为「政策原文索引 + 办事手册 + 现实核查 + 本城参数溯源」的统一结构化条目，
全部带官方链接，可直接作为外部 Agent / RAG 管道的语料。

## 文件

| 文件 | 说明 |
|---|---|
| `kb.json` | 全量条目（34 城规则溯源 309 条 + 静态政策 17 / 手册 26 / 现实核查 23，合计 375 条，`npm run kb:check` 校验同步） |
| `README.md` | 本说明 |

## 条目结构（schemaVersion = 1）

```jsonc
{
  "id": "guide-personal-pension",   // 稳定 id，一经发布不改义、不复用
  "type": "policy | guide | reality | source",
  "category": "保险与税优：怎么省税",  // 中文分类（稳定枚举，只允许追加）
  "title": "个人养老金：一年能省多少税？",
  "summary": "每年最多 12,000 元：交的时候抵税、赚的时候免税、领的时候只按 3% 交税。",
  "keyPoints": ["缴费：按 12,000 元/年限额据实扣除", "..."],
  "numbers": [{ "label": "年缴费扣除限额", "value": "12,000 元" }],
  "steps": ["在银行 APP 开立个人养老金账户…"],
  "notes": ["注意：账户资金原则上退休后才能领取…"],
  "docNo": "人社部发〔2024〕87号",     // 文号（如有）
  "confidence": "官方文件",            // source/reality 条目的证据等级
  "city": "guangzhou",                 // source 条目所属城市
  "tags": ["手册", "taxsave"],
  "links": [{ "title": "关于全面实施个人养老金制度的通知", "url": "https://..." }]
}
```

## 摄取建议

- 切块：按条目切块（一条 ≈ 一个语义单元，无需再切）；过长条目可再拆 `summary / keyPoints / steps`。
- 嵌入文本建议：`title + summary + keyPoints + numbers`（`notes` 为免责/核对信息，可单独存元数据）。
- `links[].url`：官方条目均带原文链接；`unverified` 的溯源条目可能没有链接（无公开来源），其 `notes` 会写明「占位/未回溯」，不可当作官方口径引用。
- 回答涉及政策时应引用 `docNo` 与链接；没有链接的条目只能作为「待核验线索」使用。
- 引用纪律：`confidence = 经验·待自验` 的条目没有权威统计支撑，只可作提示，不可作为事实断言。

## 最小示例（Node）

```js
// package.json 是 "type": "module"，require() 会直接报错，用 ESM 读取
import { readFileSync } from 'node:fs'
const kb = JSON.parse(readFileSync(new URL('./kb.json', import.meta.url), 'utf8'))
const hits = kb.entries.filter(e => e.title.includes('个人养老金'))
console.log(hits[0].links[0].url)
```

## 页面内检索

应用内「政策百科 → 知识库」页签使用同一份数据的纯本地检索
（`searchKnowledge`，中英混合分词，无网络依赖；AI 助手在离线模式下也会先检索知识库再作答）。
