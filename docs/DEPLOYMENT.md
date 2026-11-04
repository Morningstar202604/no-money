# 部署配置
#
# 这个应用是纯静态站点（无后端、无 SSR）。
# 任何能托管静态文件的地方都能跑，这里给出主流平台的配置。
# 关键是几条缓存头：带 hash 的静态资源永久缓存，index.html 永不缓存，
# 否则用户会看到"更新了但页面还是旧的"。

## 构建产物

```bash
npm run build      # 输出到 dist/
```

`dist/` 是完整可部署目录，约 3.1 MB（gzip 后约 1.2 MB）。

---

## Vercel

仓库根目录放 `vercel.json`：

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/sw.js",
      "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ],
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```

## Netlify

仓库根目录放 `netlify.toml`：

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Nginx

```nginx
server {
    listen 80;
    server_name no-money.example.com;
    root /var/www/no-money/dist;
    index index.html;

    # SPA 路由回退：深链接（/policy、/admin）必须返回 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 带 hash 的静态资源永久缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Service Worker 不能缓存，否则用户永远拿不到新版
    location = /sw.js {
        add_header Cache-Control "no-cache";
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    # 安全头
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header Referrer-Policy strict-origin-when-cross-origin;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;
}
```

## 子路径部署

部署到 `https://example.com/no-money/` 时：

```bash
VITE_BASE=/no-money/ npm run build
```

`base` 会在构建期注入，路由与资源路径自动带上前缀。

## 静态资源清单

| 路径 | 缓存策略 | 原因 |
|---|---|---|
| `/assets/*` | 1 年 + immutable | 文件名含 content hash，内容变则名字变 |
| `/index.html` | no-cache | 必须每次回源，否则拿不到新的 asset 引用 |
| `/sw.js` | no-cache | Service Worker 更新机制要求 |
| `/manifest.webmanifest` | 1 天 | 变更不频繁 |
| `/rules/*.json` | 1 天 | 政策数据，允许短期缓存，SW 会做 stale-while-revalidate |
| `/og-image.png` | 7 天 | 分享图，不常变 |

---

## 健康检查

Web 版没有后端，无需健康检查。
若同时部署了可选的 HTTP API（`server/api.ts`），它自带 `GET /health`：

```bash
curl http://127.0.0.1:8787/health
# {"status":"ok","version":"3.1.0","cities":34,"uptime":12}
```

## 环境变量

Web 构建期只用到 `VITE_BASE`（子路径部署）。**没有任何密钥类环境变量**——
这个应用不需要。

API 服务（可选）支持：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `8787` | 监听端口 |
| `HOST` | `127.0.0.1` | 监听地址，改 `0.0.0.0` 才对外暴露 |
| `RATE_LIMIT` | `120` | 每分钟每 IP 请求上限 |

## 上线前检查清单

```bash
npm run typecheck && npm run typecheck:test
npm test
npm run verify && npm run verify:reality && npm run kb:check
npm run test:e2e
npm run build
```

全部通过后再部署。`dist/` 里不应出现 `.map` 文件（生产构建已关闭 sourcemap）。
