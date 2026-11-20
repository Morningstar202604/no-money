# 工程管理手册

> 这份文档回答三个问题：**怎么保证没坏、怎么保证不变慢、怎么保证不跑偏。**
> 产品定位见 [`POSITIONING.md`](POSITIONING.md)，范围与内容标准见
> [`REALITY-AND-SCOPE.md`](REALITY-AND-SCOPE.md)。

## 1. 当前基线（2026-11-20）

| 项目 | 结果 |
|---|---|
| 单元/对拍/组件测试 | **60 文件 / 1,159 项全过**，耗时 421.13s |
| E2E | **8 文件 / 118 项全过**（desktop-chromium + mobile-chromium，5.2m） |
| 类型检查 | `typecheck` + `typecheck:test` 通过 |
| 引擎闭合 | `verify` 通过 |
| 现实数据 | `verify:reality` 通过（S6 全职缴最低基数、S7 退休面板口径） |
| 知识库 | `kb:check` 375 条与数据源一致 |
| 四入口一致 | `verify:entrypoints` 广州 6843.7 / 深圳 7924.77；34 城全部可计算 |
| 构建 | 23.52s；`dist` **3.38 MB**（assets 2.55 MB）；首屏 **408K gzip**（预算 500K） |
| PWA | 50 条 precache / **2,787.97 KiB（约 2.72 MB）**（预算 3 MB） |
| 健康检查 | `doctor` 全部通过（26 个关键文件、版本三处一致、34 城、PWA、体积、文档） |
| 依赖漏洞 | `npm audit --audit-level=high` **0 vulnerabilities** |
| 运行环境 | Node `v22.23.4`，npm `10.9.9` |

关键 chunk（gzip）：

| chunk | 大小 | 说明 |
|---|---:|---|
| `index` | 73.75K | 应用入口 + 布局 + 首屏组件 |
| `naive-ui` | 176.19K | 首屏最大依赖 |
| `vendor-misc` | 117.65K | 其余运行时依赖 |
| `vendor-util` | 29.89K | 工具库 |
| `vendor-vue` | 20.00K | Vue 运行时 |
| `RightsView` | 27.00K | 路由懒加载 |
| `EmployeeView` | 3.45K | 企业职工工资条页，路由懒加载 |
| `PolicyView` | 8.33K | 政策页，34 城总览按页签懒加载 |
| `echarts` | 294.44K | 仅图表页加载，未进首屏 |

## 2. 质量门禁

### 本地提交前

```bash
npm run typecheck
npm run typecheck:test
npm test
npm run verify
npm run verify:reality
npm run kb:check
npm run freshness:check
npm run verify:entrypoints
npm run build
npm run doctor
```

任何一项失败都不提交。只改文档时至少跑 `npm run doctor`（它会检查 README 链接、
测试数字、版本、PWA 产物与体积）。

### CI

`.github/workflows/ci.yml` 两个 job；另有 `.github/workflows/freshness.yml` 每月 1 日检查 34 城来源是否超过 365 天：

| job | 内容 |
|---|---|
| `verify` | Node 22 / `npm ci` / typecheck / typecheck:test / test / verify / verify:entrypoints / build:entries / doctor / verify:reality / kb:check / **freshness:check** / build / 无 sourcemap 检查 / `npm audit --audit-level=high` |
| `e2e` | 安装 Chromium / `npm run test:e2e` / 失败上传 `playwright-report` 与 `test-results` |
| `freshness` | 月度/手动 `npm run freshness:check`；失败时列出超期城市 + 字段，并自动开/更新 issue（GitHub Actions） |
| `dependabot-auto-merge` | 仅开发依赖 minor/patch 自动合并；生产依赖、Cargo 和 major 仍人工 |

已知缺口：CI 未缓存 Playwright 浏览器；`rules:verify` 依赖本地 `.rules-snapshots`，
CI 没有快照，因此不跑（本地需要时手动跑）。这两项是 P1，不是当前故障。

### E2E 本地运行

```bash
PLAYWRIGHT_BROWSERS_PATH=/home/user/.cache/ms-playwright npx playwright test
```

