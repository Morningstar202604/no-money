# 工程管理手册

> 这份文档回答三个问题：**怎么保证没坏、怎么保证不变慢、怎么保证不跑偏。**
> 产品定位见 [`POSITIONING.md`](POSITIONING.md)，范围与内容标准见
> [`REALITY-AND-SCOPE.md`](REALITY-AND-SCOPE.md)。

## 1. 当前基线（2026-11-22）

| 项目 | 结果 |
|---|---|
| 单元/组件/规则测试 | **71 文件 / 900 项全过**，耗时 5m39s |
| E2E | **11 文件 / 152 项全过**（含 4 条视觉基线、首帧壳、naive-ui 拆包与 ARIA 关系断言，6.6 分钟） |
| 可访问性 | 10 条路由 Lighthouse 12 mobile `accessibility` **1.00**；`color-contrast` / `aria-*` / `button-name` / `link-in-text-block` 0 失败 |
| 覆盖率 | `domain` + `application`：语句 **90.6%** / 分支 **80.19%** / 函数 **96.36%** / 行 **94.96%**，四项门槛均 80% |
| 依赖环 | `dependency-cruiser` 扫描 `src`（含 `.vue`）：**143 模块 / 333 依赖 / 0 环** |
| 视觉回归 | 首页首屏 + 向导第二步，桌面/移动共 4 张基线；桌面 4% / 移动 6% 像素容差，向导固定滚动位置，另锁 4 入口/4 身份/无横向溢出 |
| 类型检查 | `typecheck` + `typecheck:test` 通过 |
| 引擎闭合 | `verify` 通过 |
| 现实数据 | `verify:reality` 通过（S6 全职缴最低基数、S7 退休面板口径） |
| 知识库 | `kb:check` 409 条与数据源一致 |
| 四入口一致 | `verify:entrypoints` 广州 6843.7 / 深圳 7924.77；34 城全部可计算 |
| 构建 | 23.79s；`dist` **3.50 MB**（assets 2.61 MB）；首屏 **193K gzip**（预算 300K） |
| PWA | 75 条 precache（72 个去重文件）/ **2,852.26 KiB（约 2.78 MB）**（预算 3 MB） |
| 健康检查 | `doctor` 全部通过（25 个关键文件、版本三处一致、34 城、PWA、体积、文档、首屏依赖） |
| 依赖漏洞 | `npm audit --audit-level=high` **0 vulnerabilities** |
| 运行环境 | Node `v22.23.4`，npm `10.9.9` |

关键 chunk（gzip）：

| chunk | 大小 | 说明 |
|---|---:|---|
| `index` | 28.92K | 应用入口 + 布局 + 首屏原生组件 |
| `naive-ui` | 176.19K | **按需**：进算一算/政策/权益等页面才下载 |
| `vendor-misc` | 118.80K | 其余运行时依赖 |
| `vendor-util` | 29.89K | 工具库 |
| `vendor-vue` | 20.01K | Vue 运行时 |
| `RightsView` | 27.14K | 路由懒加载 |
| `AdminView` | 2.92K | 34 城治理面板，复用 `cityRules` + `useCityRules` |
| `AuditView` | 2.20K | 34 × 7 核验矩阵，复用 `cityRules` + `useCityRules` |
| `RightsItemCard` | 4.41K | 权益卡入口，详情按需拆到 GuideCard |
| `RightsStartView` | 12.25K | 办事首页与我的清单，含整张清单分享 |
| `EmployeeView` | 5.25K | 企业职工工资条页，路由懒加载 |
| `PolicyView` | 8.44K | 政策页，34 城总览按页签懒加载 |
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

### 可访问性

- 语义文字色只走 `--color-text-*` 语义 token；浅色 700 档 / 深色 400 或亮色档都必须对白底、
  浅品牌底和浅成功/警告/危险底 ≥ 4.5:1。`tests/a11yContrast.spec.ts` 直接解析
  `variables.css` 并解开 `var()` 链，改值会重新计算，不锁死十六进制。
- 正文内的品牌链接必须带下划线：`#0f766e` 与 `#475569` 在正文里只有 1.38:1，
  仅靠颜色无法区分（WCAG 1.4.1）。
- naive-ui 2.38 自身漏掉的 ARIA 由 `src/app/naiveA11y.ts` 补齐：卡片标题层级、滑块名称、
  数字输入加减按钮、preset-card 对话框名称。业务侧另外显式给开关和引导弹窗加名称；
  补齐层只补缺失属性，不覆盖已有名称。
- 发布前对 `/start`、`/dashboard`、`/employee`、`/guides`、`/scenario`、`/planning`、
  `/rights`、`/policy`、`/admin`、`/audit` 跑 Lighthouse 12 mobile `accessibility`，
  任何一项低于 1.00 都要先定位，不把失败项写成“已知问题”。

## 3. 性能与加载策略

### 预算

