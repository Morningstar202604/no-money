# 贡献指南

[English](CONTRIBUTING.md) · **简体中文**

## 开发环境

```bash
npm ci
npm run dev        # http://localhost:3000
npm test           # 全量测试（含规则溯源门禁）
npm run verify     # 引擎自检（失败会 exit 1）
npm run build      # 类型检查 + 构建
```

Node 22+。桌面端需要 Rust 工具链（`npm run tauri:dev`）。

## 动手前必读

1. **先跑一遍 `npm test`**，确认基线全绿再改
2. **读相邻代码**：项目有明确分层（见 `ARCHITECTURE.md`），照现有模式写
3. **改计算逻辑要同步对拍基准**：`ScenarioService` 的任何评分/文案改动都要同步 `src/engine/ScenarioEngine.ts`，否则 `tests/parity/` 的 213 例会红
4. **数据诚实是硬约束**：不得为新增城市编造社保基数、最低工资数值。没有官方原文就标 `unverified` 并在 note 写明「不可对外引用」

## 代码约定

- **金额用分**：domain 层一律 `Cent`（整数），对外契约用元，换算只在 `ruleAdapters.ts` 与 `ScenarioService` 结果边界
- **不写注释解释「这行在做什么」**，只解释「为什么必须这样」（尤其是防回归的坑）
- **纯函数优先**：能放 `domain/` 的别放组件里——组件内联逻辑无法单测
- **假设必须显式**：任何非官方参数都要可调、在结果里回显实际取值、写明边界

## 新增城市

1. 在 `src/data/cities.ts` 的 `CITY_REGISTRY` 登记（value / label / province / 经纬度）
2. 提供 `public/rules/<value>.json`（可复制邻城模板）
3. 逐字段填 `sources`：有官方原文才写 `official` 并给 `docNo`/`url`，否则 `unverified` + note 说明
4. 跑 `npm test`，`tests/cities.spec.ts` 会校验注册表与规则文件同步、基数比率为 5、unverified 必须披露

## 提交

- 一个可交付切片一个 commit，message 用 `type(scope): 摘要`
- type：`feat` / `fix` / `refactor` / `docs` / `test` / `chore`
- 提交前必须跑过 `npm test` + `npm run build`

## 测试

| 想验证什么 | 写在哪 |
|---|---|
| 纯计算 | `tests/domain/` |
| 服务编排 | `tests/application/` |
| 组件接线（改了一处忘另一处） | `tests/wiring/` |
| 状态与持久化 | `tests/stores/` |
| 规则数据完整性 | `tests/cities.spec.ts` / `tests/rulesGate.spec.ts` |
