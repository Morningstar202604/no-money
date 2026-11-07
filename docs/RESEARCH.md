# 同类项目调研与吸收记录

> 目的：把「参考了谁、学到了什么、采纳了什么、为什么不采纳」变成可追溯的文字，
> 而不是一句模糊的"参考了业界最佳实践"。每条采纳项都指向真实代码位置。

调研时间：2026-11-07。第一轮覆盖 12 个项目/工具，分四类；第二轮（同日）补充深挖 6 个，合计 18 个。

---

## 一、零工收入追踪类（与我们用户重合度最高）

### 1. Gigbox（github.com/dcalacci/gigbox）

为骑手/网约车司机做的开源追踪器，可导出数据供研究用。

**学到**：数据导出是零工工具的刚需——用户要把自己的流水拿去做研究或举证。
**已采纳**：参数导出为 JSON + 文书下载为 TXT（`src/utils/download.ts`）。
**未采纳**：自动里程追踪。需要后台 GPS 常驻权限，与本产品"打开就能算、不留后台"的定位冲突。

### 2. FairFare（开源众包 rideshare 数据，面向劳工组织者）

**学到**：把个体数据聚合成集体证据，是劳工维权的放大器。
**未采纳**：数据上传。与本产品"数据不出设备"的隐私承诺直接冲突。
 若未来做，必须是显式 opt-in 且匿名聚合——写进 ROADMAP 讨论而非现在实现。

### 3. Gridwise（65 万司机的收入对比应用）

**学到**：「市场对比」是最被验证的功能——司机最想知道"我这段是不是亏了"。
 本产品用 34 城对比页回应同一诉求；Gridwise 用真实众包数据，我们用官方政策参数，
 口径不同但用户问题相同：**我和别人比，处在什么位置**。
**未采纳**：需求预测（Where/When to Drive）。需要历史订单数据，我们只有政策参数，
 没有数据基础就不该做预测——这正是本项目"不编造数字"原则的反向应用。

### 4. Solo / ShiftMate / True Wage

**学到**：True Wage 的「每英里净收入」模型（约 $0.725/mi 成本系数）证明了
 **把成本拆成可核对的单价系数**比一个总数更可信。
**已采纳**：本产品的车辆成本按充电/维护/保险/折旧逐项拆分（`domain/income/vehicleCost.ts`），
 并在 UI 显示每公里成本，方向一致。
**未采纳**：Solo 的 AI 报税与收入保证——超出范围且需要资质。

## 二、税务计算类（公式与呈现的参考系）

### 5. PolicyEngine（英美，经 CRS/NBER 背书的开源微模拟）

**学到**：政策计算器要获得信任，靠的是 **(a) 规则即代码、(b) 每条规则可测试、(c) 来源可追溯**。
 这三点正是本项目的 cities 门禁测试（`tests/cities.spec.ts`）+ 溯源置信度 + 现实核查层的组合。
**已采纳**（早期设计即对齐）：规则文件带 `sources.confidence`；结果标注"假设测算"。
**启发待做**：PolicyEngine 提供"政策改革对比"——对应到本产品是「若按个体户缴税能省多少」，
 税务页已有个体户对照，暂不扩展为通用改革模拟。

### 6. OpenFisca / Tax-Calculator（Rules as Code 两大旗舰）

**学到**：把法条编码为可执行规则后，**法条本身就是测试对象**——
 "税率表必须连续、首档零扣除"这类断言可以在数据层拦截（`src/utils/cityRule.ts` 已实现）。
**已采纳**：税档连续性/速算扣除一致性校验（防止静默算错税）。
**未采纳**：通用 RaC 引擎。本项目的规则面窄（9 类字段），一个 JSON Schema + 校验函数
 比引入 OpenFisca-Python（重依赖、跨语言）复杂度低一个量级。

### 7. 英国 HMRC「Estimate your Income Tax」