| 指标 | 预算 | 当前 | 触发动作 |
|---|---:|---:|---|
| 首屏 JS（gzip） | 300K | 193K | 超 300K 阻断 |
| `dist` 总量 | 5 MB | 3.50 MB（assets 2.60 MB） | 超 5 MB 阻断 |
| PWA precache | 3 MB | 2,849.51 KiB / 75 条 | 超 3 MB 警告，超 3.2 MB 阻断 |
| 单 chunk | 1 MB | 864K（echarts，按需） | 超 1 MB 检查是否同步引入 |
| FCP（4G） | 2.5s | 2.2–2.3s simulate / 1.6s devtools | 达标 |
| LCP（4G） | 2.5s | 2.3s simulate / 1.6s devtools | 达标 |
| CLS | 0.1 | 0 | 达标 |
| TBT（4G，4x CPU） | 200ms | 50ms 中位数 simulate（0–333ms）/ 约 600ms devtools | simulate 中位数达标但 5 次中 2 次超；4x CPU 仍超 |

### 加载策略

1. **路由级懒加载**：10 个视图各自 chunk；首页只加载当前路由。
2. **ECharts 懒加载**：`ChartBox` 异步 import，`echarts` 不进首屏；`doctor` 会检查。
3. **PWA**：
   - app shell（HTML/CSS/入口 JS/图标）precache；
   - `rules/*.json` 与 `knowledge/*.json` 用 StaleWhileRevalidate，允许离线读旧政策；
   - 不缓存用户输入、AI Key、对话内容；
   - `navigateFallback` 与 `start_url`/`scope` 跟随 `VITE_BASE`，支持 `/app/` 子路径。
4. **chunk 加载失败**：路由守卫捕获动态 import 失败，提示刷新；不把白屏留给用户。
5. **首屏壳**：`index.html` 在入口 JS 到达前渲染品牌、标题与目录计数；`src/main.ts`
   等 `router.isReady()` 后双 rAF 移除，应用级错误兜底也先移除。它把“白屏等待”换成
   “可读的品牌页”，不减少 193K 首屏 JS；LCP 由它先拿到 2.3s simulate。
6. **首页减负**：`ParamSidebar` 只在 `/dashboard`、`/scenario`、`/planning` 挂载，首页/
   权益/政策/数据页不再挂按单参数；首页条目列表用 `content-visibility: auto` 延后屏外布局。
7. **naive-ui 拆出首屏**：`App.vue` 不再挂 `NConfigProvider` / `NMessageProvider`；
   `NaiveShell.vue` 只在使用 naive 组件的路由、参数侧栏、AI 面板里异步挂载。
   `/start` 的向导、按钮、城市选择与提示条改成原生控件；`ParamSidebar`、
   `ChatAssistant` 都改为 `defineAsyncComponent`，AI 只留一个原生 `ChatLauncher` 悬浮按钮。
   首屏 JS 从 410K 降到 193K，naive-ui 的 176K 只在进算一算/政策/权益等页面时下载。
8. **首屏门禁**：`doctor` 把首屏预算从 500K 收到 300K，并禁止 `echarts` / `naive-ui`
   出现在入口 `modulepreload`；`e2e/start-shell.spec.ts` 额外断言 `/start` 不请求
   `naive-ui`、`/dashboard` 才请求，防止 Provider 又回到根组件。

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
| R9 | 无视觉回归 | 高 | 中 | `e2e/visual.spec.ts` 四张基线（首页 + 向导，桌面 + 移动） | 已接（0.0.44） |
| R10 | `rules:verify` 不在 CI | 中 | 低 | 本地快照 + 手动跑；或 CI 生成快照 | 接受 |
| R11 | `madge` 无法解析 `.vue` | 高 | 低 | `dependency-cruiser` 扫描 `src`（含 `.vue`），0 环；架构测试 + build/typecheck 兜底 | 已接（0.0.44） |
| R12 | `naive-ui` 首屏 176K | 中 | 低 | 已拆到异步 `NaiveShell`，首屏 193K；`doctor` + E2E 双门禁（0.1.0） | 已解决 |

### 运营节奏

| 周期 | 动作 | 产出 |
|---|---|---|
| 每周 | 新增权益条目、核对用户反馈中的错数 | 条目 PR + 回归测试 |
| 每月 | 官方链接健康检查、`npm audit`、包体复盘 | 链接报告 / 依赖报告 |
| 每季度 | 政策锚点复核（社保基数、最低工资、医保等待期、公积金） | `lastVerified` 更新 |
| 每半年 | 路线图重排、技术债盘点 | ROADMAP 更新 |

### 指标

