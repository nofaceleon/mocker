import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq, gte, inArray, like, lte, or, sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  callbackConfigs,
  callbackTasks,
  featureGroups,
  mockApis,
  type CallbackConfig,
} from '../db/schema.js';
import { ApiError, asyncHandler } from '../middleware/error-handler.js';
import { callbackScheduler } from '../mock-engine/callback/callback-scheduler.js';
import { cancelTask, reExecute } from '../mock-engine/callback/callback-engine.js';

const router = Router();

// ----------------------- 配置（多回调链） -----------------------

const apiIdParamSchema = z.object({ apiId: z.coerce.number().int().positive() });
const callbackIdParamSchema = z.object({
  apiId: z.coerce.number().int().positive(),
  callbackId: z.coerce.number().int().positive(),
});

/** 单条回调的入参 schema（用于 PUT 整组时数组元素） */
const configItemSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().max(100).nullable().optional(),
  isEnabled: z.boolean().optional().default(false),
  callbackUrl: z.string().min(1).max(2000),
  callbackMethod: z.enum(['POST', 'GET', 'PUT', 'PATCH', 'DELETE']).optional().default('POST'),
  callbackHeaders: z.record(z.string(), z.string()).optional().nullable().default({}),
  callbackBody: z.string().max(100_000).optional().nullable().default(null),
  delayType: z.enum(['fixed', 'random']).optional().default('fixed'),
  delayValue: z.string().max(100).optional().default('5000'),
  retryEnabled: z.boolean().optional().default(false),
  maxRetries: z.number().int().min(0).max(10).optional().default(3),
  retryInterval: z.number().int().min(100).max(600_000).optional().default(5000),
  retryStrategy: z.enum(['fixed', 'exponential']).optional().default('fixed'),
  retryCondition: z.string().max(200).optional().nullable().default('server_error'),
});

const configListPutSchema = z.object({
  items: z.array(configItemSchema).max(50),
});

/** 把 DB 行转成前端友好的"配置对象"（含必要默认值） */
function configRowToApi(row: CallbackConfig): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name ?? null,
    sortOrder: row.sortOrder,
    isEnabled: row.isEnabled,
    callbackUrl: row.callbackUrl ?? '',
    callbackMethod: row.callbackMethod,
    callbackHeaders: (row.callbackHeaders ?? {}) as Record<string, string>,
    callbackBody: row.callbackBody ?? '',
    delayType: row.delayType,
    delayValue: row.delayValue,
    retryEnabled: row.retryEnabled,
    maxRetries: row.maxRetries,
    retryInterval: row.retryInterval,
    retryStrategy: row.retryStrategy,
    retryCondition: row.retryCondition ?? 'server_error',
  };
}

function listCallbacksForApi(apiId: number): CallbackConfig[] {
  const db = getDb();
  return db
    .select()
    .from(callbackConfigs)
    .where(eq(callbackConfigs.apiId, apiId))
    .orderBy(asc(callbackConfigs.sortOrder), asc(callbackConfigs.id))
    .all();
}

router.get(
  '/mock-apis/:apiId/callbacks',
  asyncHandler(async (req: Request, res: Response) => {
    const { apiId } = apiIdParamSchema.parse(req.params);
    const db = getDb();
    const api = db.select({ id: mockApis.id }).from(mockApis).where(eq(mockApis.id, apiId)).get();
    if (!api) throw new ApiError('NOT_FOUND', `接口 ${apiId} 不存在`, 404);
    const rows = listCallbacksForApi(apiId);
    res.success(rows.map(configRowToApi));
  }),
);

