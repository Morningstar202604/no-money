# 架构说明

> 产品定位与信息架构见 [`docs/POSITIONING.md`](docs/POSITIONING.md)；质量门禁、性能预算、
> 模块边界与发布流程见 [`docs/ENGINEERING.md`](docs/ENGINEERING.md)。

## 分层

```
src/
├── domain/          纯函数业务逻辑，零框架依赖，可独立单测
│   ├── shared/      Brand 类型、Cent/Rate 值对象、Result、数值工具
│   ├── income/      收入 / 成本 / 产能 / 车辆单位经济学 / 收入波动
│   ├── tax/         年度汇算（税率表一）、个体户核定征收、劳务报酬预扣（表二）
│   └── benefit/     社保缴费、退休测算、养老金精算、社保 vs 自助
├── application/     用例编排（不写公式）
│   ├── scenario/    ScenarioService：收入→税→社保→净收入→权益评分
│   ├── compensation/ CompensationService：五类维权场景的金额与依据
│   └── adapters/    元↔分、legacy 规则 → domain 规则的唯一转换处
├── kernel/          对外计算契约（calculate.ts），CLI / API / MCP / Web 共用
├── engine/          旧引擎（deprecated）：ScenarioEngine/IncomeEngine 仅对拍；
│                    TaxEngine/BenefitEngine 仍被两个面板使用，见 engine/README.md
├── stores/          Pinia：参数、持久化、规则加载（I/O 都在这一层）
├── composables/     AI 对话（流式 SSE、离线知识库兜底）
├── data/            城市 / 省级入口 / 权益内容目录（`rights/catalog.ts`）
├── components/      UI 组件（含 RightsWizard / RightsItemCard / RightsEntryGrid）
└── views/           九个页面：办事入口 / 总览 / 方案对比 / 税务与养老 / 权益护航 /
                    政策百科 / 数据核验 / 管理 / 404
```

### 依赖方向

`views → components → stores → application → domain`，单向。
`domain` 不认识 Vue、不读 `localStorage`、不发网络请求。
`kernel` 站在 `application` 之上，只被四个入口层（Web/CLI/API/MCP）引用；
入口层不得直接 import `domain` 或 `application`，否则同一套规则会出现第二个答案。

`tests/architecture.spec.ts` 自动检查这三条边界。

### 单位约定（重要）

- domain 内部金额一律用**分**（`Cent` 品牌类型，整数）
- 对外契约与 UI 一律用**元**
- 换算只发生在 `application/adapters/ruleAdapters.ts` 与 `ScenarioService` 的结果边界
- 业务代码里不允许出现裸的 `×100` / `÷100`

## 六个计算模型

| 模型 | 位置 | 说明 |
|---|---|---|
| 收入与成本 | `domain/income/calculator.ts` | 计件 + 距离 + 峰时/雨天/节假日补贴 + 超重加价 |
| 配送产能 | `domain/income/capacity.ts` | 工时 ↔ 单量互算，含休息时间与疲劳折减 |
| 车辆单位经济学 | `domain/income/vehicleCost.ts` | 每公里变动成本分解（能耗/保养/易损/折旧） |
| 收入波动 | `domain/income/volatility.ts` | 毛收入建模后扣固定成本，输出净收入 P10–P90 与应急储备建议 |
| 个税 | `domain/tax/calculator.ts` + `withholding.ts` | 年度汇算（表一）与预扣预缴（表二）双口径 |
| 养老 | `domain/benefit/calculator.ts` + `actuarial.ts` + `selfFunded.ts` | 月养老金、终身现值、回本年龄、社保 vs 自助 |

所有模型的可调假设（收益率、贴现率、波动率、产能参数）都通过 `PersonalParams` /
`CapacityModel` 暴露给用户，并在 UI 上标注为假设。

## 数据流

