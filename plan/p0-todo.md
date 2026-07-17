# MockHub P0 实施 TODO 清单

> **范围**: P0 only（项目管理 + HTTP Mock + 数据联动 + 参数校验 + 可视化界面 + SQLite 持久化）
> **技术栈**: Monorepo(pnpm) + TypeScript + Node/Express + better-sqlite3 + Drizzle ORM + Zod + React/Vite/Tailwind + TanStack Query + Zustand
> **文档来源**: `docs/Mock服务平台PRD.md` v1.0
> **创建日期**: 2026-07-06
> **状态**: 待评审/执行

---

## 0. P0 实施中临时确认的开放问题

| 问题                                        | 默认决策（待你确认）                                                        | 影响 todo      |
| ------------------------------------------- | --------------------------------------------------------------------------- | -------------- |
| Q1 HTTPS                                    | 按 PRD 建议走 HTTP，仅 HTTP，HTTPS 由用户用 Nginx 反代                      | 仅 README 说明 |
| Q2 表结构                                   | 已按 PRD 9.1 落 Drizzle schema                                              | 无             |
| Q4 路由冲突                                 | 默认严格模式：禁止 method+path 同项目重复，冲突返 409；如需覆盖切模式请告知 | P3-08          |
| Q5 数据大小                                 | 默认单接口响应体 ≤1MB（Express `json` limit 设为 1mb）；超限返 413          | Express 配置   |
| Q3 脚本沙箱 / Q6 回调持久化 / Q7 回调可达性 | **P0 范围不涉及**（脚本/回调均为 P1）                                       | 无             |

> 任意默认决策如需调整，请在该 todo 的备注中说明，我会同步修改实现。

---

## Phase 0：工程脚手架

- [ ] **P0-01** 初始化 Monorepo：根目录创建 `pnpm-workspace.yaml`，声明 `backend`、`frontend`、`packages/shared` 三个 workspace；配置根级 `.npmrc` 与 `package.json`（workspaces 协议）— _PRD 8.4_
- [ ] **P0-02** 后端工程初始化：`backend/` 下创建 TS 工程，安装 `express`、`cors`、`better-sqlite3`、`drizzle-orm`、`drizzle-kit`、`zod`、`path-to-regexp`、`axios`、`dotenv`、`pino`、`pino-pretty`，配置 `tsconfig.json`（ESM + NodeNext）、`tsx` 开发模式、tsc 构建产物到 `dist/` — _PRD 8.2_
- [ ] **P0-03** 后端基础骨架：`src/app.ts`（Express 实例 + 中间件链）、`src/server.ts`（HTTP 启动）、`src/config/index.ts`（环境变量加载，端口/数据库路径/日志级别）、`src/utils/logger.ts`（pino 实例）— _依赖 P0-02_
- [ ] **P0-04** 前端工程初始化：`frontend/` 下 `pnpm create vite@latest`（React-TS 模板），安装 `tailwindcss`、`@tanstack/react-query`、`zustand`、`axios`、`react-router-dom`、`@dnd-kit/core` + `@dnd-kit/sortable`、`react-hook-form` + `@hookform/resolvers`、`zod`、`lucide-react`、`sonner`，配置 Tailwind v3 + 自定义 design token（参考 `docs/ui/theme.css`）— _PRD 8.2_
- [ ] **P0-05** 前端基础骨架：`src/main.tsx`、`src/App.tsx`、`src/router.tsx`（React Router v6 嵌套路由）、`src/layouts/MainLayout.tsx`（左侧 256px 侧边栏 + 顶栏 + 主内容区，对齐 docs/ui 视觉）— _依赖 P0-04_
- [ ] **P0-06** 工程化统一：根级 `.gitignore`、`backend/.eslintrc.cjs`、`frontend/.eslintrc.cjs`、根级 `.prettierrc`、`backend/tsconfig.base.json`、`frontend/tsconfig.json`、根级 `README.md` 占位、`.env.example`
- [ ] **P0-07** 一键启动脚本：根级 `package.json` 添加 `dev` 脚本，用 `concurrently` 同时拉起 backend（tsx watch）和 frontend（vite）；生产脚本 `build`（先 backend tsc 再 frontend vite build）、`start`（只跑 backend，serve frontend dist）— _依赖 P0-02, P0-04_

---

## Phase 1：数据层与数据库

