# 更新日志

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## 2.2.0 — 2026-11-02

### Added

- 城市规则运行时校验（`src/utils/cityRule.ts`）：字段形状、社保基数区间、税档连续性与来源一致性
  在加载阶段一次性拦截，避免损坏的规则文件静默算出错误金额
- AI 对话隐私控制：历史默认仅存标签页内存，显式勾选后才持久化最近 50 条
- API Key 默认不落盘，支持存储状态显示与一键清除
- 英文主 README，中文版同步维护（`README.md` / `README.zh-CN.md`）

### Fixed

- 320×640 窄屏下首次引导弹窗高 956px 超出视口，底部按钮不可见且无法滚动
- 320px 宽度下第五个导航项溢出视口 5px
- 深色主题下告警卡片浅底近白字造成的对比度不足

### Changed

- 主分支统一为 `main`，删除功能分支

## 2.1.0 — 2026-10-28

本轮聚焦「参数覆盖了 34 城、内容却只有广东」的结构性缺口，并修掉一批会产生错误金额与错误法条的缺陷。

### 修复（会算错 / 会误导）

- 默认/扁平按钮文字与背景同色（对比度 1:1）→ 移除全局 `Button.textColor` 覆盖，primary 用 `--color-text-on-primary`
- 产能校准参数刷新即丢（写入与读取不是同一 schema）→ `loadCapacity(saved.capacityModel)` 共用 `hydrateCapacity`
- 切换维权页签会卸载补偿面板、清空已确认金额 → `display-directive="show:lazy"`
- 「多跑2小时」生成按本工具产能卡都超载的方案并当选最优 → 两侧统一 `calcCapacity`（扣休息 + 疲劳折减），新增 `hoursForOrders`
- 重置参数后示例金额被标记为用户确认并写入文书 → `resetting` 守卫 + `flush: 'sync'`
- 补偿计算不读「本省法定参数」，2N 与工伤封顶用占位值 → 与主测算同源
- 所有城市都引用《广东省工伤保险条例》第 34 条 → `provinceOf()` 按省判定，非广东只给「以本省办法为准」
- 佛山/珠海/中山被当成外省（同属广东）→ 新增 `src/data/provinces.ts`
- 东莞非全日制小时最低工资 18.9 → **21.9**（原文核对，confidence 升为 official）
- 北京最低工资条目链接指向社保基数通知（正文不含最低工资）→ 删除链接并在 note 说明
- 1–4 级伤残「按月津贴」被计入一次性条件项合计 → `period: 'monthly'`，页面/文书/合计三处分离
- 默认产能参数（8min/18km/h/90min）使首屏 10h/35 单即超载 → 校准为 6min/20km/h/60min

### 新增

- 省级政策核查清单页签：31 省六类必查文件 + 检索路径 + 省人社厅/政务网入口
- 办事入口与法律援助按省切换（`src/data/provinceChannels.ts`，12348/12333/12351/12368 兜底）
- 个人养老金 12,000 / 税优健康险 2,400 额度接入全站测算；专项附加扣除上限 5,000 → 10,000
- 文书打印/另存 PDF（`@media print` 隐藏应用外壳 + A4 页边距）；图表「保存图片」
- 知识库新增失业保险、职业伤害保障 vs 工伤保险、带薪年假三条手册（375 条）
- AI 助手：本城溯源进入检索、意图优先、60 秒超时、Key 存储状态与一键清除、模型名可自定义
- 子路径部署支持（`base` + `assetUrl` + `createWebHistory(BASE_URL)`）；404/robots/sitemap/OG/noscript
- 组件挂载测试（happy-dom）：补偿首屏不写 store、改动后写入、文书金额与按月分段、页签配置
- 工程：CI 8 步、`tsconfig.test.json`（tests+scripts 0 error）、`kb:check` 同步门禁、生产 sourcemap 关闭
- 文档：`SECURITY.md` / `CONTRIBUTING.md` / `ARCHITECTURE.md` / `.editorconfig` / `.gitattributes` / `.nvmrc`

### 测试

- 912 个测试 / 33 文件（新增 6 例组件挂载、8 例省份映射、3 例法条按省、3 例数据质量覆盖）
- `npm run verify` 从「只打印」改为断言失败 exit 1，并对拍生产路径 `ScenarioService`

## 2.0.0 — 2026-10

### 首次发布

**核心能力**

- 34 座城市 / 31 个省级行政区的社保、医保、最低工资参数，逐条挂 `sources` 置信度
- 收入测算：计件 + 距离 + 峰时/雨天/节假日补贴 + 超重件加价
- 个税双口径：年度汇算（税率表一）与平台按次预扣（61 号公告预扣率表二）
- 社保与养老：缴费测算、退休月养老金、养老金精算（现值/回本年龄/投入产出倍数）
- 社保 vs 自助养老对照（含资金耗尽年龄）
- 权益补偿：欠薪、工伤、违法解约、算法争议、超时加班五类场景，含法律依据与文书生成
- 收入波动分析：P10–P90 分位数与应急储备建议
- AI 助手：OpenAI 兼容接口，离线时回落本地知识库

**数据诚实机制**

- 无官方来源的参数一律标 `unverified` 并在界面显著标注「假设测算」
- 用户可用「我的计价」覆盖平台计价、用「本省法定参数」覆盖省级社保基数
- 补偿金额分「可直接主张」与「条件项」两类，后者不计入合计
- 示例参数算出的金额不会进入文书

**工程**

- 898 个测试（含 363 例新旧引擎对拍 + 6 例组件挂载回归）
- 严格 TypeScript（strict + noUnusedLocals + noUnusedParameters）
- 零 npm 依赖漏洞
- 纯前端，无后端；桌面端 Tauri 不启用任何插件
