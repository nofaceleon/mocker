# ---- Stage 1: 安装依赖 + 构建 ----
FROM node:20-slim AS builder
ARG NODE_OPTIONS
ENV NODE_OPTIONS=$NODE_OPTIONS
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9.15.0
WORKDIR /app

# 依赖层（利用 Docker 层缓存）
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile

# 源码 + 构建
COPY . .
RUN pnpm build

# ---- Stage 2: 生产镜像 ----
FROM node:20-slim
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=data/mock.db
EXPOSE 3000
VOLUME ["/app/data"]

WORKDIR /app

# 直接拷贝 builder 的 node_modules，避免二次安装（native addon 无需重编）
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/frontend/node_modules ./frontend/node_modules

# 拷贝构建产物
COPY --from=builder /app/backend/dist backend/dist/
COPY --from=builder /app/backend/drizzle backend/drizzle/
COPY --from=builder /app/frontend/dist frontend/dist/

CMD ["node", "backend/dist/server.js"]
