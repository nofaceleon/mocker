import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, and, asc, sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  featureGroups,
  mockApis,
  type MockApi,
  type ValidationRules,
  type HttpMethod,
  HTTP_METHODS,
  DATA_OPS,
} from '../db/schema.js';
import { ApiError, asyncHandler } from '../middleware/error-handler.js';
import { handleMockRequest } from '../mock-engine/handler.js';
import { registry } from '../mock-engine/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const router = Router();

// ---------- Schemas ----------
const fgIdParamSchema = z.object({
  featureGroupId: z.coerce.number().int().positive(),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const validationParamSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
    required: z.boolean().optional(),
    default: z.unknown().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    enum: z.array(z.unknown()).optional(),
    refine: z.string().optional(),
  })
  .strict();

const validationRulesSchema = z
  .object({
    query: z.array(validationParamSchema).optional(),
    body: z.array(validationParamSchema).optional(),
    path: z.array(validationParamSchema).optional(),
    header: z.array(validationParamSchema).optional(),
    failStatus: z.number().int().min(100).max(599).optional(),
    failMessage: z.string().max(500).optional(),
  })
  .partial();

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional().nullable(),
  method: z.enum(HTTP_METHODS),
  path: z.string().min(1).max(500).startsWith('/'),
  isEnabled: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
  responseStatus: z.number().int().min(100).max(599).optional().default(200),
  responseDelay: z.number().int().min(0).max(60_000).optional().default(0),
  responseDelayMax: z.number().int().min(0).max(60_000).optional().default(0),
  responseContentType: z.string().max(200).optional().default('application/json'),
  responseHeaders: z.record(z.string(), z.string()).optional().nullable(),
  responseBody: z.unknown().optional().nullable(),
  validationRules: validationRulesSchema.optional().nullable(),
  dataOp: z.enum(DATA_OPS).optional().default('none'),
  dataTable: z.string().max(100).regex(/^[A-Za-z_][A-Za-z0-9_]*$/).optional().nullable(),
  dataWhere: z.record(z.string(), z.unknown()).optional().nullable(),
  script: z.string().optional().nullable(),
});

const updateSchema = createSchema.partial();

const toggleSchema = z.object({
  isEnabled: z.boolean(),
});

const testRequestSchema = z.object({
  path: z.string().optional(),
  query: z.record(z.string(), z.unknown()).optional(),
  body: z.unknown().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

// ---------- Routes ----------

// 列出功能组下所有接口（含 mock_data 计数）
router.get(
  '/feature-groups/:featureGroupId/mock-apis',
  asyncHandler(async (req: Request, res: Response) => {
    const { featureGroupId } = fgIdParamSchema.parse(req.params);
    const db = getDb();
    const rows = db
      .select({
        id: mockApis.id,
        featureGroupId: mockApis.featureGroupId,
        name: mockApis.name,
        description: mockApis.description,
        method: mockApis.method,
        path: mockApis.path,
        isEnabled: mockApis.isEnabled,
        sortOrder: mockApis.sortOrder,
        responseStatus: mockApis.responseStatus,
        responseDelay: mockApis.responseDelay,
        responseDelayMax: mockApis.responseDelayMax,
        responseContentType: mockApis.responseContentType,
        dataOp: mockApis.dataOp,
        dataTable: mockApis.dataTable,
        createdAt: mockApis.createdAt,
        updatedAt: mockApis.updatedAt,
        mockDataCount: sql<number>`(SELECT COUNT(*) FROM mock_data WHERE mock_data.api_id = ${mockApis.id})`,
      })
      .from(mockApis)
      .where(eq(mockApis.featureGroupId, featureGroupId))
      .orderBy(asc(mockApis.sortOrder), asc(mockApis.id))
      .all();

    // 添加完整的 mock 路由地址
    const host = req.get('host') || `localhost:${config.port}`;
    const protocol = req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;
    const result = rows.map((row) => ({
      ...row,
      fullPath: `/mock${row.path}`,
      fullUrl: `${baseUrl}/mock${row.path}`,
    }));

    res.success(result);
  }),
);

// 接口详情
router.get(
  '/mock-apis/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const db = getDb();
    const row = db.select().from(mockApis).where(eq(mockApis.id, id)).get();
    if (!row) throw new ApiError('NOT_FOUND', `接口 ${id} 不存在`, 404);
    res.success(row);
  }),
);