**学到**：政府级计算器的可信度来自**每一步都能看到"这个数是怎么来的"**，
 且分「本年/往年」两个口径。本产品的明细行 + 文书生成路径与此一致。
**已采纳**：年度汇算与预扣预缴双口径并存（`domain/tax/`），并明确告知差异。

### 8. 中文个税计算器（TaxCalculatorWeb / income-calc / Ignareo SalaryCalculator）

**学到**：
- TaxCalculatorWeb 与本产品定位最像（本地计算、平台劳务报酬、离线可用），验证了这个细分有真实需求；
- 通用工资类计算器（累计预扣法、年终奖择优）是**雇员口径**，与本产品的劳务报酬/个体户口径并存而不重叠。
**未采纳**：累计预扣法。骑手绝大多数按劳务报酬预扣（表二）或年度汇算（表一），
 引入第三套口径会让"数字口径"更难解释——解释成本本身就是一种伤害。

### 9. ADP Paycheck Calculator / 韩国薪资计算器

**学到**：toothpaste 式呈现的通用模式——**一个大数字（到手）+ 分色堆叠（税/社保/净）+ 拖动联动**。
**已采纳**：本产品 KPI 大数字 + AnimatedNumber 拖动联动 + 收支结构图表（`DashboardView`）。

## 三、AI/harness 类（此前调研，此处归档）

### 10. MCP 官方 SDK / AGENTS.md / opencode / codex CLI

**已采纳**：MCP server（`mcp/server.ts`，4 工具）、AGENTS.md 开发约定、CLI 退出码分层、
 `--json` 双输出。完整决策记录见 git history 与 AGENTS.md。
**未采纳**：A2A 协议。无多 agent 协作场景，加了就是摆设。

## 四、部署与运维类

### 11. nginx:alpine 多阶段构建 + GitHub 容器实践

**已采纳**：`Dockerfile`（web，nginx:1.27-alpine 运行时 <30MB）与
 `docker/Dockerfile.api`（node:22-alpine，非 root 用户 + 只读文件系统）。
 分阶段构建使 CI 缓存命中时不重装依赖。
**未采纳**：把 Web 与 API 合成一个镜像。静态站不该背上 Node 运行时，
 且"API 被打挂不连带网页挂"是用户明确要的隔离性。

### 12. Keep a Changelog / SemVer

**已采纳**：`docs/VERSIONING.md` 定义了本项目对 major/minor/patch 的具体解释
 （含"数据纠错算 patch"这种项目特有条款），`scripts/bump-version.mjs` 保证三处版本一致。

---

## 五、第二轮深挖（2026-11-07，开源个人财务与社保计算器生态）

### 13. Actual Budget（本地优先 + 可选端到端加密同步）

**学到**：本地优先产品可以做到"数据在本地、同步是可选项"，且 E2E 加密同步本身就能成为卖点。
**已对齐**：本产品"数据不出设备"原则与其同构；URL 分享（3.2.0）承担了"无服务器共享"角色。
**未采纳**：同步服务器。无账号体系（E 路线明确不做），加了就是负担。

### 14. Firefly III（自托管全功能记账 + 成熟 API）

**学到**：API-first 的自托管工具会把 API 文档当一等公民（OpenAPI 导出）。
**已对齐**：API 已输出 `/openapi.json`（实测含 4 端点 + 描述性 404 hint）。
**未采纳**：多账本/规则引擎。场景是"算一笔收入"，不是"记一辈子账"，范围必须守住。

### 15. Pare（本地解析账单 + MCP 24 工具 + 订阅涨价检测）

**学到**：(a) MCP 深度集成（24 工具）证明"AI 读本地财务数据"有真实需求；
 (b) "上传文件解析完即删"的隐私叙事值得学。
**已对齐**：MCP 4 工具（calc/compare/cities/check）覆盖本产品全部核心能力；
 AI 出站脱敏 + 发送预览（3.3.0）与"解析完即删"同属隐私叙事。