- [ ] **P1-01** Drizzle Schema 定义：`backend/src/db/schema.ts`，按 PRD 9.1 创建 7 张表的 Drizzle 定义（projects / feature_groups / mock_apis / mock_data / request_logs / callback_configs / callback_tasks）；其中 callback_* 两张表 P0 不写 CRUD 但保留 schema 便于 P1 扩展 — _PRD 9.1.1~9.1.7_
- [ ] **P1-02** Drizzle 配置：`backend/drizzle.config.ts` 指定 SQLite 文件路径（默认 `./data/mock.db`）、schema 路径、migrations 输出路径 — _依赖 P1-01_
- [ ] **P1-03** 生成初始迁移：`pnpm drizzle-kit generate` 生成 SQL 迁移文件；编写 `backend/src/db/migrate.ts` 启动时自动执行迁移 — _依赖 P1-02_
- [ ] **P1-04** 数据库连接单例：`backend/src/db/index.ts` 导出 `getDb()`：单例 better-sqlite3 实例 + 启用 WAL、外键约束、`busy_timeout`；同时导出 `closeDb()` 用于优雅退出
- [ ] **P1-05** 数据库备份/恢复工具：`backend/src/utils/backup.ts` 提供 `backup(dbPath, targetPath)`（使用 SQLite `.backup` API）和 `restore(backupPath, dbPath)`；暴露 REST API `POST /api/admin/backup`、`POST /api/admin/restore`（需校验路径）— _PRD 5.1.6 R8_
- [ ] **P1-06** 种子数据脚本：`backend/src/db/seed.ts` 提供示例项目/功能组/接口（人脸识别 demo），便于首次启动体验 — _依赖 P1-04_

---

## Phase 2：Mock 引擎核心（核心模块，最关键）

- [ ] **P2-01** 路由编译器：`backend/src/mock-engine/router.ts`，提供 `compileRoute(path: string)` 返回 `{ regex, paramNames }`，使用 `path-to-regexp` v6；处理 `:id` 参数和通配符 `*` — _PRD 5.1.2 R3_
- [ ] **P2-02** 路由优先级匹配：`backend/src/mock-engine/matcher.ts`，实现 `matchApi(method, path, candidates): MatchedApi | null`：按 `sort_order` 升序遍历接口列表，method 必须匹配；同 method 下精确匹配 > 参数匹配 > 通配符；返回首个匹配项 — _PRD 5.1.2 R3, 11.1.2 验收_
- [ ] **P2-03** 路由表热更新：`backend/src/mock-engine/registry.ts`，维护内存中的 `RouteRegistry`（projects → feature_groups → mock_apis 索引）；提供 `reload()`、`reloadFeatureGroup(id)`；在 CRUD API 中调用以保证修改实时生效
- [ ] **P2-04** 请求参数提取：`backend/src/mock-engine/request.ts`，提供 `extractParams(req, api): { path, query, body, headers }`，统一转驼峰键，body 解析 JSON 失败时降级为原始字符串
- [ ] **P2-05** Zod 校验器：`backend/src/mock-engine/validator.ts`，根据 `mock_apis.validation_rules`（JSON）动态构建 Zod schema（必填/类型/范围/正则/自定义函数用 `.refine`）；返回 `{ ok: true, data } | { ok: false, errors }` — _PRD 5.1.4 R6_
- [ ] **P2-06** 校验失败响应：`backend/src/mock-engine/validator.ts` 导出 `buildFailResponse(rules, errors)`，根据配置的失败 status/headers/body 返回结构化错误
- [ ] **P2-07** 数据操作执行器：`backend/src/mock-engine/db-ops.ts`，实现 `db.insert(tableName, data)`、`db.select(tableName, where?)`、`db.update(tableName, where, patch)`、`db.delete(tableName, where)`；内部使用 better-sqlite3 预编译 statement，table 由调用方在脚本/SQL 中指定 — _PRD 5.1.3 R5_
- [ ] **P2-08** 动态业务表管理：`backend/src/mock-engine/schema-manager.ts`，提供 `ensureBusinessTable(tableName, sampleRow)`：若表不存在则按 sampleRow 字段自动建表（TEXT 类型宽容存储 JSON），便于 P0 "接口即建表"
- [ ] **P2-09** 响应构建器：`backend/src/mock-engine/response.ts`，提供 `buildResponse(api, data, request)`：合并 status / headers / body，支持 `{{req.x}}` `{{res.x}}` 模板变量替换（轻量正则实现，**P0 不引入 JS 沙箱**，仅做字符串模板）— _PRD 5.1.2 R4_
- [ ] **P2-10** 响应延迟：`backend/src/mock-engine/response.ts` 实现 `applyDelay(ms)`：固定延迟 `await sleep(ms)` 或随机范围 `randomInRange(min, max)`
- [ ] **P2-11** Mock 引擎主入口：`backend/src/mock-engine/handler.ts`，导出 `handleMockRequest(req, res)`：按 `matchApi` → `extractParams` → `validate` → `executeDbOps`（按 api 配置的 `data_op` 类型自动调用 db-ops）→ `buildResponse` → `applyDelay` → 写 res — _依赖 P2-02~P2-10_
- [ ] **P2-12** 调用日志写入：handler 中各分支写入 `request_logs` 表（同步，失败不抛）；P0 暂不提供日志查询 UI（日志 UI 走 P1），仅持久化数据 — _PRD 5.2.6 R13 数据层_
- [ ] **P2-13** 异常隔离：`backend/src/mock-engine/handler.ts` 顶层 try/catch，引擎内部任何异常都返回 500 + 错误明细 JSON，绝不让 Mock 服务整体崩溃 — _PRD 11.3 稳定性验收_

