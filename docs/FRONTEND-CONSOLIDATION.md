# 前端合并与去重清单

> 目标：入口清楚、页面各干一件事、同一份内容只维护一次。
> 原则：只在出现第二个使用方时抽公共件；不为“以后可能复用”提前造框架。

## 已完成（3.6.1）

| 重复点 | 原来 | 现在 |
|---|---|---|
| 四入口标题/描述 | `RightsEntryGrid.vue` 与 `RightsStartView.vue` 各写一份 | 统一到 `src/data/rights/entries.ts` 的 `RIGHTS_ENTRIES`；3.6.2 删除重复组件 |
| `?tab=` 双向同步 | `ScenarioView` / `PlanningView` / `PolicyView` 各复制一段 getter/setter | 统一到 `src/composables/useTabQuery.ts` |

这两处是纯前端复用，不改变页面功能；后续新增入口或页签只改一处。

## 已完成（3.6.2）

- `/` 与品牌链接统一到 `/start`；`/dashboard` 继续可用，但只承担「算一算总览」。
- Dashboard 删除重复四入口卡，只保留一句指路；已无引用的 `RightsEntryGrid` 组件删除。
- `/start` 四入口仍是默认首屏；选中入口后显示一句说明，避免四个标签只有标题、没有引导。

## 已完成（3.6.3）

- `/policy` 八个数据页签压成四个用户页签：政策原文 / 数据溯源 / 现实与救济 / 手册与知识库。
- 内容没有删：民生手册和知识库一起放在第四组；旧 `?tab=national|guangdong|province|manual|kb|relief` 深链仍会落到对应组。
- 这是外层分组，不是正文去重；手册与权益目录的单一正文仍按 P1-2 处理。

## 已完成（3.6.4）

- `/start` 的手册迁移条目按 `guideId` 找回 `GuideItem`，展开详情直接渲染 `GuideCard`。
- `/policy` 的手册页仍用同一张 `GuideCard`；正文只存在于 `src/utils/livingGuide.ts`。
- 非手册条目保留原有详情块；没有为了统一而把计算类条目塞进手册组件。

## 已完成（3.6.5）

- 新增 `resolveServiceChannel(city)`：市级深核优先；未深核但已知省份时回退省级；完全未知返回 `null`，不默认当成广东。
- `RightsWizard`、`CityServiceLinks`、`PolicyView` 的省级入口块都改为只认这一种解析结果；不再各拼一套 `cityChannelOf` / `channelOf` 判断。
- 只回退到有官方 URL 的入口；公积金等没有省级直达链接的类别给说明和 `12329`，不编死链。
- 只抽 3 个视觉原子：`.surface-card` / `.stack-sm` / `.link-brand`，在 `CityServiceLinks`、`RightsItemCard`、`PolicyView` 落地；没有引入新 UI 框架。

## 已完成（3.6.6）

- 「我的清单」的导出与打印不新开页面/路由：`src/utils/checklistExport.ts` 用同一组数据生成 txt 与打印 HTML，避免两种格式各写一套字段。
- 打印页对用户可见文本做 HTML 转义；打印样式只放在生成的打印页内，不往全局 `@media print` 再堆规则。
- 17 条 L1 权益只进 `RIGHTS_CATALOG`，`/start` 首屏数量、入口列表、导出清单都从这一份数据派生；没有新增第二份“权益数量”常量。
- 截止项置顶只作用于本机已有清单，不引入通知权限、推送服务或账号；保持“打开页面才提醒”的轻量边界。

## 已完成（3.6.7）

- 向导首步增加四个一键常见情况，全部复用 `getRightsForSituation`，没有第二套推荐逻辑。
- 一键入口只在第 1 步出现；进入第 2/3 步后隐藏，避免与正常情境选项重名。
- 结果标题在身份为「不确定」时省略身份前缀，减少“不确定 · …”的噪音。
- 没有改四入口、导航、计算口径或政策数据。

## 已完成（3.6.8）

- 结果清单的序号由 `RightsItemCard` 的可选 `rank` 承担；向导按 `result` 原顺序传入，不新增排序算法。
- 第 1 件只在向导结果页高亮；`/start` 全部条目和其他列表不传 `rank`，避免出现两套“优先级”视觉。
- 结果页文案改为“先办第 1 件”，把 3–7 条的压力收成一个动作。

## 已完成（3.6.9）

- 结果页新增“接下来”三个动作：算一算、问 AI、查政策原文。
- 路由由 `RightsStartView` 负责，`RightsWizard` 只 emit；向导不直接依赖 router，便于在其他入口复用。
- AI 面板保持唯一实例：`ChatAssistant` 监听 `app:open-ai`，办事页只发事件，不复制悬浮按钮、不复制对话状态。
- 三个动作只在结果页出现；四入口和生成前界面不变。

