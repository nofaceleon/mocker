# MockHub P1 实施 TODO

> **范围**: P1（自定义脚本沙箱 · 配置 JSON 导入导出 · WebSocket Mock · 边角打磨）  
> **前置**: P0 已具备 HTTP Mock、数据联动、参数校验、SSE、延迟回调、调用日志、Swagger 导入  
> **文档**: `docs/Mock服务平台PRD.md` §5.2 / §11.1.3 / §11.1.8 / §11.1.9  
> **创建日期**: 2026-07-12  
> **执行顺序**: A → B → C → D（A 优先，C 依赖 A 的脚本能力）

---

## 0. 已完成（不在 P1 重做）

| 能力 | 状态 |
|---|---|
| SSE Mock (R10) | 已完成 |
| 延迟回调 + 重试 + 任务页 (R14–R16) | 已完成 |
| 调用日志 UI (R13) | 已完成 |
| 声明式 dataOp 数据联动 | 已完成 |
| Swagger 导入 | 已完成 |
| DB 文件备份/恢复 | 已完成 |

---

## Phase A：自定义脚本沙箱（R11）— 最高优先

- [x] **A1** 脚本运行时 `backend/src/mock-engine/script-runtime.ts`：Node `vm` 沙箱；超时默认 2000ms；禁 require/process/fs/net；捕获异常
- [x] **A2** 注入 API：`req` / `db` / `log` / `dbResult`
- [x] **A3** 引擎接入：dataOp 之后执行 script，返回值覆盖响应体
- [x] **A4** 错误响应：`SCRIPT_ERROR` 500 + 写日志
- [x] **A5** 前端 ScriptPanel 文档与 STARTER
- [x] **A6** index 导出

---

## Phase B：配置 JSON 导入/导出（R12）

- [x] **B1** `backend/src/services/project-export.ts`
- [x] **B2** `GET /api/projects/:id/export`
- [x] **B3** `POST /api/projects/import`
- [x] **B4** 前端导出/导入 UI
- [x] **B5** JSON `version: 1`

---

## Phase C：WebSocket Mock（R9）

- [x] **C1** `ws` + server upgrade
- [x] **C2** protocol=WebSocket 路径匹配
- [x] **C3** welcome + echo / script 回包
- [x] **C4** pushInterval / disconnectAfterMs
- [x] **C5** Basic/Response 面板提示与默认配置
- [x] **C6** 连接/消息写 request_logs（format=websocket）

---

## Phase D：边角打磨（可选穿插）

- [x] **D1** 回调任务时间范围过滤（1h/24h/7d/custom + 后端 createdAt）
- [x] **D2** Data 页去掉无效 stub 按钮，提示走项目导入导出
- [x] **D3** 数据联动表名 datalist（useBusinessTables）
- [x] **D4** 脚本面板 Monaco 编辑器（语法高亮）

---

## 依赖关系

```
A1–A4 ──► A5
       └──► C（WS 消息脚本复用 runtime）
B 可与 A 后半 / C 并行
D 随时穿插
```

## 里程碑

| 里程碑 | 交付 |
|---|---|
| P1.1 | Phase A 完成 |
| P1.2 | Phase B 完成 |
| P1.3 | Phase C 完成 |
| P1.4 | Phase D + 文档勾选 |

---

## 不在 P1

- R17 高级数据联动 · R18 场景管理 · R19 性能监控 · R20 多协议  
- packages/shared 抽包（工程债，可另开）  
- Monaco 自动补全（A5 仅完善文档与示例；编辑器增强可后续）