/** 整组保存：diff 已有 id / 新增 / 删除，失败则整组回滚 */
router.put(
  '/mock-apis/:apiId/callbacks',
  asyncHandler(async (req: Request, res: Response) => {
    const { apiId } = apiIdParamSchema.parse(req.params);
    const { items } = configListPutSchema.parse(req.body ?? {});
    const db = getDb();
    const api = db.select({ id: mockApis.id }).from(mockApis).where(eq(mockApis.id, apiId)).get();
    if (!api) throw new ApiError('NOT_FOUND', `接口 ${apiId} 不存在`, 404);

    const existing = listCallbacksForApi(apiId);
    const existingById = new Map(existing.map((r) => [r.id, r]));
    const keepIds = new Set<number>();

    db.transaction((tx) => {
      items.forEach((item, idx) => {
        const sortOrder = idx;
        const baseValues = {
          apiId,
          name: item.name ?? null,
          sortOrder,
          isEnabled: item.isEnabled ?? false,
          callbackUrl: item.callbackUrl,
          callbackMethod: item.callbackMethod ?? 'POST',
          callbackHeaders: item.callbackHeaders ?? {},
          callbackBody: item.callbackBody ?? null,
          delayType: item.delayType ?? 'fixed',
          delayValue: item.delayValue ?? '0',
          retryEnabled: item.retryEnabled ?? false,
          maxRetries: item.maxRetries ?? 3,
          retryInterval: item.retryInterval ?? 5000,
          retryStrategy: item.retryStrategy ?? 'fixed',
          retryCondition: item.retryCondition ?? 'server_error',
        };
        if (item.id && existingById.has(item.id)) {
          keepIds.add(item.id);
          tx.update(callbackConfigs).set(baseValues).where(eq(callbackConfigs.id, item.id)).run();
        } else {
          tx.insert(callbackConfigs).values(baseValues).run();
        }
      });
    });

    // 事务外删除：被移除的回调 → 先取消其 pending task，再删除行
    const removedIds = existing.filter((r) => !keepIds.has(r.id)).map((r) => r.id);
    if (removedIds.length > 0) {
      const pending = db
        .select({ id: callbackTasks.id })
        .from(callbackTasks)
        .where(
          and(
            eq(callbackTasks.apiId, apiId),
            eq(callbackTasks.status, 'pending'),
            inArray(callbackTasks.callbackConfigId, removedIds),
          ),
        )
        .all();
      for (const t of pending) callbackScheduler.cancel(t.id);
      db.delete(callbackConfigs).where(inArray(callbackConfigs.id, removedIds)).run();
    }

    const rows = listCallbacksForApi(apiId);
    res.success(rows.map(configRowToApi));
  }),
);

/** 单条删除 */
router.delete(
  '/mock-apis/:apiId/callbacks/:callbackId',
  asyncHandler(async (req: Request, res: Response) => {
    const { apiId, callbackId } = callbackIdParamSchema.parse(req.params);
    const db = getDb();
    const existing = db
      .select()
      .from(callbackConfigs)
      .where(and(eq(callbackConfigs.id, callbackId), eq(callbackConfigs.apiId, apiId)))
      .get();
    if (!existing) {
      res.success({ apiId, callbackId, deleted: false });
      return;
    }
    const pending = db
      .select({ id: callbackTasks.id })
      .from(callbackTasks)
      .where(
        and(
          eq(callbackTasks.apiId, apiId),
          eq(callbackTasks.callbackConfigId, callbackId),
          eq(callbackTasks.status, 'pending'),
        ),
      )
      .all();
    for (const t of pending) callbackScheduler.cancel(t.id);
    db.delete(callbackConfigs).where(eq(callbackConfigs.id, callbackId)).run();
    res.success({ apiId, callbackId, deleted: true });
  }),
);

// ----------------------- 任务 -----------------------