// 新建接口
router.post(
  '/feature-groups/:featureGroupId/mock-apis',
  asyncHandler(async (req: Request, res: Response) => {
    const { featureGroupId } = fgIdParamSchema.parse(req.params);
    const body = createSchema.parse(req.body);
    const db = getDb();

    const fg = db
      .select()
      .from(featureGroups)
      .where(eq(featureGroups.id, featureGroupId))
      .get();
    if (!fg) throw new ApiError('NOT_FOUND', `功能组 ${featureGroupId} 不存在`, 404);

    assertNoConflict(db, body.method as HttpMethod, body.path, null);

    const [row] = db
      .insert(mockApis)
      .values({
        featureGroupId,
        name: body.name,
        description: body.description ?? null,
        method: body.method,
        path: body.path,
        isEnabled: body.isEnabled ?? true,
        sortOrder: body.sortOrder ?? 0,
        responseStatus: body.responseStatus ?? 200,
        responseDelay: body.responseDelay ?? 0,
        responseDelayMax: body.responseDelayMax ?? 0,
        responseContentType: body.responseContentType ?? 'application/json',
        responseHeaders: body.responseHeaders ?? null,
        responseBody: body.responseBody ?? null,
        validationRules: (body.validationRules as ValidationRules | null) ?? null,
        dataOp: body.dataOp ?? 'none',
        dataTable: body.dataTable ?? null,
        dataWhere: body.dataWhere ?? null,
        script: body.script ?? null,
      })
      .returning()
      .all();

    registry.upsert(row);
    res.success(row, { status: 201 });
  }),
);

// 更新接口
router.put(
  '/mock-apis/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const body = updateSchema.parse(req.body);
    const db = getDb();
    const existing = db.select().from(mockApis).where(eq(mockApis.id, id)).get();
    if (!existing) throw new ApiError('NOT_FOUND', `接口 ${id} 不存在`, 404);

    if (body.method !== undefined || body.path !== undefined) {
      const newMethod = (body.method ?? existing.method) as HttpMethod;
      const newPath = body.path ?? existing.path;
      assertNoConflict(db, newMethod, newPath, id);
    }

    const patch = {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.method !== undefined ? { method: body.method } : {}),
      ...(body.path !== undefined ? { path: body.path } : {}),
      ...(body.isEnabled !== undefined ? { isEnabled: body.isEnabled } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      ...(body.responseStatus !== undefined ? { responseStatus: body.responseStatus } : {}),
      ...(body.responseDelay !== undefined ? { responseDelay: body.responseDelay } : {}),
      ...(body.responseDelayMax !== undefined ? { responseDelayMax: body.responseDelayMax } : {}),
      ...(body.responseContentType !== undefined
        ? { responseContentType: body.responseContentType }
        : {}),
      ...(body.responseHeaders !== undefined ? { responseHeaders: body.responseHeaders } : {}),
      ...(body.responseBody !== undefined ? { responseBody: body.responseBody } : {}),
      ...(body.validationRules !== undefined ? { validationRules: body.validationRules } : {}),
      ...(body.dataOp !== undefined ? { dataOp: body.dataOp } : {}),
      ...(body.dataTable !== undefined ? { dataTable: body.dataTable } : {}),
      ...(body.dataWhere !== undefined ? { dataWhere: body.dataWhere } : {}),
      ...(body.script !== undefined ? { script: body.script } : {}),
    };
    db.update(mockApis).set(patch).where(eq(mockApis.id, id)).run();

    const updated = db.select().from(mockApis).where(eq(mockApis.id, id)).get()!;
    registry.upsert(updated);
    res.success(updated);
  }),
);