## 已完成（3.6.10）

- 「问 AI」从只打开面板，变成带入当前城市、身份、情境、第 1 件标题与时限的预填问题。
- 措辞集中在 `src/utils/rightsAiPrompt.ts`；向导只负责取当前结果，父页只转发事件，`ChatAssistant` 只负责填充与聚焦。
- 不自动发送，避免在用户未配置或不想外发时替用户做决定；仍只有一个 AI 面板和一套对话状态。
- 问题里明确要求 AI 不编金额、文号、电话和链接，信息不足时先问一个问题。

## 已完成（3.6.11）

- 总览页在算一算前增加常驻口径声明：当前只覆盖灵活就业 / 平台按单计价，企业职工和城乡居民不要直接套。
- 政策页数据溯源增加本城摘要，只读 `rule.sources`：计数、最早日期、超 12 个月数量、待核验字段名。
- 摘要用独立工具 `src/utils/sourceFreshness.ts`，不把非法日期算成过期、不补值、不改置信度。
- 没有新增页签、页面或入口；四入口与六项主导航保持不变。

## 已完成（3.7.0）

- 新增 `/employee`：企业职工只填工资条三项（税前月薪、个人五险一金、专项附加扣除），按年度综合所得口径算到手；不猜企业缴费比例，不补地方费率。
- `MainLayout` 用 `showSidebar = route.name !== 'Employee'` 把骑手参数侧栏和移动端菜单按钮从该页移除，`content-no-sidebar` 只负责把内容拉回左边；没有新增导航层级。
- 总览的口径声明加入页内链接；结果卡写清年度汇算、月度预扣可能前低后高、不含年终奖/单位缴费。
- 既有移动端参数导出用例加显式 `scrollIntoViewIfNeeded()`：侧栏是独立滚动容器，Playwright 自动滚动会停在 `.ps-foot`，不是下载实现或按钮事件的问题。
- 首页四入口、三步向导、60 条权益目录、政策页与数据新鲜度摘要均未改。

## 已完成（3.7.1）

- 数据溯源页先给 34 城汇总，再给本城逐条明细；明细默认收在原生 `<details>`，不把 34 行直接铺在首屏。
- 汇总只统计 `fetch` 成功的规则文件，失败城市单独列出并可重试；没有把失败当 0，也没有新增静态覆盖率数据。
- 「切到此城」复用 `store.setCity`，只影响当前测算城市；不新增页面、路由或第二套计算状态。
- 34 行使用可换行 flex 行，移动端不设横向滚动；本城行标「当前」，避免用户误以为总览是只读快照。
- E2E 在原数据溯源用例内扩展，不新增顶级页签；单测只覆盖纯汇总函数，不模拟网络。

## 已完成（0.0.39）

- 页面标题收口到 `src/app/pageTitles.ts`：`router.ts` 的 `meta.title` 与 `PageHeading` 的 sr-only h1 都从这一张表取，11 个 key 不再各写一份字面量。`PageHeading` 只保留 `createPageHeading`，标题本身不复制。
- `/rights` 三个页签接入 `useTabQuery`：`?tab=compensation|guide|document` 可深链；`/start?entry=trouble` 的“补偿计算 / 维权指南 / 文书生成”三张快捷卡分别落到对应页签，不再全部停在补偿计算。没有新增页面或第二套页签状态。
- `/start?entry=social` 在四入口实际覆盖的 25 条 L2 之外，补出未被覆盖的 5 条 L2（养老退出、退休办理、失业登记、灵活就业登记、养老金认证）。补位逻辑从 `RIGHTS_CATALOG` 与 `rightsForEntry` 派生，只给入口，不复制全文；全文仍在 `/guides`。
- `/dashboard` 的“见方案对比页”改为可点的 `/scenario` 链接；`/scenario` 不再只有路由、没有站内入口。
- 测试守住单一来源：`tests/uxDebt.spec.ts` 检查路由与 `PageHeading` 引用共享标题表、11 个 key 齐全、总览有 `/scenario` 链接；`RightsView` 挂载测试补真实 router，避免 `useTabQuery` 在无路由环境取 `undefined`。
- **0.0.40 已接续**：`/policy?tab=manual` 只保留 2 条独有 L1 概念卡（`guide-retire-age`、`guide-ltc-insurance`），其余 21 条改成 `/start` / `/guides` 入口，知识库不动。

## 已完成（0.0.40）