const taskQuerySchema = z.object({
  apiId: z.coerce.number().int().positive().optional(),
  status: z.enum(['pending', 'sent', 'failed']).optional(),
  keyword: z.string().trim().min(1).max(200).optional(),
  /** 相对时间范围：1h | 24h | 7d | all（默认 all） */
  range: z.enum(['all', '1h', '24h', '7d', 'custom']).optional().default('all'),
  /** 自定义起始时间（ISO 或 epoch ms） */
  start: z.string().optional(),
  /** 自定义结束时间（ISO 或 epoch ms） */
  end: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const taskIdSchema = z.object({ taskId: z.coerce.number().int().positive() });

function parseTimeBound(v: string | undefined): Date | null {
  if (!v) return null;
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return new Date(n);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildTimeRangeFilter(q: { range?: string; start?: string; end?: string }) {
  if (q.range === 'custom') {
    const start = parseTimeBound(q.start);
    const end = parseTimeBound(q.end);
    if (start && end)
      return and(gte(callbackTasks.createdAt, start), lte(callbackTasks.createdAt, end));
    if (start) return gte(callbackTasks.createdAt, start);
    if (end) return lte(callbackTasks.createdAt, end);
    return undefined;
  }
  if (q.range === 'all' || !q.range) return undefined;
  const now = Date.now();
  const span =
    q.range === '1h'
      ? 3_600_000
      : q.range === '24h'
        ? 86_400_000
        : q.range === '7d'
          ? 7 * 86_400_000
          : 0;
  if (!span) return undefined;
  return gte(callbackTasks.createdAt, new Date(now - span));
}

router.get(
  '/callback-tasks',
  asyncHandler(async (req: Request, res: Response) => {
    const q = taskQuerySchema.parse(req.query);
    const db = getDb();
    const where = and(
      q.apiId ? eq(callbackTasks.apiId, q.apiId) : undefined,
      q.status ? eq(callbackTasks.status, q.status) : undefined,
      q.keyword
        ? or(
            like(callbackTasks.callbackUrl, `%${q.keyword}%`),
            like(callbackTasks.callbackBody, `%${q.keyword}%`),
            like(mockApis.name, `%${q.keyword}%`),
            like(mockApis.path, `%${q.keyword}%`),
          )
        : undefined,
      buildTimeRangeFilter(q),
    );

    const totalRow = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(callbackTasks)
      .leftJoin(mockApis, eq(callbackTasks.apiId, mockApis.id))
      .where(where)
      .get();
    const total = totalRow?.count ?? 0;

    const rows = db
      .select({
        id: callbackTasks.id,
        apiId: callbackTasks.apiId,
        projectId: featureGroups.projectId,
        apiName: mockApis.name,
        apiMethod: mockApis.method,
        apiPath: mockApis.path,
        callbackUrl: callbackTasks.callbackUrl,
        callbackMethod: callbackTasks.callbackMethod,
        callbackHeaders: callbackTasks.callbackHeaders,
        callbackBody: callbackTasks.callbackBody,
        status: callbackTasks.status,
        retryCount: callbackTasks.retryCount,
        maxRetries: callbackTasks.maxRetries,
        responseStatus: callbackTasks.responseStatus,
        responseBody: callbackTasks.responseBody,
        errorMessage: callbackTasks.errorMessage,
        attemptLogs: callbackTasks.attemptLogs,
        scheduledAt: callbackTasks.scheduledAt,
        sentAt: callbackTasks.sentAt,
        createdAt: callbackTasks.createdAt,
        requestId: callbackTasks.requestId,
      })
      .from(callbackTasks)
      .leftJoin(mockApis, eq(callbackTasks.apiId, mockApis.id))
      .leftJoin(featureGroups, eq(mockApis.featureGroupId, featureGroups.id))
      .where(where)
      .orderBy(desc(callbackTasks.id))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize)
      .all();

    res.success({ items: rows, total, page: q.page, pageSize: q.pageSize });
  }),
);

router.get(
  '/callback-tasks/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const db = getDb();
    const rows = db
      .select({
        status: callbackTasks.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(callbackTasks)
      .groupBy(callbackTasks.status)
      .all();
    const stats: Record<string, number> = { pending: 0, sent: 0, failed: 0 };
    for (const r of rows) stats[r.status] = r.count;
    res.success({
      pending: stats.pending,
      sent: stats.sent,
      failed: stats.failed,
      total: stats.pending + stats.sent + stats.failed,
    });
  }),
);

router.get(
  '/callback-tasks/:taskId',
  asyncHandler(async (req: Request, res: Response) => {
    const { taskId } = taskIdSchema.parse(req.params);
    const db = getDb();
    const row = db
      .select({
        id: callbackTasks.id,
        apiId: callbackTasks.apiId,
        apiName: mockApis.name,
        apiMethod: mockApis.method,
        apiPath: mockApis.path,
        callbackUrl: callbackTasks.callbackUrl,
        callbackMethod: callbackTasks.callbackMethod,
        callbackHeaders: callbackTasks.callbackHeaders,
        callbackBody: callbackTasks.callbackBody,
        status: callbackTasks.status,
        retryCount: callbackTasks.retryCount,
        maxRetries: callbackTasks.maxRetries,
        responseStatus: callbackTasks.responseStatus,
        responseBody: callbackTasks.responseBody,
        errorMessage: callbackTasks.errorMessage,
        attemptLogs: callbackTasks.attemptLogs,
        scheduledAt: callbackTasks.scheduledAt,
        sentAt: callbackTasks.sentAt,
        createdAt: callbackTasks.createdAt,
        requestId: callbackTasks.requestId,
      })
      .from(callbackTasks)
      .leftJoin(mockApis, eq(callbackTasks.apiId, mockApis.id))
      .where(eq(callbackTasks.id, taskId))
      .get();
    if (!row) throw new ApiError('NOT_FOUND', `回调任务 ${taskId} 不存在`, 404);
    res.success(row);
  }),
);

router.post(
  '/callback-tasks/:taskId/retry',
  asyncHandler(async (req: Request, res: Response) => {
    const { taskId } = taskIdSchema.parse(req.params);
    await reExecute(taskId);
    res.success({ taskId, retrying: true });
  }),
);

router.post(
  '/callback-tasks/:taskId/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const { taskId } = taskIdSchema.parse(req.params);
    const db = getDb();
    const task = db.select().from(callbackTasks).where(eq(callbackTasks.id, taskId)).get();
    if (!task) throw new ApiError('NOT_FOUND', `回调任务 ${taskId} 不存在`, 404);
    if (task.status !== 'pending') {
      throw new ApiError(
        'BAD_REQUEST',
        `只有 pending 状态的任务可以取消（当前 ${task.status}）`,
        400,
      );
    }
    const ok = cancelTask(taskId);
    callbackScheduler.cancel(taskId);
    res.success({ taskId, cancelled: ok });
  }),
);

const batchDeleteSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
});

router.post(
  '/callback-tasks/batch-delete',
  asyncHandler(async (req: Request, res: Response) => {
    const { ids } = batchDeleteSchema.parse(req.body ?? {});
    const db = getDb();
    // 对其中 pending 任务先清调度器内存定时器，避免删除后仍被触发
    const pending = db
      .select({ id: callbackTasks.id })
      .from(callbackTasks)
      .where(and(inArray(callbackTasks.id, ids), eq(callbackTasks.status, 'pending')))
      .all();
    for (const t of pending) callbackScheduler.cancel(t.id);
    const r = db.delete(callbackTasks).where(inArray(callbackTasks.id, ids)).run();
    res.success({ deleted: r.changes ?? 0 });
  }),
);

/** 清除全部：按当前筛选条件删除所有匹配的任务。
 *  二次确认：必须传 `confirm: true`，避免误触。
 */
const clearAllSchema = z.object({
  confirm: z.literal(true),
  apiId: z.coerce.number().int().positive().optional(),
  status: z.enum(['pending', 'sent', 'failed']).optional(),
  keyword: z.string().trim().min(1).max(200).optional(),
  range: z.enum(['all', '1h', '24h', '7d', 'custom']).optional().default('all'),
  start: z.string().optional(),
  end: z.string().optional(),
});

router.post(
  '/callback-tasks/clear-all',
  asyncHandler(async (req: Request, res: Response) => {
    const body = clearAllSchema.parse(req.body ?? {});
    const db = getDb();

    const baseWhere = and(
      body.apiId ? eq(callbackTasks.apiId, body.apiId) : undefined,
      body.status ? eq(callbackTasks.status, body.status) : undefined,
      buildTimeRangeFilter(body),
    );
    const keywordWhere = body.keyword
      ? or(
          like(callbackTasks.callbackUrl, `%${body.keyword}%`),
          like(callbackTasks.callbackBody, `%${body.keyword}%`),
          like(mockApis.name, `%${body.keyword}%`),
          like(mockApis.path, `%${body.keyword}%`),
        )
      : undefined;
    const fullWhere = keywordWhere ? and(baseWhere, keywordWhere) : baseWhere;

    // 统计将被删除的 pending 任务，先清调度器定时器，避免删除后仍被触发
    const pendingSub = db
      .select({ id: callbackTasks.id })
      .from(callbackTasks)
      .leftJoin(mockApis, eq(callbackTasks.apiId, mockApis.id))
      .where(
        keywordWhere
          ? and(baseWhere, eq(callbackTasks.status, 'pending'), keywordWhere)
          : and(baseWhere, eq(callbackTasks.status, 'pending')),
      );
    const pending = db
      .select({ id: callbackTasks.id })
      .from(callbackTasks)
      .where(inArray(callbackTasks.id, pendingSub))
      .all();
    for (const t of pending) callbackScheduler.cancel(t.id);

    // 若有关键字搜索条件（需要 join mockApis），用 subquery 包一层
    const r = keywordWhere
      ? db
          .delete(callbackTasks)
          .where(
            inArray(
              callbackTasks.id,
              db
                .select({ id: callbackTasks.id })
                .from(callbackTasks)
                .leftJoin(mockApis, eq(callbackTasks.apiId, mockApis.id))
                .where(fullWhere),
            ),
          )
          .run()
      : db.delete(callbackTasks).where(fullWhere).run();
    res.success({ deleted: r.changes ?? 0 });
  }),
);

export { router as callbacksRouter };
