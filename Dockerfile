# syntax=docker/dockerfile:1

# =====================================================================
# Web 静态站镜像（Nginx 托管 dist/，SPA 回退 + 正确的缓存头）
# ---------------------------------------------------------------------
# 为什么多阶段 + nginx:alpine：
#   构建期需要 Node 22 + 全部 devDependencies（>500MB），
#   运行期只需要静态文件。两阶段分离后运行镜像 < 30MB，
#   且构建层可以被 CI 缓存（package.json 不变就不重装依赖）。
# =====================================================================

# ---------- 构建阶段 ----------
FROM node:22-alpine AS build
WORKDIR /app

# 先拷依赖清单再装依赖：这两层的产物会被 Docker 缓存，
# 源码改动不触发 npm ci（全量安装约 1-2 分钟，缓存命中后为 0）
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# 再拷源码并构建
COPY . .
RUN npm run build

# ---------- 运行阶段 ----------
FROM nginx:1.27-alpine AS runtime

# 停掉 nginx 默认站点，拷入我们的配置与构建产物
RUN rm /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/conf.d/app.conf
COPY --from=build /app/dist /usr/share/nginx/html

# 健康检查：静态站没有 /health，用首页是否可达代替
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

EXPOSE 80

# nginx 镜像自带前台运行与信号转发，无需自定义 CMD