- `/policy?tab=manual` 不再铺 23 张 `GuideCard`：新增 `src/data/rights/manual.ts`，按现有 `RIGHTS_CATALOG` / `rightsForEntry` / `guidesForCategory` 关系派生“入口 / 正文”两组，不写死条数。
- 21 条只留入口：20 条按第一个命中的四入口落到 `/start?entry=tasks|benefits|social`；`guide-pension-exit` 在首页没有对应卡，落到 `/guides?cat=retire`。
- 只保留 `guide-retire-age`、`guide-ltc-insurance` 两条手册独有概念正文；它们没有办事卡或教程卡，删掉就真的没地方看。
- 入口卡只写问题和目标页，不复制步骤、材料、官方链接；正文仍只维护在 `livingGuide.ts` / `RIGHTS_CATALOG` 一处。
- 知识库未动：`buildStaticKbEntries` 与 409 条 `/knowledge/kb.json` 的收录取数保持原样。
- 测试：`tests/manualDedupe.spec.ts` 4 条；E2E 既有政策页用例扩展为断言 2 张 `.guide-card` 并可跳到 `/guides?cat=retire`。

## 已完成（0.0.41）

- `/admin` 与 `/audit` 不再各自 fetch `city-index.json`：新增 `src/data/cityRules.ts`，统一 34 城加载、失败城市记录和置信度汇总。
- 索引缺失、不是 34 城或少于 34 城时，回退到 `CITY_REGISTRY`，删掉 `/admin` 的 38 项数组和 `/audit` 的 8 项数组；后者在索引缺失时原来只会显示 7 城。
- 两个“官方覆盖”不再共用一个模糊标签：
  - `/admin`「全库条目官方占比」= 225 / 343 条 = 66%，对应置信度分布图的 343 条溯源；
  - `/admin` 与 `/audit`「7 项核心字段官方率」= 186 / 238 格 = 78%，对应 34 城 × 7 项矩阵。
- `/admin` 表格列改为「全库条目官方率」并直接写 `225/343`；`/audit` 指标下写 `186/238 格`。两个数都从同一个 `summarizeCityRules()` 来，不再由页面各自 `reduce`。
- 不新增页面、不改政策数值；加载改为并行，34 个规则文件不再串行等待。

## 下一步：按这个顺序合，不要一次重排

### P1-1 首页归位：`/start` 是唯一的“办事首页”（已在 3.6.2 完成）

**原现状**

- `/` 重定向到 `/dashboard`；品牌点回 `/dashboard`。
- `/dashboard` 顶部有四入口卡，下面才是收入测算；`/start` 又有一套四页签 + 向导。
- 用户会问“到底从哪进”，两个页面都在抢“首页”。

**已落地**

- `/` 和品牌链接统一到 `/start`。
- `/dashboard` 语义收窄为「算一算总览」，已删除重复四入口卡，只保留一句“去办事入口”。
- `/start` 一屏保持四个入口可见（四页签），点选后下方只展示该入口的清单，不弹二级首页。
- E2E 根路径用例已改到 `/start`，`/dashboard` 保留原有 KPI 用例。

**不合并**：`/start` 不吞掉 `/dashboard` 的计算功能；计算仍是工具，只是不再抢首屏。

### P1-2 民生手册与权益目录：一份内容，两种用法（3.6.4 详情复用，0.0.40 列表去重）

**原现状（0.0.39 之前）**

- `src/utils/livingGuide.ts` 是 23 条手册原文；`src/data/rights/catalog.ts` 把同一批内容映射成 `RightsItem`。
- `/policy?tab=manual` 用 `GuideCard` 展示 23 条；`/start` 用 `RightsItemCard` 展示同一批条目。
- 同一个“医保断缴”出现在两个页面，文案和核验时间容易漂移。

**建议**

- 保留 `livingGuide.ts` 作为**详细原文**（步骤、数字、官方链接），`rightsCatalog` 只做**索引与筛选**，通过 `guideId` 关联，不复制正文。
- `RightsItemCard` 的“展开完整步骤/材料/依据”改为引用对应 `GuideItem`；`GuideCard` 只作为详情内容组件，不再独立成为第二个列表页。
- `/policy` 的「民生手册」页签改成“权益速查入口”：按分类给 5–8 条高频项 + “查看全部 60 条 → `/start`”，不铺 23 张全文卡。
- 保留 `/policy` 的政策原文、溯源、现实口径；这些是“查依据”，不是“办事清单”。

**验收（3.6.4 已达成）**：同一 `guideId` 只存在一处正文；改一条政策只需要改 `livingGuide.ts` 一处。`RightsItemCard` 的展开详情复用 `GuideCard`，并有契约测试防止再手写第二套。