**未采纳**：账单解析。没有银行对接土壤（国内流水在平台 App 里），做了就是空转。

### 16. income-calc（上海/湖州，逐月政策期匹配）

**学到**：**一个日历年可能横跨两个政策期**（如社保基数 2025.7–2026.6 / 2026.7–2027.7），
逐月匹配生效政策 + 无数据月份显式标注"沿用上期"——这是精确年度汇算的正确姿势。
**已对齐**：规则文件带 `effectiveFrom/effectiveUntil` 字段（`src/utils/cityRule.ts:17`），
`SourceTag` 组件显示生效区间；kb:check 375 条含生效期校验。
**启发待做**：逐月精算目前以"当前政策期"为口径。跨政策期的逐月汇算
需要 12 份月度基数数据，数据维护成本翻倍——记入 ROADMAP，待数据核验流程成熟后再评估。

### 17. MilkWind/pension-calculator（养老金回本点可视化）

**学到**：「什么时候能收回缴费本金」是参保决策里最朴素的问题，回本点图表直击痛点。
**已实现（更早、且口径更严谨）**：`src/domain/benefit/actuarial.ts:14` 的回本年龄
按**贴现率折现的保守口径**计算（机会成本计入），并在退休规划面板呈现——
比该项目的名义口径更保守、对用户更诚实。

### 18. VincentRoole/social-security-advisor（社保 AI 顾问 Skill）

**学到**：计算器之外，"4050 补贴怎么申请""社保转移怎么办理"这类**办理指引**
是搜索量极高的刚需内容。
**已实现**：`src/components/panels/RightsGuide.vue`（工会入会/法律援助办理路径）、
`src/utils/livingGuide.ts`、`src/data/provinceChannels.ts`（各省份办理渠道）——
指引能力在权益页已完整落地。
**未采纳**：其 20 城硬编码 Python 脚本形态。我们 34 城 JSON + 校验门禁的形态
在可测试性上严格更优（cities.spec.ts 门禁 + kb:check 375 条）。

| 来源 | 落地位置 | 状态 |
|---|---|---|
| Gridwise 市场对比 | 34 城对比页 + CLI compare | ✅ |
| True Wage 单价系数 | 车辆成本逐项拆分 | ✅ |
| PolicyEngine 溯源/可测 | cities 门禁 + 置信度 | ✅ |
| OpenFisca 法条可测 | 税档连续性校验 | ✅ |
| HMRC 双口径 | 汇算/预扣并存 | ✅ |
| ADP 大数字+联动 | KPI + AnimatedNumber | ✅ |
| Gigbox 数据导出 | JSON/TXT 导出 | ✅ |
| codex/opencode CLI 惯例 | 退出码/双输出/AGENTS.md | ✅ |
| nginx 多阶段 | Dockerfile ×2 + compose | ✅ |
| FairFare 聚合上传 | 数据不出设备原则 | ❌ 冲突，进 ROADMAP 讨论 |
| Gridwise 需求预测 | 无数据基础 | ❌ 不做（原则） |
| income-calc 逐月政策期 | effectiveFrom/until + SourceTag | ✅ 口径已对齐；逐月精算记 ROADMAP |
| Actual Budget 本地优先 | 数据不出设备 + URL 分享 | ✅ 同构对齐 |
| Pare MCP 深度集成 | mcp/server.ts 4 工具 | ✅ |
| Firefly III API-first | /openapi.json | ✅ |
| MilkWind 回本点 | actuarial.ts 贴现保守口径 | ✅ 更早实现且口径更严谨 |
| social-security-advisor 办理指引 | RightsGuide + livingGuide + provinceChannels | ✅ |
| 双城并排对比 | — | ⏳ ROADMAP |
| 场景 URL 分享 | — | ✅ 3.2.0 |

> 维护规则：下次做同类调研时，在本文件追加小节并更新汇总表；
> 引用本项目代码时用 `文件:行号`，让每条"采纳"都可被 grep 验证。
