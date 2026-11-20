# 依赖漏洞例外记录

> 规则：每条例外必须有「影响评估 + 为什么现在不能修 + 复查触发条件」。
> 只写"已知问题"不算记录——那等于没有。

核查命令：`npm audit --registry=https://registry.npmjs.org`

## 当前状态

| 日期 | 高危 | 中危 | 低危 | 说明 |
|---|---:|---:|---:|---|
| 2026-11-07 | 0 | 0 | 4 | 全部来自同一条 `deepmerge` 传递依赖 |
| 2026-11-20 | 0 | 1 | 4 | Cargo 侧 `glib 0.18.5` 的迭代器健全性告警；无兼容修复路径 |

## 例外 1：deepmerge（GHSA-gcqx-w48m-w2h4）

**漏洞**：`mergeObject()` 存在原型污染风险（low）。

**依赖链**：
```
vite-plugin-pwa@2.0.0
  └─ workbox-build@7.4.1
      └─ @rollup/plugin-node-resolve@16.0.3
          └─ deepmerge@4.3.1
```

**影响评估：不进入运行时产物。**
- 这条链只在 `npm run build` 期间执行（生成 Service Worker 预缓存清单）。
- 构建产物 `dist/` 中不含 deepmerge 代码（已用 `grep -r deepmerge dist/` 验证为空）。
- 触发条件是"被 merge 的对象来自不可信输入"。build 期间的输入是本仓库自己的配置对象，
  攻击者需要先能改仓库文件——那时已不需要原型污染。

**为什么现在不能修**：
- `deepmerge` 最新版就是 4.3.1，该 advisory 的修复版本未发布。
- `npm audit fix --force` 会把 `vite-plugin-pwa` 降到 0.x（破坏 PWA 能力），代价远大于收益。
- 已尝试 `overrides: { deepmerge: "^4.3.1" }`，确认无更高版本可覆盖。

**复查触发条件**（满足任一即重新评估）：
1. `deepmerge` 发布含修复的版本 → 立即升级并删除本条例外。
2. `vite-plugin-pwa` 升级到不再依赖 `@rollup/plugin-node-resolve@16` 的版本。
3. 本项目开始在**运行时**使用任何依赖 deepmerge 的库 → 例外失效，必须处理。

**验证方法**：
```bash
npm ls deepmerge                      # 确认只在构建链
grep -r "deepmerge" dist/ || echo "确认未进入产物"
npm audit --registry=https://registry.npmjs.org
```

## 例外 2：glib（GHSA-wrw7-89jp-8q8g）

**漏洞**：`glib::VariantStrIter` 的 `Iterator` / `DoubleEndedIterator` 实现存在健全性问题（medium）。

**依赖链**：
```
tauri@2.12.5
  └─ tao@0.37.1
      └─ gtk@0.18
          └─ glib@0.18.5
```

**影响评估：不进入 Web/IPC 运行时路径。**
- 这条链只在 Tauri 的 Linux 桌面壳里服务窗口与 GTK 事件循环；本项目前端、API、MCP 与 CLI 都不调用 `glib::VariantStrIter`。
- 触发前提是调用方把不可信的 `Variant` 字符串交给该迭代器；当前代码没有这种入口。
- `npm audit` 与 Web 产物不受影响，`dist/` 中没有 glib 代码。

**为什么现在不能修**：
- `tao 0.37.1` 依赖 `gtk 0.18` 生态，后者使用 `glib ^0.18`；修复版本 `glib 0.20.0` 与 `gtk 0.18` / `tao` 的 API 不兼容，直接升级无法编译。
- 上游 Tauri 尚未发布切换到 `glib 0.20` 的 `tao` 版本；`cargo update -p glib` 只能停在 0.18.5。
- Dependabot 的 security update 会报 `security_update_not_possible`（latest resolvable 0.18.5，lowest non-vulnerable 0.20.0）；已在 GitHub 将告警标记为 `tolerable_risk` 并留此记录。

**复查触发条件**（满足任一即重新评估）：
1. Tauri / tao 发布使用 `gtk 0.20` 或 `glib 0.20` 的版本 → 立即升级并删除本条例外。
2. 本项目开始在 Linux 桌面壳中直接处理不可信 `Variant` 字符串 → 例外失效。
3. GitHub Advisory 升级为 high/critical → 例外失效，必须修。

**验证方法**：
```bash
cd src-tauri && cargo tree -i glib
cargo update -p glib --dry-run
```

## 维护约定

- 每次升级依赖后重跑 `npm audit`，更新本表日期与计数。
- 新增例外必须按上面三段式（影响/为何不修/复查条件）书写。
- `npm run doctor` 会检查本文件存在；高危（high/critical）不允许记例外，必须修。
