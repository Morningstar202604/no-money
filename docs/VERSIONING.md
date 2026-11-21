# Versioning Policy

本项目从 **0.0.35** 起统一使用 `0.0.x` 三段式版本号，不再使用 `3.x`。历史 `3.x` 标签保留不动，仅作为归档。

## Format

```
0.0.PATCH
```

第一、二段固定为 `0`；第三段每次对外发布递增。数字不带前导零，已发布版本不带预发布后缀。

## 为什么这样定

这是个人项目，版本号首先服务于“这次推送改了第几版”，而不是对外营销。固定前两段、只加最后一段，能避免小迭代反复占用 MAJOR/MINOR 的解释成本，也让 tag 一眼看出发布顺序。

## 各段含义

| 段 | 规则 |
|---|---|
| 第一段 `0` | 固定；只有未来出现不兼容的数据格式变更时，才单独讨论是否打破 `0.0.x` |
| 第二段 `0` | 固定；不因新功能、新模块、新城市而上调 |
| 第三段 `PATCH` | 每次对外发布 +1；新功能、修复、数据修正、文案与交互调整都算一次发布 |

小迭代、小推送只增最后一段；README、注释、CI 配置、纯测试补充不单独发版。

## 历史切换

- 2026-11-21：`3.10.1` → **`0.0.35`**。`0.0.35` 是 CHANGELOG 第 35 个版本段；后续依次为 `0.0.36`、`0.0.37`、`0.0.38`、`0.0.39`。
- `v3.x` 的 tag 与提交不删除、不改写；新版本从当前 `main` 继续。

## Version locations

版本号出现在以下五处，必须同步：

| File | Field |
|---|---|
| `package.json` | `version` |
| `src-tauri/tauri.conf.json` | `version` |
| `src-tauri/Cargo.toml` | `package.version` |
| `package-lock.json` | 根与 `packages[""]` 的 `version` |
| `src-tauri/Cargo.lock` | `[[package]] name = "no-money"` 的 `version` |

`package-lock.json` 与 `src-tauri/Cargo.lock` 的根版本也要同步。`doctor` 的“版本三处一致”只覆盖前三处，两个 lock 不在检查范围；发布前必须单独核对，不能只看 doctor 绿灯。

## Release process

1. 取下一个 `0.0.x` 号；只改第三段。
2. 同步版本：
   ```bash
   node scripts/bump-version.mjs 0.0.39
   ```
   再同步 `package-lock.json` 与 `src-tauri/Cargo.lock` 的根版本。
3. 更新 `CHANGELOG.md`：新增 `[0.0.x] — 日期` 段，按 Added / Changed / Data / Tests / Docs 归类。
4. 跑完整门禁：
   ```bash
   npm run check
   npm run build
   npm run doctor
   npm run test:e2e:only
   npm run kb:check && npm run verify:entrypoints && npm run verify:reality
   ```
5. 提交 `feat(...)` / `fix(...)` / `chore(release): 0.0.x`。
6. 打 annotated tag：
   ```bash
   git tag -a v0.0.39 -m "0.0.39"
   ```
7. 推送 `main` 与 tag 到五个远端。

## Pre-release

需要试跑时用 `0.0.39-alpha.1`；只放在短分支，不打到 `main`，不作为正式发布。

## Changelog discipline

用户能感知的改动都要写一行：新功能、交互变化、数据修正、文案口径。纯内部重构、测试、CI 不单独发版，但可以在对应版本段里说明。