---

## Phase 3：管理 API（后端 REST）

- [ ] **P3-01** 统一响应包装：`backend/src/middleware/response.ts` 注入 `res.success(data)`、`res.fail(code, msg)`；错误处理中间件 `backend/src/middleware/error-handler.ts` 捕获 ZodError / 业务错误
- [ ] **P3-02** 项目 CRUD API：`backend/src/controllers/projects.ts` + `backend/src/routes/projects.ts`，实现 `GET /api/projects`、`POST /api/projects`、`PUT /api/projects/:id`、`DELETE /api/projects/:id`；name 唯一性校验通过 DB UNIQUE 约束 + 应用层预检双保险 — _PRD 5.1.1 R1_
- [ ] **P3-03** 项目级联删除：删除项目时事务内删除关联 feature_groups / mock_apis / mock_data（P0 不做软删除）— _PRD 11.1.1 验收_
- [ ] **P3-04** 功能组 CRUD API：`backend/src/controllers/feature-groups.ts` + `backend/src/routes/feature-groups.ts`，实现 `GET/PUT/DELETE/POST /api/projects/:pid/feature-groups`，含 `PATCH /api/projects/:pid/feature-groups/reorder` 接收数组批量更新 sort_order — _PRD 5.1.1 R2_
- [ ] **P3-05** 功能组同名校验：DB UNIQUE(project_id, name) + 应用层预检
- [ ] **P3-06** Mock 接口 CRUD API：`backend/src/controllers/mock-apis.ts` + `backend/src/routes/mock-apis.ts`，实现 `GET /api/feature-groups/:fgid/mock-apis`、`POST /api/feature-groups/:fgid/mock-apis`、`GET/PUT/DELETE /api/mock-apis/:id`；name 必填、method 白名单、path 正则预检 — _PRD 5.1.2 R3, R4_
- [ ] **P3-07** 接口启用/禁用：单独 `PATCH /api/mock-apis/:id/toggle` 设置 `is_enabled`
- [ ] **P3-08** 路由冲突校验：创建/更新接口时检测 `(method, path)` 在同项目内是否与已启用接口冲突，冲突返回 409 + 详细错误（**默认按 Q4 严格模式**：禁止覆盖，待用户确认后切换为覆盖/优先级模式）— _PRD 7 Q4_
- [ ] **P3-09** 接口"运行测试"端点：`POST /api/mock-apis/:id/test`，构造一次内部调用（绕过 HTTP 直接调用 handler），返回 `{ response, logs }`，用于前端"运行测试"按钮 — _PRD 11.1.5 验收_
- [ ] **P3-10** 数据联动配置存储：在 mock_apis 上加 `data_op` 字段（`none | insert | select | update | delete`）+ `data_table`（业务表名）+ `data_where`（JSON where 条件）三个字段写入 schema；通过 `mock-apis` CRUD 统一管理 — _PRD 5.1.3 R5_
- [ ] **P3-11** Mock 数据管理 API：`backend/src/controllers/mock-data.ts` + `backend/src/routes/mock-data.ts`，实现按 api_id 维度的手动数据 CRUD `GET/POST/PUT/DELETE /api/mock-apis/:id/data` — _PRD 5.1.6 R8_
- [ ] **P3-12** 数据浏览器 API：`GET /api/projects/:pid/data-browser`：聚合列出该项目所有 mock_data + 业务表（通过 schema-manager 元数据），支持搜索 — _PRD 5.1.5 R7 + 11.1.5 验收_
- [ ] **P3-13** 备份/恢复 API：`POST /api/admin/backup`、`POST /api/admin/restore`（已 P1-05 实现），`GET /api/admin/backups` 列出已有备份
- [ ] **P3-14** 路由挂载：在 `app.ts` 中分三段挂载：`/mock/*` → Mock 引擎 handler；`/api/*` → 管理 REST API；`/health` → 健康检查
- [ ] **P3-15** CORS + 代理：开发期开启 CORS；Vite proxy 把 `/api` `/mock` 转发到 backend