// 删除接口
router.delete(
  '/mock-apis/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const db = getDb();
    const existing = db.select().from(mockApis).where(eq(mockApis.id, id)).get();
    if (!existing) throw new ApiError('NOT_FOUND', `接口 ${id} 不存在`, 404);
    db.delete(mockApis).where(eq(mockApis.id, id)).run();
    registry.remove(id);
    res.success({ id, deleted: true });
  }),
);

// 启用/禁用
router.patch(
  '/mock-apis/:id/toggle',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const { isEnabled } = toggleSchema.parse(req.body);
    const db = getDb();
    const existing = db.select().from(mockApis).where(eq(mockApis.id, id)).get();
    if (!existing) throw new ApiError('NOT_FOUND', `接口 ${id} 不存在`, 404);
    db.update(mockApis).set({ isEnabled }).where(eq(mockApis.id, id)).run();
    const updated = db.select().from(mockApis).where(eq(mockApis.id, id)).get()!;
    registry.upsert(updated);
    res.success({ id, isEnabled });
  }),
);

// 运行测试（内部直调 handler，绕过 HTTP）
router.post(
  '/mock-apis/:id/test',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const input = testRequestSchema.parse(req.body ?? {});
    const db = getDb();
    const api = db.select().from(mockApis).where(eq(mockApis.id, id)).get();
    if (!api) throw new ApiError('NOT_FOUND', `接口 ${id} 不存在`, 404);

    // 构造一个伪 Express req/res，调用 handler
    const headers: Record<string, string> = { 'content-type': 'application/json', ...(input.headers ?? {}) };
    const fakeReq = {
      method: api.method,
      path: input.path ?? api.path,
      originalUrl: (input.path ?? api.path) + (input.query ? `?${new URLSearchParams(input.query as Record<string, string>).toString()}` : ''),
      url: (input.path ?? api.path) + (input.query ? `?${new URLSearchParams(input.query as Record<string, string>).toString()}` : ''),
      query: input.query ?? {},
      body: input.body ?? {},
      headers,
      get(name: string) {
        return headers[name.toLowerCase()];
      },
    } as unknown as Request;

    const responseState = {
      status: 200,
      headers: {} as Record<string, string>,
      body: undefined as unknown,
    };
    const fakeRes = {
      status(code: number) {
        responseState.status = code;
        return this;
      },
      setHeader(k: string, v: string) {
        responseState.headers[k] = v;
        return this;
      },
      getHeader(k: string) {
        return responseState.headers[k];
      },
      json(data: unknown) {
        responseState.body = data;
        return this;
      },
      send(data: unknown) {
        responseState.body = data;
        return this;
      },
      headersSent: false,
    } as unknown as Response;

    await handleMockRequest(fakeReq, fakeRes, (() => {}) as never);
    res.success({
      apiId: api.id,
      method: api.method,
      path: input.path ?? api.path,
      responseStatus: responseState.status,
      responseHeaders: responseState.headers,
      responseBody: responseState.body,
    });
  }),
);

// ---------- Helpers ----------
function assertNoConflict(
  db: ReturnType<typeof getDb>,
  method: HttpMethod,
  path: string,
  excludeId: number | null,
): void {
  // 仅检查启用中的接口，避免对禁用接口冲突
  const candidates = db
    .select()
    .from(mockApis)
    .where(and(eq(mockApis.method, method), eq(mockApis.isEnabled, true)))
    .all();
  const conflict = candidates.find(
    (c) => c.path === path && c.id !== excludeId,
  );
  if (conflict) {
    throw new ApiError(
      'ROUTE_CONFLICT',
      `路由冲突：${method} ${path} 已被接口 #${conflict.id} "${conflict.name}" 占用`,
      409,
      { conflictApiId: conflict.id, conflictName: conflict.name },
    );
  }
}

export { router as mockApisRouter };