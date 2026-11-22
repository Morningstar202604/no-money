# 没钱 No Money 0.1.2 — Windows 安装包

本目录用于 GitCode / Gitee 这类没有独立 Release 附件区的平台：安装包直接放在仓库目录里。

## 文件

| 文件 | 类型 | 大小 | SHA-256 |
|---|---|---:|---|
| `NoMoney_0.1.2_x64-setup.exe` | NSIS 安装程序 | 3.08 MB | `ace9f7b2f3c76ffbcb2ac593ed525d2d39400a3e822cb0ef321b718a37b78976` |
| `NoMoney_0.1.2_x64_zh-CN.msi` | MSI 安装包（简体中文） | 4.07 MB | `0ecaa87145c386bd0409af474f253d02ab9f5970348f36a9d44359703013ecc4` |

- 适用系统：Windows 10 / 11 x64
- 构建来源：Desktop installers workflow，run `44994942970`，提交 `f13c893`
- 版本：`0.1.2`

## 安装

1. 下载 `NoMoney_0.1.2_x64-setup.exe`，双击安装；或下载 `.msi` 交给系统安装器。
2. 安装包未做代码签名，Windows SmartScreen 可能提示“未知发布者”。请先核对上面的 SHA-256，再选择“更多信息 → 仍要运行”。
3. 首次启动需要系统自带 WebView2；Windows 10 21H2 及以上和 Windows 11 默认具备。

## 校验

PowerShell：

```powershell
Get-FileHash .\NoMoney_0.1.2_x64-setup.exe -Algorithm SHA256
Get-FileHash .\NoMoney_0.1.2_x64_zh-CN.msi -Algorithm SHA256
```

哈希与上表一致再安装。
