# 架构说明

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
├── engine/          旧引擎，仅作对拍基准（ScenarioEngine/IncomeEngine）
│                    TaxEngine/BenefitEngine 仍被税务与退休面板使用
├── stores/          Pinia：参数、持久化、规则加载（I/O 都在这一层）
├── composables/     AI 对话（流式 SSE、离线知识库兜底）
├── components/      UI 组件
└── views/           五个页面
```

### 依赖方向

`views → components → stores → application → domain`，单向。domain 不认识 Vue、不读 localStorage、不发网络请求。

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
| 收入波动 | `domain/income/volatility.ts` | 对数正态模拟，输出 P10–P90 与应急储备建议 |
| 个税 | `domain/tax/calculator.ts` + `withholding.ts` | 年度汇算（表一）与预扣预缴（表二）双口径 |
| 养老 | `domain/benefit/calculator.ts` + `actuarial.ts` + `selfFunded.ts` | 月养老金、终身现值、回本年龄、社保 vs 自助 |

所有模型的可调假设（收益率、贴现率、波动率、产能参数）都通过 `PersonalParams` / `CapacityModel` 暴露给用户，并在 UI 上标注为假设。

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

## 数据可信度

每个外部参数在 `sources` 里挂 `docNo` / `url` / `effectiveFrom` / `retrievedAt` / `confidence`：

| confidence | 含义 | 约束 |
|---|---|---|
| `official` | 已回溯官方原文 | 必须有文号或链接 |
| `derived` | 依官方口径推算 | 需写明推算依据 |
| `unverified` | 无权威来源 | 仅作占位，禁止对外引用 |

`utils/dataQuality.ts` 据此判断结果是否只能作为「假设测算」展示。用户用自己流水覆盖计价后，字段转入 `overriddenFields`。

## 测试结构

| 目录 | 内容 |
|---|---|
| `tests/domain/` | 纯函数单测（含手算基准） |
| `tests/application/` | 服务层编排 |
| `tests/parity/` | 新旧引擎对拍（363 例），重构护栏 |
| `tests/stores/` | 状态、持久化、跨城切换 |
| `tests/wiring/` | 组件接线回归（防「改了一处忘另一处」） |
| `tests/rulesGate.spec.ts` | 规则文件溯源门禁 |
| `tests/cities.spec.ts` | 34 城数据完整性 |

`npm test` 一条命令覆盖全部；`npm run verify` 额外跑引擎自检（失败会 exit 1）。
