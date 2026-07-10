import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { and, desc, eq, like, or, sql } from 'drizzle-orm';
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

// ----------------------- 配置 -----------------------

const apiIdParamSchema = z.object({ apiId: z.coerce.number().int().positive() });

const configPutSchema = z.object({
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

/** 把 DB 行转成前端友好的"配置对象"（含必要默认值） */
function configRowToApi(row: CallbackConfig): Record<string, unknown> {
  return {
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

router.get(
  '/mock-apis/:apiId/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { apiId } = apiIdParamSchema.parse(req.params);
    const db = getDb();
    const api = db.select({ id: mockApis.id }).from(mockApis).where(eq(mockApis.id, apiId)).get();
    if (!api) throw new ApiError('NOT_FOUND', `接口 ${apiId} 不存在`, 404);
    const row = db.select().from(callbackConfigs).where(eq(callbackConfigs.apiId, apiId)).get();
    res.success(row ? configRowToApi(row) : null);
  }),
);

router.put(
  '/mock-apis/:apiId/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { apiId } = apiIdParamSchema.parse(req.params);
    const body = configPutSchema.parse(req.body ?? {});
    const db = getDb();
    const api = db.select({ id: mockApis.id }).from(mockApis).where(eq(mockApis.id, apiId)).get();
    if (!api) throw new ApiError('NOT_FOUND', `接口 ${apiId} 不存在`, 404);
    const existing = db.select().from(callbackConfigs).where(eq(callbackConfigs.apiId, apiId)).get();
    const values = {
      apiId,
      isEnabled: body.isEnabled,
      callbackUrl: body.callbackUrl,
      callbackMethod: body.callbackMethod,
      callbackHeaders: body.callbackHeaders ?? {},
      callbackBody: body.callbackBody ?? null,
      delayType: body.delayType,
      delayValue: body.delayValue,
      retryEnabled: body.retryEnabled,
      maxRetries: body.maxRetries,
      retryInterval: body.retryInterval,
      retryStrategy: body.retryStrategy,
      retryCondition: body.retryCondition ?? 'server_error',
    };
    let saved;
    if (existing) {
      db.update(callbackConfigs).set(values).where(eq(callbackConfigs.id, existing.id)).run();
      saved = db.select().from(callbackConfigs).where(eq(callbackConfigs.id, existing.id)).get()!;
    } else {
      const [row] = db.insert(callbackConfigs).values(values).returning().all();
      saved = row;
    }
    res.success(configRowToApi(saved));
  }),
);

router.delete(
  '/mock-apis/:apiId/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { apiId } = apiIdParamSchema.parse(req.params);
    const db = getDb();
    const existing = db.select().from(callbackConfigs).where(eq(callbackConfigs.apiId, apiId)).get();
    if (!existing) {
      res.success({ apiId, deleted: false });
      return;
    }
    // 取消该 api 关联的所有 pending 任务
    const pending = db
      .select({ id: callbackTasks.id })
      .from(callbackTasks)
      .where(and(eq(callbackTasks.apiId, apiId), eq(callbackTasks.status, 'pending')))
      .all();
    for (const t of pending) callbackScheduler.cancel(t.id);
    db.delete(callbackConfigs).where(eq(callbackConfigs.id, existing.id)).run();
    res.success({ apiId, deleted: true });
  }),
);

// ----------------------- 任务 -----------------------

const taskQuerySchema = z.object({
  apiId: z.coerce.number().int().positive().optional(),
  status: z.enum(['pending', 'sent', 'failed']).optional(),
  keyword: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const taskIdSchema = z.object({ taskId: z.coerce.number().int().positive() });

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
      throw new ApiError('BAD_REQUEST', `只有 pending 状态的任务可以取消（当前 ${task.status}）`, 400);
    }
    const ok = cancelTask(taskId);
    callbackScheduler.cancel(taskId);
    res.success({ taskId, cancelled: ok });
  }),
);

export { router as callbacksRouter };