默认环境变量可能指向 `/opt/vm/preinstall/ms-playwright`（旧 chromium-1169），会报浏览器缺失。
这是环境差异，不是测试失败。

## 3. 性能与加载策略

### 预算

| 指标 | 预算 | 当前 | 触发动作 |
|---|---:|---:|---|
| 首屏 JS（gzip） | 500K | 408K | 超 500K 阻断 |
| `dist` 总量 | 5 MB | 3.38 MB（assets 2.55 MB） | 超 5 MB 阻断 |
| PWA precache | 3 MB | 2.72 MB | 超 3 MB 警告，超 3.2 MB 阻断 |
| 单 chunk | 1 MB | 864K（echarts） | 超 1 MB 检查是否同步引入 |
| LCP（4G） | 2.5s | 未测 | P1 接 Lighthouse CI |
| CLS | 0.1 | 未测 | P1 |

### 加载策略

1. **路由级懒加载**：10 个视图各自 chunk；首页只加载当前路由。
2. **ECharts 懒加载**：`ChartBox` 异步 import，`echarts` 不进首屏；`doctor` 会检查。
3. **PWA**：
   - app shell（HTML/CSS/入口 JS/图标）precache；
   - `rules/*.json` 与 `knowledge/*.json` 用 StaleWhileRevalidate，允许离线读旧政策；
   - 不缓存用户输入、AI Key、对话内容；
   - `navigateFallback` 与 `start_url`/`scope` 跟随 `VITE_BASE`，支持 `/app/` 子路径。
4. **chunk 加载失败**：路由守卫捕获动态 import 失败，提示刷新；不把白屏留给用户。
5. **首屏组件**：`ChatAssistant` 与 `CommandPalette` 目前静态 import，但二者都不大；
   若首屏逼近 450K，优先把 `CommandPalette` 改成 `v-if="paletteOpen"` + 异步组件，
   而不是删功能。

### 子路径部署

`VITE_BASE=/no-money/ npm run build` 必须同时满足：

- 路由 `createWebHistory(import.meta.env.BASE_URL)`
- `index.html` 的 `canonical` / `apple-touch-icon` / `og:image` 用 `%BASE_URL%`
- manifest `start_url` / `scope` 用 `BASE`
- `navigateFallback` 用 `${BASE}index.html`
- `navigateFallbackDenylist` 不锚定根路径（`/\/rules\//`，不是 `/^\/rules\//`）

`tests/architecture.spec.ts` 不检查 HTML；`npm run build && npm run doctor` 是这条链路的门禁。

## 4. 软件工程管理

### 分支与提交

- `main` 保持可发布；功能分支 `feat/<topic>`，修复分支 `fix/<topic>`。
- Conventional Commits，命令式；一个提交只做一件事，重构与行为变更分开。
- 提交信息写「为什么」和「口径变化」，不只写「改了文件」。
- 本地提交不自动推送；推送前确认 remote 与目标仓库（GitCode / GitHub 镜像）。

### 版本与发布

见 [`VERSIONING.md`](VERSIONING.md)。三处版本必须一致：
`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml`。
`node scripts/bump-version.mjs X.Y.Z` 一次改三处。

发布前：

```bash
npm run typecheck && npm run typecheck:test && npm test
npm run verify && npm run verify:reality && npm run kb:check && npm run verify:entrypoints
npm run build && npm run doctor
PLAYWRIGHT_BROWSERS_PATH=/home/user/.cache/ms-playwright npx playwright test
```

### 依赖策略

- 生产依赖保持 5 个；新增依赖必须回答「平台原生能力为什么不够」。
- 安全补丁随时升；major 升级一次一个 PR，跑完整门禁，记录 before/after 包体。
- 当前待升级 major：`pinia 4`、`vue-router 5`、`vite 8`、`typescript 7`、`vitest 5`。
  这些不是漏洞，是技术债；不在权益导航 P0 期间混做。

### 文档纪律

- 定位只认 `docs/POSITIONING.md`；范围只认 `docs/REALITY-AND-SCOPE.md`；
  工程只认本文档。三处冲突时，先改文档再改代码。
