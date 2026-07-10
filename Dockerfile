FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++ && \
    npm install -g pnpm@9.15.0
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine
RUN apk add --no-cache python3 make g++ && \
    npm install -g pnpm@9.15.0
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/backend/dist backend/dist/
COPY --from=builder /app/backend/drizzle backend/drizzle/
COPY --from=builder /app/frontend/dist frontend/dist/
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=data/mock.db
ENV CORS_ORIGIN=*
ENV LOG_LEVEL=info
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "backend/dist/server.js"]
