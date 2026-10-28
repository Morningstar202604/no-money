# 安全说明

## 数据边界

本应用**没有后端**。所有测算都在浏览器本地完成，参数存在浏览器 localStorage。

**唯一的出网点**：用户在「AI 助手 → API 设置」里主动启用并填入自己的 API Key 后，以下数据会发送到**用户自己填写的**第三方模型接口：

- 城市、日工时、日单量、月工作天数
- 月收入、月成本、月个税、净收入、时薪、权益评分
- 最近 6 条对话内容

不启用 AI 即完全离线。

## API Key 处理

- **默认不持久化**：Key 只存在于内存，关闭标签页即失效
- 勾选「在本机记住」后才以明文写入 localStorage，同源脚本与浏览器扩展均可读取（用户显式承担的风险）
- **Endpoint 强制校验**（`src/utils/endpoint.ts`）：非本机地址必须 `https`；拒绝相对路径；拒绝内嵌用户名密码的 URL（`https://legit.com@evil.com` 这类钓鱼写法）
- **失败信息不外泄**：服务端错误体只打印到浏览器 console，聊天气泡里显示按状态码本地化的文案

## 桌面端（Tauri）

- CSP 以 `default-src 'self'` 为基线，并补 `object-src 'none'` / `base-uri 'self'` / `frame-ancestors 'none'` / `form-action 'self'`（防 XSS 后的对象注入、`<base>` 劫持与点击劫持）
- `connect-src` 放开 `https:` 是**已知取舍**：产品允许用户填任意 OpenAI 兼容端点，无法预先穷举域名。由此产生的风险与缓解：
  - 风险：同源脚本被注入或浏览器扩展篡改 `nomoney_ai_cfg` 后，Key 可被发往任意 HTTPS 主机
  - 缓解：Endpoint 强制 https、拒绝内嵌凭据、设置页实时显示「Key 将发送至 <host>」、Key 默认不持久化
  - 若要进一步收紧：把自定义端点请求改走 Rust 命令并维护域名白名单（当前未实现，属已知缺口）
- **不启用任何 Tauri 插件**（store / fs / shell 等全部移除）：应用是纯前端 + 本地静态资源，不需要原生能力；`shell` 与 `fs` 尤其扩大攻击面
- 唯一保留的 Rust 命令是 `get_app_version`（无 I/O）

## 已修复的安全问题

| 问题 | 修复 |
|---|---|
| Tauri `get_rules_data` / `save_rules_data` 的 `city` 参数直接拼路径，可读写应用目录外任意文件 | 已删除这两个命令（前端走 `fetch('/rules/*.json')`） |
| 致命错误屏用 `innerHTML` 拼接 `err.message`（可含用户可篡改的 localStorage 片段） | 改为 DOM API 按文本节点插入 |
| 19 项 npm 依赖漏洞（含 7 critical） | 删除零引用 devDeps + 升级 echarts/vitest/vite，现 0 漏洞 |

## 报告问题

发现安全问题请勿公开提交 issue，直接联系维护者（见仓库主页）。处理时限：72 小时内确认，修复前不公开细节。

**Key 泄露处置**：①到提供商后台立即撤销该 Key → ②在本应用「AI 设置」里清除并取消勾选「记住」→ ③检查 endpoint 是否被改成陌生域名 → ④观察提供商账单是否有异常调用。本应用不处理任何真实身份信息（文书生成里的姓名/电话/身份证只存在页面内存，不写入 localStorage、不参与联网请求、导出文件由用户自行保管）。