- `README` 首屏、`package.json` description、`index.html` meta、PWA manifest、OG 图
  必须说同一句话；`doctor` 的定位一致性检查会拦旧文案。
- `AGENTS.md` 是 AI/新人的入口，改架构或门禁时同步更新。

## 5. 项目高级管理

### 决策记录（ADR）

| ID | 决策 | 理由 | 影响 |
|---|---|---|---|
| ADR-001 | 权益导航是主产品，计算器是工具 | 用户要的是「该做什么/能拿什么/去哪办」，不是又一个算薪器 | 首页四入口、IA v2、文案 |
| ADR-002 | 不做后端、不做账号 | 数据不出设备是信任前提；权益内容不需要登录 | 所有功能本地化；PWA 优先 |
| ADR-003 | 四入口只走 `kernel/calculate.ts` | 两套公式 = 两个答案 | CLI/API/MCP/Web 共用内核 |
| ADR-004 | 规则参数三级置信度，权益内容四级 | 政策数字必须可追溯；平台估算必须显式标注 | `sources` / `confidence` / `lastVerified` |
| ADR-005 | 没有依据就留空/标注，不编数字 | 错一个数比少一个功能更伤信任 | 内容模板、助手回答、OG 图禁用假金额 |

### 风险登记

| ID | 风险 | 概率 | 影响 | 缓解 | 状态 |
|---|---|---|---|---|---|
| R1 | 对外元数据回到旧定位 | 中 | 高 | `doctor` 定位检查 + 本文档 | 已修 |
| R2 | 新代码继续 import 旧 engine | 中 | 中 | `tests/architecture.spec.ts` 允许清单 | 已加门禁 |
| R3 | PWA precache 逼近 3 MB | 中 | 中 | `doctor` 体积检查；必要时把 ECharts 排除出 precache | 监控 |
| R4 | E2E 只有 Chromium | 高 | 中 | 后续加 WebKit/Firefox；mobile-chromium 不是真 iOS | 接受 |
| R5 | 源码文本测试膨胀 | 中 | 中 | AGENTS 例外条款；视觉/布局必须挂载测试 | 监控 |
| R6 | major 依赖长期不升 | 高 | 中 | 权益 P0 后逐个升级，完整门禁 | 延后 |
| R7 | 权益内容深度不足 | 高 | 高 | 3.6.6 已建 60 条（23 迁移 + 20 新增 L2 + 17 条 L1），30 条 L2、30 条 L1；10 城四类入口 | 达标，长尾继续补 |
| R8 | 34 城平台单价全为 unverified | 确定 | 高 | 只做「算一算」，不当工资展示；用户自填单价 | 接受 |
| R9 | 无视觉回归 | 高 | 中 | P1 加四入口/向导截图对比 | 待办 |
| R10 | `rules:verify` 不在 CI | 中 | 低 | 本地快照 + 手动跑；或 CI 生成快照 | 接受 |
| R11 | `madge` 无法解析 `.vue` | 高 | 低 | 架构测试 + build/typecheck 兜底；P1 换 dependency-cruiser | 接受 |
| R12 | `naive-ui` 首屏 176K | 中 | 低 | 在预算内；逼近 450K 时再优化 | 接受 |

### 运营节奏

| 周期 | 动作 | 产出 |
|---|---|---|
| 每周 | 新增权益条目、核对用户反馈中的错数 | 条目 PR + 回归测试 |
| 每月 | 官方链接健康检查、`npm audit`、包体复盘 | 链接报告 / 依赖报告 |
| 每季度 | 政策锚点复核（社保基数、最低工资、医保等待期、公积金） | `lastVerified` 更新 |
| 每半年 | 路线图重排、技术债盘点 | ROADMAP 更新 |

### 指标