---

## Phase 4：前端基础架构

- [ ] **P4-01** API 客户端：`frontend/src/lib/api.ts` 封装 axios 实例（baseURL、错误统一处理、401/500 Toast）
- [ ] **P4-02** TanStack Query hooks：`frontend/src/hooks/queries/` 下按资源分文件（`useProjects.ts`、`useFeatureGroups.ts`、`useMockApis.ts`、`useMockData.ts`）；QueryClient 配置（staleTime、retry、重试延迟）— _依赖 P4-01_
- [ ] **P4-03** Zustand store：`frontend/src/stores/ui-store.ts` 管当前选中的项目 ID、功能组 ID、侧边栏折叠状态、主题等 UI 状态；持久化到 localStorage
- [ ] **P4-04** Zod Schema 共享：把后端用到的 Zod schema 复制到 `packages/shared/src/schemas/`，前后端共用（**P0 阶段先复制不抽包，P1 再统一**）；保证 API 入参出参类型一致
- [ ] **P4-05** 通用组件：`frontend/src/components/ui/` 实现 `Button`、`Input`、`Select`、`Modal`、`Drawer`、`Tabs`、`Card`、`Badge`、`Empty`、`Table`；风格对齐 docs/ui（Bento Console Flat Light，Geist 字体）— _依赖 P0-04_
- [ ] **P4-06** 反馈组件：Toast（基于 sonner）、Confirm 弹窗、Loading 全屏遮罩
- [ ] **P4-07** 表单组件：基于 react-hook-form + zod resolver 的 `FormField` 封装，含错误展示
- [ ] **P4-08** 拖拽封装：`frontend/src/components/SortableList.tsx` 基于 `@dnd-kit/sortable`，对外暴露 `items` + `onReorder`，功能组排序复用 — _依赖 P4-05_

---

## Phase 5：前端页面

- [ ] **P5-01** 项目列表页：`frontend/src/pages/ProjectsPage.tsx`，对应 `docs/ui/index.html`：顶部统计卡片（项目数/接口数/今日请求占位），项目卡片网格，搜索框，新建/编辑/删除弹窗（用 P4-05 Modal），空状态引导 — _PRD 10.2.1, 11.1.1 验收_
- [ ] **P5-02** 项目详情页：`frontend/src/pages/ProjectDetailPage.tsx`，对应 `docs/ui/project.html`：面包屑、左侧功能组列表（可折叠、可拖拽排序、可右键/操作菜单），右侧选中功能组下的接口表格（方法标签、路径、状态、操作列）
- [ ] **P5-03** 新建/编辑功能组弹窗：名称（必填，同项目内校验唯一）、描述
- [ ] **P5-04** 接口编辑页：`frontend/src/pages/ApiEditPage.tsx`，对应 `docs/ui/api-edit.html`：基础信息卡（名称/方法/路径/类型/状态）、请求参数表格（参数名/类型/必填/默认值）、参数校验规则表、响应配置（状态码/延迟/Headers/Body JSON 编辑器+格式化）、数据联动配置（操作类型+目标表）— _PRD 10.2.3, 11.1.2 验收_
- [ ] **P5-05** 接口编辑-路由冲突提示：保存前调 `validateRoute` 预览冲突，错误以行内提示展示
- [ ] **P5-06** 接口列表操作列：编辑、删除、启用/禁用切换、复制（生成同名_v2，简化 P0）、运行测试（弹抽屉显示响应）
- [ ] **P5-07** 数据管理页：`frontend/src/pages/DataPage.tsx`，对应 `docs/ui/data.html`：左侧接口树，右侧数据表（按接口展示 mock_data + 业务表），支持新建/编辑/删除/搜索；提供"查看表结构"展开 schema-manager 推断的列 — _PRD 5.1.5 R7, 11.1.5 验收_
- [ ] **P5-08** 运行测试抽屉：请求方法/路径/Headers/Body 输入区，发送按钮，响应展示（status/headers/body/RT），复制 cURL
- [ ] **P5-09** 设置页（最小版）：`frontend/src/pages/SettingsPage.tsx`，数据库路径展示、备份/恢复按钮组（调 P3-13）、版本信息
- [ ] **P5-10** 全局错误边界：`frontend/src/components/ErrorBoundary.tsx` 兜底任意 React 错误，避免白屏

---

## Phase 6：集成与端到端验证