**0.0.40 已落地列表去重**：新增 `src/data/rights/manual.ts`，从 `RIGHTS_CATALOG` / `rightsForEntry` / `guidesForCategory` 派生分流。21 条正文已存在于 `/start` 或 `/guides` 的，`/policy` 只保留入口（20 条 `/start?entry=`，`guide-pension-exit` → `/guides?cat=retire`）；只有 `guide-retire-age`、`guide-ltc-insurance` 两条站内无入口的概念条目保留 `GuideCard`。手册页断言 `.guide-card` 数量为 2，知识库的 409 条导出未动。

### P1-3 `/policy` 八个页签压成四组（3.6.3 已完成外层分组，P1-2 负责正文去重）

现在：国家级 / 地方政策 / 本省核查 / 本城溯源 / 现实与口径 / 民生手册 / 知识库 / 权益救济。

建议按“用户问题”分组，而不是按数据表分组：

1. **政策原文**：国家级 + 地方政策 + 本省核查清单
2. **数据溯源**：本城参数逐条溯源
3. **现实与口径**：现实差距 + 权益救济路径
4. **知识库**：本地检索 + 导出说明；民生手册入口并入 `/start`

这样仍然是 8 块内容，但首屏只看到 4 个页签，减少“我该点哪个”的成本。不要为了少页签把内容删掉。

**已落地（3.6.3）**：四组已上线；`manual-kb` 组同时承载民生手册与知识库。旧深链通过 `TAB_GROUP` 映射到四组，不改变已发出去的链接。

### P2-1 省级/市级入口：数据分层，解析合并（3.6.5 已完成）

**现状**

- `provinceChannels.ts` 31 省入口；`cityChannels.ts` 10 城四类入口。
- `RightsWizard` 先查市级，再回退省级；`PolicyView` 又单独拼省级链接。
- 两套数据结构字段名不同，UI 要写两套判断。

**建议**

- 数据仍分两层（省级兜底、市级深核），不要硬合并成一张大表。
- 抽一个 `resolveServiceChannel(city)`：返回 `{ level: 'city' | 'province', social, medical, housing, employment }`，UI 只认这一种结果。
- `PolicyView` 的省级入口块与 `CityServiceLinks` 共用同一个链接卡组件；只保留“名称 + 官网 + 站内怎么找 + 核验时间”四个字段。
- 未深核城市继续回退省级，不补猜的市级链接。

**已落地（3.6.5）**：`resolveServiceChannel` 是唯一解析入口；`CityServiceLinks` 同时渲染市级/省级四类卡，省级公积金无直达链接时显示说明而非死链；`PolicyView` 的省级官网入口也走同一结果。

### P2-2 视觉层：只抽真正重复的原子（3.6.5 已抽 3 个）

**已重复**：`card` 背景/边框/圆角、链接色、`@media (max-width: 700px)` 单列规则。

**建议**：

- 只抽 `src/styles/` 里的 3–5 个 CSS 变量或工具类（`.surface-card`、`.link-brand`、`.stack-sm`），不引入新的 UI 框架。
- 不把 `RightsItemCard` 和 `GuideCard` 强行合成一个万能卡；它们的职责不同（办事清单 vs 原文详情）。
- 移动端优先：一屏一个主任务，四个入口不折叠进下拉；按钮最小 36px；正文不出现横向滚动。

**已落地（3.6.5）**：只新增 `.surface-card`、`.stack-sm`、`.link-brand` 三个全局原子；卡片背景/边框/圆角、纵向小间距、品牌链接色不再各写一份。

## 明确不合并的地方

| 页面/模块 | 为什么不合并 |
|---|---|
| `/start` 与 `/rights` | 前者是“该做什么”的引导与清单；后者是补偿计算、维权指南、文书生成。合并会让首屏重新变成工具页 |
| `/policy` 与 `/audit` | 前者给用户查依据；后者是数据治理/核验视角，受众不同 |
| `provinceChannels` 与 `cityChannels` | 一个是 31 省兜底，一个是 10 城深核；层级和核验程度不同，只合并解析，不合并事实 |
| AI 助手与页面入口 | AI 只做辅助问答；主线必须能不用 AI 独立完成 |
| 计算内核与权益内容 | 计算需要规则/参数；权益内容只需官方入口与材料，强行放一个模型会互相污染 |

## 工程约束

- 每次只做一组合并，跑 `typecheck` + 相关单测 + E2E；不做“大爆炸式重构”。
- 新抽的公共件必须有至少两个真实使用方；只有一个使用方时留在原处。
- 页面文案、入口标题、官方链接只允许一个来源；复制粘贴视为缺陷。
- 版本：纯去重/小修走 PATCH，例如 `3.6.1`；新增页面或新能力才走 MINOR。