- 测试：1,172 项（61 个文件；含 5 项架构门禁 + 权益导航/城市入口测试）；覆盖率报告待接入（目标 domain/application ≥80%）。
- 首屏：408K gzip；PWA：2.72 MB；`dist`：3.38 MB（assets 2.55 MB）。
- 数据：309 条来源，official 127（41.1%）、derived 40、unverified 142；34 城；0 城四字段全 official。20 城养老基数已完成核验（17 城 official，长春、贵阳、哈尔滨因官方只公布平均工资而标 derived）；海口、合肥、南宁、西宁、银川 5 城最低工资已核验为 official，其余字段仍按原置信度保留。
- 内容：`RightsItem` 60 条（23 条迁移 + 20 条新增 L2 + 17 条 L1）；其中 30 条 L2、30 条 L1；已到 60+ 目标。
- 可用性：E2E 120 项（8 个文件，桌面 + 移动）；清单导出/打印有 E2E 下载断言；无 Crash-free 指标（无后端、无埋点，不做假指标）。

## 6. 模块化与架构边界

### 分层

`views → components → stores → application → domain`，单向。
`kernel` 只被 `cli/`、`mcp/`、`server/`、`src/app` 引用；入口层不得直接 import
`domain` 或 `application`。`domain` 不 import Vue/Pinia/stores/components/views/engine，
不碰 `localStorage` / `fetch` / `XMLHttpRequest`。

### 旧引擎

`src/engine` 是迁移期遗留。生产代码只允许三个文件 import：

- `src/components/panels/TaxOptimizer.vue`
- `src/components/panels/RetirementPlanner.vue`
- `src/utils/pensionSeries.ts`（仅类型）

`ScenarioEngine` / `IncomeEngine` 只被 parity 测试使用。新增代码一律走
`domain` + `application`。移除计划见 [`../src/engine/README.md`](../src/engine/README.md)。

### 内容层

权益内容应放在 `src/data/rights/`（3.5.0 建立，3.5.1 增加清单 store，3.6.0 增加 30 条 L2），使用 `RightsItem` 类型；城市入口在 `src/data/cityChannels.ts`（10 城 × 4 类），与 `provinceChannels.ts` 分层。
不要继续往 `src/utils/livingGuide.ts` 堆字符串。内容层不参与计算内核，
不 import `domain` 的金额函数。

## 7. 数据治理

- **规则可以算，标准不能编**：计算可以用公式，政策金额/比例必须有 `official` 来源。
- 规则参数三级：`official` / `derived` / `unverified`；权益内容四级，多一个 `platform`。
- 平台单价 34/34 为 `unverified`，只能用于「算一算」，不得作为「工资」展示。
- 每个条目带 `lastVerified`；超过 12 个月标「待复核」。
- 官方链接每月检查；死链标记，不静默保留。
- 新增城市/条目必须带来源与 `retrievedAt`；`tests/cities.spec.ts` 与 `rulesGate` 会拦。

## 8. 测试策略

| 层 | 范围 | 规则 |
|---|---|---|
| 单元 | `domain` 公式、边界、退化输入 | 每个公式至少一个手算基准 |
| 对拍 | 新旧引擎 | 21 个用例；删旧引擎前必须先删对拍 |
| 服务 | `application` 编排 | 不 mock 公式，只 mock I/O |
| 组件 | 挂载级 | 交互、空态、错误态、窄屏 |
| 接线 | 静态契约 | 仅路由表/页签/静默失败等无法挂载的结构 |
| E2E | 真实路径 | 桌面 + 移动；离线、分享、导入导出 |
| 架构 | 分层/入口/引擎 | `tests/architecture.spec.ts` |

源码文本断言只允许「静态接线契约」，不得断言样式/布局；新增此类测试必须在注释里
说明为什么不能挂载。

## 9. 发布检查清单

- [ ] 版本三处一致，CHANGELOG 有 `[Unreleased]` 条目
- [ ] 全部门禁绿（第 2 节）
- [ ] `dist` / 首屏 / PWA 体积在预算内
- [ ] 新增/修改的政策数字有 `official` 来源与 `lastVerified`
- [ ] 新增页面有 h1、空态、窄屏 320px 无溢出
- [ ] 分享图/标题/描述与定位一致
- [ ] 子路径构建抽查（`VITE_BASE=/no-money/ npm run build`）
- [ ] 本地提交已整理，未推送的说明写在交付里

## 10. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-11-19 | 建立本文档；基线全绿；修复旧定位元数据、PWA 子路径、README 34% 错数；新增架构门禁与旧引擎允许清单 |