```
public/rules/<city>.json  （34 城，含 sources 置信度）
      │  fetch（stores/main.ts:loadRule）
      ▼
Pinia store ──► ScenarioService ──► 领域纯函数
      │                │
      │                ▼
      │         ScenarioResult（元）
      ▼
components / views 渲染
```

权益内容（`docs/POSITIONING.md` 的 `RightsItem`）走另一条链路：
`src/data/rights/catalog.ts`（23 条民生手册迁移 + 9 条新增，共 32 条）→ 内容校验 → `/start` 四入口 / 3 步向导 / 条目卡，不参与计算内核。

## 数据可信度

规则参数（`public/rules/*.json`）在 `sources` 里挂
`docNo` / `url` / `effectiveFrom` / `retrievedAt` / `confidence`：

| confidence | 含义 | 约束 |
|---|---|---|
| `official` | 已回溯官方原文 | 必须有文号或链接 |
| `derived` | 依官方口径推算 | 需写明推算依据 |
| `unverified` | 无权威来源 | 仅作占位，禁止对外引用 |

权益内容多一级 `platform`：平台自己的估算/经验值，只能出现在计算器里并明确标注
「平台测算，非官方」，不得出现在「工资」「能领多少」卡片。
每条权益内容还带 `lastVerified`；过期显示「待复核」，不静默保留。

`utils/dataQuality.ts` 据此判断结果是否只能作为「假设测算」展示。用户用自己流水覆盖计价后，
字段转入 `overriddenFields`。

## 加载与性能

- 页面按路由懒加载；ECharts 只在图表页异步加载，不进首屏。
- 首屏 JS 预算 **500K gzip**；`dist` 总量 **5MB**；PWA precache **3MB**（当前 2.85MB）。
- PWA：app shell precache；`rules/*.json` 与 `knowledge/*.json` 用 StaleWhileRevalidate；
  不缓存用户输入。
- 子路径部署：`VITE_BASE` 同时作用于路由、资源、manifest `start_url`/`scope` 与
  `navigateFallback`；`index.html` 用 `%BASE_URL%`，不写死 `/`。
- chunk 加载失败时给出刷新提示（`src/app/router.ts` / `src/main.ts`）。

## 测试结构

| 目录 | 内容 |
|---|---|
| `tests/domain/` | 纯函数单测（含手算基准） |
| `tests/application/` | 服务层编排 |
| `tests/parity/` | 新旧引擎对拍（21 个用例），重构护栏 |
| `tests/stores/` | 状态、持久化、跨城切换 |
| `tests/wiring/` | 组件接线回归（防「改了一处忘另一处」） |
| `tests/components/` | 组件挂载级回归（happy-dom）：补偿时序、文书金额与按月分段、页签配置 |
| `tests/data/` | 省份归属映射（决定是否引用地方性法规） |
| `tests/rulesGate.spec.ts` | 规则文件溯源门禁 |
| `tests/cities.spec.ts` | 34 城数据完整性 |
| `tests/architecture.spec.ts` | 分层/内核/旧引擎边界门禁 |

`npm test` 一条命令覆盖全部（当前 51 文件 / 1,102 项）；`npm run verify` 额外跑引擎自检；
`npm run kb:check` 校验 `public/knowledge/kb.json` 与数据源逐字段同步；
`npm run typecheck`（src）与 `npm run typecheck:test`（tests + scripts）分别把关类型；
`npm run doctor` 做跨切面一致性检查（体积、文档、PWA、数据）。

## 部署

- Web：支持子路径部署（构建时 `VITE_BASE=/app/`），运行时资源统一走
  `src/utils/asset.ts` 的 `assetUrl()`；路由用 `createWebHistory(import.meta.env.BASE_URL)`。
  静态托管需配置 SPA fallback（Nginx `try_files`），未配置时 `public/404.html` 提供兜底出口。
- 桌面：`npm run tauri:build`，CSP 见 `src-tauri/tauri.conf.json`
  （`connect-src https:` 是允许自定义 AI 端点的已知取舍，详见 `SECURITY.md`）。
