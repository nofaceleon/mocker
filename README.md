# MockHub

通用接口 Mock 服务平台 — 通过可视化界面配置 HTTP Mock 接口、参数校验、数据联动与持久化存储。

## 技术栈

- **后端**: Node.js + Express + TypeScript + better-sqlite3 + Drizzle ORM + Zod
- **前端**: React 18 + Vite + TypeScript + Tailwind CSS + TanStack Query + Zustand
- **存储**: SQLite（单文件，零运维）

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 初始化数据库 + 种子数据
pnpm db:migrate
pnpm db:seed

# 3. 启动开发服务（同时拉起 backend + frontend）
pnpm dev
```

启动后访问：

- 前端界面: <http://localhost:5173>
- 后端 API: <http://localhost:3000/api>
- 健康检查: <http://localhost:3000/health>
- Mock 入口: <http://localhost:3000/mock/*>

## 目录结构

```
mockhub/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── controllers/     # 控制器
│   │   ├── routes/          # 路由
│   │   ├── middleware/      # 中间件
│   │   ├── services/        # 业务逻辑
│   │   ├── db/              # 数据库 schema/迁移
│   │   ├── mock-engine/     # Mock 引擎核心
│   │   ├── config/          # 配置
│   │   └── utils/           # 工具
│   └── data/                # SQLite 文件目录（运行时生成）
├── frontend/                # 前端工程
│   ├── src/
│   │   ├── pages/           # 页面
│   │   ├── components/      # 组件
│   │   ├── hooks/           # 自定义 hooks
│   │   ├── stores/          # Zustand 状态
│   │   ├── lib/             # 工具/客户端
│   │   └── layouts/         # 布局
│   └── public/              # 静态资源
├── packages/shared/         # 前后端共享类型（预留）
├── docs/                    # PRD + UI 原型
├── plan/                    # 实施计划
├── data/                    # SQLite 数据库文件 + 备份
└── scripts/                 # 运维/测试脚本
```

## 常用命令

| 命令              | 说明                                 |
| ----------------- | ------------------------------------ |
| `pnpm dev`        | 同时启动 backend + frontend 开发模式 |
| `pnpm build`      | 构建生产产物                         |
| `pnpm start`      | 启动后端（需先 build）               |
| `pnpm typecheck`  | 全工程类型检查                       |
| `pnpm lint`       | 全工程 ESLint                        |
| `pnpm format`     | Prettier 格式化                      |
| `pnpm db:migrate` | 执行数据库迁移                       |
| `pnpm db:seed`    | 注入种子数据                         |

## 文档

- [PRD](./docs/Mock服务平台PRD.md)
- [实施计划](./plan/p0-todo.md)
- [UI 原型](./docs/ui/)

## 状态

当前实现范围：**P0（最小可用）**。详见 [`plan/p0-todo.md`](./plan/p0-todo.md)。
