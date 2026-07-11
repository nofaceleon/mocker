# MockHub — AGENTS.md

## 快速开始

```bash
pnpm install
pnpm db:migrate    # 执行 drizzle 迁移
pnpm db:seed       # 注入种子数据（人脸识别演示项目）
pnpm dev           # 同时启动后端 (3000) + 前端 (5173)
```

## 单体仓库结构

pnpm workspace，包含 `backend/`（`@mockhub/backend`）、`frontend/`（`@mockhub/frontend`）、`packages/*`（未使用）。

## 命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 同时启动后端 + 前端 |
| `pnpm build` | 先构建 `backend`，再构建 `frontend`（顺序重要） |
| `pnpm typecheck` | `pnpm -r run typecheck` |
| `pnpm lint` | `pnpm -r run lint` |
| `pnpm format` | Prettier（ts,tsx,js,jsx,json,md,css,html） |
| `pnpm db:generate` | `drizzle-kit generate`（schema → `backend/drizzle/` 中的 SQL） |
| `pnpm db:migrate` | 应用迁移到 SQLite |
| `pnpm db:seed` | 插入演示项目/功能组/API |
| `pnpm start` | 生产模式：`node backend/dist/server.js` |

不存在测试框架。唯一验证手段是 `scripts/callback-smoke.sh`（bash 端到端脚本）。

## 后端注意事项

- **ESM** — 导入使用 `.js` 后缀（`import { x } from './foo.js'`）。开发时 `tsx` 处理；`tsc` 输出真正的 `.js`。
- **数据库自动迁移** — 首次调用 `getDb()` 时自动执行迁移。修改 schema 后只需重新运行 `db:migrate`。
- **API 响应包装** — 所有管理 API 路由通过 `res.success(data)` / `res.fail(code, msg, status)` 响应。前端用 `unwrap<T>(resp)` 解包。格式：`{code: 'OK', data: T}`。
- **Mock 引擎挂在根路径** `app.use('/', handleMockRequest)` — 捕获所有未被 `/api/*` 或静态文件处理的路由。
- **配置** — 通过 dotenv 从 `.env` 加载（复制 `.env.example`）。关键默认值：端口 3000，数据库路径 `../data/mock.db`（相对于 backend 工作目录），CORS `http://localhost:5173`。
- **日志**：开发环境使用 pino + pino-pretty。

## 前端注意事项

- Vite 代理 `/api`、`/mock`、`/health` → `localhost:3000`。
- 路径别名 `@/` → `src/`。
- 路由通过 `lazy: () => import(...)` 懒加载。
- TanStack Query 默认值：`staleTime: 30s`、`retry: 1`、`refetchOnWindowFocus: false`。
- Sonner toast：5xx/网络错误弹 toast；4xx 透传给调用方处理。

## 架构

- **数据模型**：Projects → FeatureGroups → MockApis（级联删除）。
- **Mock 引擎流程**：注册表（内存） → 路径匹配器（`path-to-regexp`，`:param` 语法，精度排序） → Zod 校验器 → 响应模板渲染器 → 回调调度器。
- **响应体模板语法**：`{{req.body.x}}`、`{{req.query.x}}`、`{{req.path.x}}`、`{{dbResult}}`。
- **数据操作**：通过 `dataOp` 操作动态业务表（insert/select/update/delete）——首次 insert 时自动建表。
- **SSE**：protocol 字段 = `SSE`，配置格式 `{ events: [...], interval, loop, comment }`。
- **回调**：延时异步 HTTP 回调，支持重试（固定间隔/指数退避），持久化到数据库，后台调度器。

## 代码风格

- Prettier：`singleQuote`、`trailingComma: "all"`、`printWidth: 100`。
- EditorConfig：LF 换行、2 空格缩进。
- 数据库 schema 约定：列名 snake_case、TS 字段 camelCase、时间戳用 `integer`（毫秒）。
