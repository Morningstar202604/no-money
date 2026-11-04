# 第三方许可声明

本应用在生产构建中包含以下开源依赖。每个依赖的完整许可文本位于
`node_modules/<包名>/LICENSE`，或该包的代码仓库。

生成时间：2026-11-04
生产依赖总数：5

## 许可类型分布

| 许可 | 数量 |
|---|---:|
| MIT | 4 |
| Apache-2.0 | 1 |

## 依赖清单

| 包 | 版本 | 许可 |
|---|---|---|
| `echarts` | 6.1.0 | Apache-2.0 |
| `naive-ui` | 2.45.3 | MIT |
| `pinia` | 2.3.1 | MIT |
| `vue` | 3.5.44 | MIT |
| `vue-router` | 4.6.4 | MIT |

## 需要说明的许可

**MIT（4 个）**：允许商用、修改、分发，需保留版权声明。与本项目许可一致。
**Apache-2.0（1 个）**：允许商用，需保留 NOTICE 文件与专利授权条款。
- `echarts` — 完整文本见 `node_modules/echarts/LICENSE`

## 本项目许可

本项目以 MIT 许可发布，见 [LICENSE](LICENSE)。

## 如何验证这份清单

```bash
node scripts/gen-licenses.mjs --check   # 与当前依赖比对，不一致则退出码 1
```