- [ ] **P6-01** 开发代理配置：`frontend/vite.config.ts` 配置 server.proxy：`/api` `/mock` 转发到 `http://localhost:3000`
- [ ] **P6-02** 启动脚本调通：根 `pnpm dev` 同时拉起前后端，端口 3000（backend）+ 5173（frontend dev），日志分色输出
- [ ] **P6-03** 首次启动 README 引导：在 README 里写明 "克隆 → pnpm install → pnpm dev → 访问 http://localhost:5173 → 一键创建示例 Mock 接口"
- [ ] **P6-04** 种子数据示例：默认种子提供一个"人脸识别"项目，含 `POST /mock/face/add`（INSERT face_data）和 `GET /mock/face/list`（SELECT face_data），方便首次启动看到完整链路 — _PRD 9.2 数据联动设计示例_
- [ ] **P6-05** 端到端冒烟脚本：`scripts/smoke.sh` 用 curl 跑完整链路：建项目 → 建功能组 → 建接口 → curl 触发 → 验证响应 → 验证 DB
- [ ] **P6-06** 路由优先级用例脚本：`scripts/route-priority.sh`：创建 `/a/:id` 与 `/a/static`，验证 `GET /a/static` 命中静态（**待确认**：精确匹配规则由 path-to-regexp 自动处理，需写用例验证）

---

## Phase 7：性能与稳定性验收

- [ ] **P7-01** 基准压测脚本：`scripts/perf.js`（用 autocannon），验证无逻辑接口 <50ms、含一次 db.select <100ms — _PRD 6.3 性能指标, 11.2 验收_
- [ ] **P7-02** 100 QPS 压力测试：连续 5 分钟 100 QPS，验证零错误、内存稳定 — _PRD 6.3 性能指标, 11.2 验收_
- [ ] **P7-03** 24h 稳定性测试：脚本循环跑核心接口，每小时记录一次内存/CPU/错误数，确认无崩溃 — _PRD 11.3 验收_
- [ ] **P7-04** 异常场景矩阵：脚本枚举 8 种异常（脚本错误 / P0 已退化为无脚本则改为模板错误 / DB 锁 / 路径冲突 / 超大 body / 非法 JSON / 并发写 / 路由找不到），全部返回友好错误不崩溃 — _PRD 11.3 验收_
- [ ] **P7-05** 备份恢复演练：跑一次备份 → 删除数据 → 恢复 → 校验一致性

---

## Phase 8：交付与文档

- [ ] **P8-01** README：项目介绍、快速开始、架构图（贴 PRD 8.1 ASCII）、目录说明、常用命令、配置项
- [ ] **P8-02** 数据备份恢复指南：写在 README + 文档站
- [ ] **P8-03** 接口配置教程：从 0 创建第一个人脸识别 Mock 接口的截图/步骤（用 docs/ui 原型截图即可）
- [ ] **P8-04** 验收 checklist 走查：按 PRD 11.1.1~11.1.6 + 11.2 + 11.3 逐条勾选，输出验收报告

---

## 依赖关系速览（推荐执行顺序）

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──┬─► Phase 4 ──► Phase 5 ──┬─► Phase 6 ──► Phase 7 ──► Phase 8
                                              │                       │
                                              └───────────────────────┘
```

- **关键路径**：P2（Mock 引擎）是灵魂，P0-01~~P0-07 + P1-01~~P1-04 + P2-01~P2-13 跑通后即可独立验证 Mock 服务能力
- **并行机会**：Phase 4 前端基础架构可与 Phase 2/3 后端并行推进（通过 OpenAPI / mock server 解耦）
- **里程碑 1（MVP）**：P0~P3 跑通 + P6-04 种子数据，可独立演示核心 Mock 能力
- **里程碑 2**：P4 + P5 完成后是带界面的完整 P0
- **里程碑 3**：P7 验收 + P8 文档 = P0 正式收尾

---

## 统计

- **总 todo 数**: 73 条
- **分布**: Phase 0(7) · Phase 1(6) · Phase 2(13) · Phase 3(15) · Phase 4(8) · Phase 5(10) · Phase 6(6) · Phase 7(5) · Phase 8(4)
- **PRD 验收覆盖**: 11.1.1 项目管理 · 11.1.2 HTTP Mock · 11.1.5 数据联动 · 11.1.6 参数校验 · 11.2 性能 · 11.3 稳定性
- **不覆盖（推迟到 P1）**: 11.1.3 WebSocket · 11.1.4 SSE · 11.1.7 延迟回调 · 11.1.8 自定义脚本 · 11.1.9 部分（导入导出·调用日志 UI）