- 测试：900 项（71 个文件；含架构门禁、权益导航、34 城加载与覆盖分母、值对象/Result/错误工厂边界、语义色对比度与 naive-ui ARIA 关系）；覆盖率已接入 CI，`domain` + `application` 四项均 ≥80%（语句 90.6% / 分支 80.19% / 函数 96.36% / 行 94.96%）。
- 质量门禁：`npm run test:coverage` 与 `npm run lint:cycles` 已进入 CI；循环依赖 0 环；视觉回归 4 张基线。
- 首屏：193K gzip；PWA：2.78 MB（75 条 precache / 72 个去重文件）；`dist`：3.50 MB（assets 2.60 MB）。
- 数据：343 条来源，official 225（65.6%）、derived 50、unverified 68；34 城；0 城全部字段 official。34 城医保基数 official 33 / derived 1（郑州按社平 80% 派生）；医保费率 official 27 / derived 7 / unverified 0（西安 2026 已升 official，石家庄到期降 derived）；34 城最低工资全部 official；养老基数 official 31 / derived 3；养老金计发基数 official 27 / derived 7 / unverified 0（西安 7881 凭陕人社函〔2025〕425号扫描件升 official；2026 已公布 10 城，其余 24 城按 2025 年预发）。
- 内容：`RightsItem` 60 条（23 条迁移 + 20 条新增 L2 + 17 条 L1）；其中 30 条 L2、30 条 L1；已到 60+ 目标。
- 教程：`/guides` 只列 8 类 18 条 L2（social / medical / housing / unemployment / birth / injury / retire / subsidy）；每条有至少一条用户原话别名，支持大白话搜索；权益卡可系统分享或复制文案给工友，我的清单/向导结果可整张分享；L1 留在「该做什么」，高温/税优/维权不进首屏。
- 前端去重（0.0.39–0.0.41）：页面标题只在 `src/app/pageTitles.ts` 维护；`/rights` 三页签可深链；`/start?entry=social` 补 5 条未展开 L2；`/dashboard` 可点进 `/scenario`；`/policy?tab=manual` 只保留 2 条站内无入口的概念正文，其余 21 条改入口；`/admin` 与 `/audit` 共用 `src/data/cityRules.ts`，明确 225/343 条与 186/238 格两个分母。
- 新毕业生：`/employee` 支持试用期 + 转正两段工资；12 个月变额求和算年度个税，两段月到手按年度平均税负折算并标注；居民模式仍缺城市级缴费数据。
- 清单提醒：`checklistCalendar` 生成 RFC 5545 `.ics`，日期只存本机；中国时间 09:00，3 天前与当天两次提醒；不接账号、推送或云端日历。
- 可用性：E2E 152 项（11 个文件，桌面 + 移动）；首帧壳先可见、路由就绪后移除；首页不请求 naive-ui；六段导航、`/guides` 分类筛选与大白话搜索、权益卡分享、整张清单分享、清单日历提醒、新毕业生双段工资、`/rights` 页签深链、`/start` 的 5 条补位、`/policy` 手册入口与 `/admin` 两个覆盖分母有 E2E；标题层级、滑块、数字按钮、对话框与正文链接有 ARIA/下划线断言；首页首屏与向导第二步有视觉基线；清单导出/打印/.ics 有下载断言；无 Crash-free 指标（无后端、无埋点，不做假指标）。

## 6. 模块化与架构边界

### 分层

`views → components → stores → application → domain`，单向。
`kernel` 只被 `cli/`、`mcp/`、`server/`、`src/app` 引用；入口层不得直接 import
`domain` 或 `application`。`domain` 不 import Vue/Pinia/stores/components/views，也不碰 `localStorage` / `fetch` / `XMLHttpRequest`。

### 单一计算路径

0.0.43 已删除迁移期的 `src/engine`：`TaxOptimizer`、`RetirementPlanner` 与 `pensionSeries`
全部改走 `domain`（页面只经 `adapters/ruleAdapters.ts` 做元↔分边界转换），`scripts/verify-engines.ts`
只验生产路径 `ScenarioService`，不再保留旧引擎对拍。`tests/architecture.spec.ts` 会在
`src/engine` 重新出现或任何源码 import `engine/` 时失败。

新增计算逻辑一律走 `domain` + `application`；页面不得再自建税表、退休复利或社保公式。

### 内容层

权益内容应放在 `src/data/rights/`（3.5.0 建立，3.5.1 增加清单 store，3.6.0 增加 30 条 L2），使用 `RightsItem` 类型；城市入口在 `src/data/cityChannels.ts`（10 城 × 4 类），与 `provinceChannels.ts` 分层；34 城规则加载与覆盖率统计只在 `src/data/cityRules.ts`，页面不再各自 fetch 与 reduce。
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
| 单元 | `domain` 公式、边界、退化输入 | 每个公式至少一个手算基准；数据诚实/端点/退休边界断言在 `tests/ruleInvariants.spec.ts` |
| 服务 | `application` 编排 | 不 mock 公式，只 mock I/O |
| 组件 | 挂载级 | 交互、空态、错误态、窄屏 |
| 接线 | 静态契约 | 仅路由表/页签/静默失败等无法挂载的结构 |
| E2E | 真实路径 | 桌面 + 移动；离线、分享、导入导出；首页/向导视觉基线 |
| 架构 | 分层/入口/单一计算路径/依赖环 | `tests/architecture.spec.ts` + `npm run lint:cycles` |
| 可访问性 | 语义色对比度、标题层级、控件名称、正文链接 | `tests/a11yContrast.spec.ts`（token/alpha 合成）+ `tests/naiveA11y.spec.ts` + `e2e/a11y.spec.ts`；Lighthouse 10 路由人工触发 |

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
