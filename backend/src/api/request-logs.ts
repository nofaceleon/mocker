import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { and, desc, eq, gte, inArray, like, lte, sql, isNull, or } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { featureGroups, mockApis, projects, requestLogs, type RequestLog } from '../db/schema.js';
import { ApiError, asyncHandler } from '../middleware/error-handler.js';

const router = Router();

const RANGE_MS: Record<string, number | null> = {
  all: null,
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  custom: null,
};

const listQuerySchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
  apiId: z.coerce.number().int().positive().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional(),
  statusClass: z.enum(['2xx', '3xx', '4xx', '5xx']).optional(),
  keyword: z.string().trim().min(1).max(200).optional(),
  range: z.enum(['all', '1h', '24h', '7d', 'custom']).optional().default('24h'),
  start: z.coerce.number().int().positive().optional(),
  end: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
});

const detailSchema = z.object({ id: z.coerce.number().int().positive() });

const idSchema = z.object({ id: z.coerce.number().int().positive() });

const filtersSchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
});

const statsSchema = z.object({
  range: z.enum(['all', '1h', '24h', '7d', 'custom']).optional().default('24h'),
  start: z.coerce.number().int().positive().optional(),
  end: z.coerce.number().int().positive().optional(),
});

const deleteSchema = z
  .object({
    ids: z.array(z.coerce.number().int().positive()).min(1).max(500).optional(),
    projectId: z.coerce.number().int().positive().optional(),
    all: z.coerce.boolean().optional().default(false),
  })
  .refine((v) => v.ids || v.projectId || v.all, {
    message: '至少需要 ids、projectId 或 all=true 之一',
  });

const exportSchema = z.object({
  format: z.enum(['csv']).optional().default('csv'),
  projectId: z.coerce.number().int().positive().optional(),
  apiId: z.coerce.number().int().positive().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional(),
  statusClass: z.enum(['2xx', '3xx', '4xx', '5xx']).optional(),
  keyword: z.string().trim().min(1).max(200).optional(),
  range: z.enum(['all', '1h', '24h', '7d', 'custom']).optional().default('24h'),
  start: z.coerce.number().int().positive().optional(),
  end: z.coerce.number().int().positive().optional(),
});

type JoinedRow = RequestLog & {
  apiName: string | null;
  apiMethod: string | null;
  apiPath: string | null;
  projectId: number | null;
  projectName: string | null;
  featureGroupId: number | null;
};

function buildRangeCondition(q: { range?: string; start?: number; end?: number }) {
  const now = Date.now();
  if (q.range === 'custom') {
    if (q.start && q.end)
      return and(
        gte(requestLogs.createdAt, new Date(q.start)),
        lte(requestLogs.createdAt, new Date(q.end)),
      );
    if (q.start) return gte(requestLogs.createdAt, new Date(q.start));
    if (q.end) return lte(requestLogs.createdAt, new Date(q.end));
    return undefined;
  }
  // 显式检查 range 是否在 RANGE_MS 中，避免 null 被 ?? 误判为 falsy
  const rangeKey = q.range && q.range in RANGE_MS ? q.range : '24h';
  const span = RANGE_MS[rangeKey];
  if (span === null) return undefined;
  return gte(requestLogs.createdAt, new Date(now - span));
}

function statusClassCondition(cls: '2xx' | '3xx' | '4xx' | '5xx' | undefined) {
  if (!cls) return undefined;
  if (cls === '2xx')
    return and(gte(requestLogs.responseStatus, 200), lte(requestLogs.responseStatus, 299));
  if (cls === '3xx')
    return and(gte(requestLogs.responseStatus, 300), lte(requestLogs.responseStatus, 399));
  if (cls === '4xx')
    return and(gte(requestLogs.responseStatus, 400), lte(requestLogs.responseStatus, 499));
  if (cls === '5xx')
    return and(gte(requestLogs.responseStatus, 500), lte(requestLogs.responseStatus, 599));
  return undefined;
}

function rowToApi(row: JoinedRow): Record<string, unknown> {
  const status = row.responseStatus ?? 0;
  let statusKind: 'success' | 'warning' | 'danger' | 'info' = 'info';
  if (status >= 200 && status < 300) statusKind = 'success';
  else if (status >= 400 && status < 500) statusKind = 'warning';
  else if (status >= 500) statusKind = 'danger';
  else if (status >= 300 && status < 400) statusKind = 'info';

  return {
    id: row.id,
    apiId: row.apiId,
    apiName: row.apiName,
    apiMethod: row.apiMethod,
    apiPath: row.apiPath,
    featureGroupId: row.featureGroupId,
    projectId: row.projectId,
    projectName: row.projectName,
    method: row.requestMethod ?? '',
    path: row.requestPath ?? '',
    status,
    statusKind,
    responseTime: row.responseTime ?? 0,
    responseSize: row.responseBody ? row.responseBody.length : 0,
    clientIp: row.clientIp,
    requestId: row.requestId,
    format: row.format,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    requestParams: row.requestParams,
    requestBody: row.requestBody,
    requestHeaders: row.requestHeaders,
    responseBody: row.responseBody,
  };
}

// ----------------------- 统计 -----------------------  // 必须先于 /:id 注册，否则会被当作 id 解析
router.get(
  '/request-logs/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const q = statsSchema.parse(req.query);
    const db = getDb();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 当前范围内的总览
    const rangeCond = buildRangeCondition(q);

    const totalRow = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(requestLogs)
      .where(rangeCond)
      .get();
    const total = totalRow?.count ?? 0;

    const todayRow = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(requestLogs)
      .where(gte(requestLogs.createdAt, new Date(startOfToday)))
      .get();
    const today = todayRow?.count ?? 0;

    // 平均响应时间
    const avgRow = db
      .select({ avg: sql<number | null>`AVG(${requestLogs.responseTime})` })
      .from(requestLogs)
      .where(rangeCond)
      .get();
    const avgMs = Math.round(Number(avgRow?.avg ?? 0));

    // 成功率：2xx / total
    const successRow = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(requestLogs)
      .where(
        and(rangeCond, gte(requestLogs.responseStatus, 200), lte(requestLogs.responseStatus, 299)),
      )
      .get();
    const success = successRow?.count ?? 0;
    const successRate = total > 0 ? Math.round((success / total) * 1000) / 10 : 100;

    // 状态码分布
    const statusDistribution: Record<'2xx' | '3xx' | '4xx' | '5xx' | 'other', number> = {
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0,
      other: 0,
    };
    for (const cls of ['2xx', '3xx', '4xx', '5xx'] as const) {
      const r = db
        .select({ count: sql<number>`COUNT(*)` })
        .from(requestLogs)
        .where(and(rangeCond, statusClassCondition(cls)))
        .get();
      statusDistribution[cls] = r?.count ?? 0;
    }

    // 7 天趋势（按协议分桶：HTTP / WebSocket / SSE）
    const trendRows = db
      .select({
        day: sql<string>`strftime('%Y-%m-%d', ${requestLogs.createdAt} / 1000, 'unixepoch', 'localtime')`,
        format: requestLogs.format,
        count: sql<number>`COUNT(*)`,
      })
      .from(requestLogs)
      .where(gte(requestLogs.createdAt, sevenDaysAgo))
      .groupBy(
        sql`strftime('%Y-%m-%d', ${requestLogs.createdAt} / 1000, 'unixepoch', 'localtime')`,
        requestLogs.format,
      )
      .all();

    const dayMap = new Map<string, { http: number; ws: number; sse: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dayMap.set(key, { http: 0, ws: 0, sse: 0 });
    }
    for (const r of trendRows) {
      const bucket = dayMap.get(r.day);
      if (!bucket) continue;
      if (r.format === 'sse') bucket.sse += r.count;
      else bucket.http += r.count; // 当前协议只有 http / sse，ws 暂归 http
    }
    const trendPoints = Array.from(dayMap.entries()).map(([date, v]) => ({
      date: date.slice(5), // MM-DD
      http: v.http,
      ws: v.ws,
      sse: v.sse,
    }));

    res.success({
      total,
      today,
      avgMs,
      successRate,
      statusDistribution,
      trendPoints,
    });
  }),
);

// ----------------------- 导出 -----------------------  // 必须先于 /:id 注册
router.get(
  '/request-logs/export',
  asyncHandler(async (req: Request, res: Response) => {
    const q = exportSchema.parse(req.query);
    const db = getDb();
    const rangeCond = buildRangeCondition(q);
    const statusCond = statusClassCondition(q.statusClass);
    const keywordCond = q.keyword
      ? or(
          like(requestLogs.requestPath, `%${q.keyword}%`),
          like(mockApis.name, `%${q.keyword}%`),
          like(mockApis.path, `%${q.keyword}%`),
          like(requestLogs.clientIp, `%${q.keyword}%`),
          like(requestLogs.requestId, `%${q.keyword}%`),
        )
      : undefined;

    const where = and(
      q.projectId ? eq(projects.id, q.projectId) : undefined,
      q.apiId ? eq(requestLogs.apiId, q.apiId) : undefined,
      q.method ? eq(requestLogs.requestMethod, q.method) : undefined,
      rangeCond,
      statusCond,
      keywordCond,
    );

    const rows = db
      .select({
        id: requestLogs.id,
        createdAt: requestLogs.createdAt,
        method: requestLogs.requestMethod,
        path: requestLogs.requestPath,
        apiName: mockApis.name,
        apiPath: mockApis.path,
        status: requestLogs.responseStatus,
        responseTime: requestLogs.responseTime,
        clientIp: requestLogs.clientIp,
        requestId: requestLogs.requestId,
      })
      .from(requestLogs)
      .leftJoin(mockApis, eq(requestLogs.apiId, mockApis.id))
      .leftJoin(featureGroups, eq(mockApis.featureGroupId, featureGroups.id))
      .leftJoin(projects, eq(featureGroups.projectId, projects.id))
      .where(where)
      .orderBy(desc(requestLogs.id))
      .limit(10_000)
      .all();

    const filename = `request-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const headers = [
      'id',
      'created_at',
      'method',
      'path',
      'api_name',
      'api_path',
      'status',
      'response_time_ms',
      'client_ip',
      'request_id',
    ];
    const csvEscape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    res.write(headers.join(',') + '\n');
    for (const r of rows) {
      res.write(
        [
          r.id,
          r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
          r.method,
          r.path,
          r.apiName,
          r.apiPath,
          r.status,
          r.responseTime,
          r.clientIp,
          r.requestId,
        ]
          .map(csvEscape)
          .join(',') + '\n',
      );
    }
    res.end();
  }),
);

// ----------------------- 列表 -----------------------
router.get(
  '/request-logs',
  asyncHandler(async (req: Request, res: Response) => {
    const q = listQuerySchema.parse(req.query);
    const db = getDb();

    const rangeCond = buildRangeCondition(q);
    const statusCond = statusClassCondition(q.statusClass);
    const keywordCond = q.keyword
      ? or(
          like(requestLogs.requestPath, `%${q.keyword}%`),
          like(mockApis.name, `%${q.keyword}%`),
          like(mockApis.path, `%${q.keyword}%`),
          like(requestLogs.clientIp, `%${q.keyword}%`),
          like(requestLogs.requestId, `%${q.keyword}%`),
        )
      : undefined;

    const where = and(
      q.projectId ? eq(projects.id, q.projectId) : undefined,
      q.apiId ? eq(requestLogs.apiId, q.apiId) : undefined,
      q.method ? eq(requestLogs.requestMethod, q.method) : undefined,
      rangeCond,
      statusCond,
      keywordCond,
    );

    const totalRow = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(requestLogs)
      .leftJoin(mockApis, eq(requestLogs.apiId, mockApis.id))
      .leftJoin(featureGroups, eq(mockApis.featureGroupId, featureGroups.id))
      .leftJoin(projects, eq(featureGroups.projectId, projects.id))
      .where(where)
      .get();
    const total = totalRow?.count ?? 0;

    const rows = db
      .select({
        id: requestLogs.id,
        apiId: requestLogs.apiId,
        requestMethod: requestLogs.requestMethod,
        requestPath: requestLogs.requestPath,
        requestParams: requestLogs.requestParams,
        requestBody: requestLogs.requestBody,
        requestHeaders: requestLogs.requestHeaders,
        responseStatus: requestLogs.responseStatus,
        responseBody: requestLogs.responseBody,
        responseTime: requestLogs.responseTime,
        clientIp: requestLogs.clientIp,
        requestId: requestLogs.requestId,
        format: requestLogs.format,
        createdAt: requestLogs.createdAt,
        apiName: mockApis.name,
        apiMethod: mockApis.method,
        apiPath: mockApis.path,
        featureGroupId: mockApis.featureGroupId,
        projectId: projects.id,
        projectName: projects.name,
      })
      .from(requestLogs)
      .leftJoin(mockApis, eq(requestLogs.apiId, mockApis.id))
      .leftJoin(featureGroups, eq(mockApis.featureGroupId, featureGroups.id))
      .leftJoin(projects, eq(featureGroups.projectId, projects.id))
      .where(where)
      .orderBy(desc(requestLogs.id))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize)
      .all() as JoinedRow[];

    res.success(
      { items: rows.map(rowToApi), total, page: q.page, pageSize: q.pageSize },
      { total },
    );
  }),
);

// ----------------------- 详情 -----------------------
router.get(
  '/request-logs/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = detailSchema.parse(req.params);
    const db = getDb();
    const row = db
      .select({
        id: requestLogs.id,
        apiId: requestLogs.apiId,
        requestMethod: requestLogs.requestMethod,
        requestPath: requestLogs.requestPath,
        requestParams: requestLogs.requestParams,
        requestBody: requestLogs.requestBody,
        requestHeaders: requestLogs.requestHeaders,
        responseStatus: requestLogs.responseStatus,
        responseBody: requestLogs.responseBody,
        responseTime: requestLogs.responseTime,
        clientIp: requestLogs.clientIp,
        requestId: requestLogs.requestId,
        format: requestLogs.format,
        createdAt: requestLogs.createdAt,
        apiName: mockApis.name,
        apiMethod: mockApis.method,
        apiPath: mockApis.path,
        featureGroupId: mockApis.featureGroupId,
        projectId: projects.id,
        projectName: projects.name,
      })
      .from(requestLogs)
      .leftJoin(mockApis, eq(requestLogs.apiId, mockApis.id))
      .leftJoin(featureGroups, eq(mockApis.featureGroupId, featureGroups.id))
      .leftJoin(projects, eq(featureGroups.projectId, projects.id))
      .where(eq(requestLogs.id, id))
      .get() as JoinedRow | undefined;

    if (!row) throw new ApiError('NOT_FOUND', `调用日志 ${id} 不存在`, 404);
    res.success(rowToApi(row));
  }),
);

// ----------------------- 过滤器选项 -----------------------
router.get(
  '/request-logs-filters',
  asyncHandler(async (req: Request, res: Response) => {
    const q = filtersSchema.parse(req.query);
    const db = getDb();

    const projectRows = db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .orderBy(projects.name)
      .all();

    const apiWhere = q.projectId
      ? and(
          eq(featureGroups.projectId, q.projectId),
          isNull(sql`${mockApis.featureGroupId} IS NULL`),
        )
      : undefined;
    const apiRows = db
      .select({
        id: mockApis.id,
        name: mockApis.name,
        method: mockApis.method,
        path: mockApis.path,
        projectId: featureGroups.projectId,
      })
      .from(mockApis)
      .leftJoin(featureGroups, eq(mockApis.featureGroupId, featureGroups.id))
      .where(q.projectId ? eq(featureGroups.projectId, q.projectId) : undefined)
      .orderBy(mockApis.sortOrder, mockApis.id)
      .all();

    res.success({ projects: projectRows, apis: apiRows });
  }),
);

// ----------------------- 统计 -----------------------
router.get(
  '/request-logs/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const q = statsSchema.parse(req.query);
    const db = getDb();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 当前范围内的总览
    const rangeCond = buildRangeCondition(q);

    const baseRange = db
      .select({
        id: requestLogs.id,
        responseStatus: requestLogs.responseStatus,
        responseTime: requestLogs.responseTime,
        format: requestLogs.format,
        createdAt: requestLogs.createdAt,
      })
      .from(requestLogs)
      .where(rangeCond);

    const totalRow = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(requestLogs)
      .where(rangeCond)
      .get();
    const total = totalRow?.count ?? 0;

    const todayRow = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(requestLogs)
      .where(gte(requestLogs.createdAt, new Date(startOfToday)))
      .get();
    const today = todayRow?.count ?? 0;

    // 平均响应时间
    const avgRow = db
      .select({ avg: sql<number | null>`AVG(${requestLogs.responseTime})` })
      .from(requestLogs)
      .where(rangeCond)
      .get();
    const avgMs = Math.round(Number(avgRow?.avg ?? 0));

    // 成功率：2xx / total
    const successRow = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(requestLogs)
      .where(
        and(rangeCond, gte(requestLogs.responseStatus, 200), lte(requestLogs.responseStatus, 299)),
      )
      .get();
    const success = successRow?.count ?? 0;
    const successRate = total > 0 ? Math.round((success / total) * 1000) / 10 : 100;

    // 状态码分布
    const distRows = db
      .select({
        status: requestLogs.responseStatus,
        count: sql<number>`COUNT(*)`,
      })
      .from(requestLogs)
      .where(rangeCond)
      .groupBy(
        sql`CASE
          WHEN ${requestLogs.responseStatus} BETWEEN 200 AND 299 THEN '2xx'
          WHEN ${requestLogs.responseStatus} BETWEEN 300 AND 399 THEN '3xx'
          WHEN ${requestLogs.responseStatus} BETWEEN 400 AND 499 THEN '4xx'
          WHEN ${requestLogs.responseStatus} BETWEEN 500 AND 599 THEN '5xx'
          ELSE 'other'
        END`,
      )
      .all();

    const statusDistribution: Record<'2xx' | '3xx' | '4xx' | '5xx' | 'other', number> = {
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0,
      other: 0,
    };
    // 用独立查询得到每一档的总数（groupBy 表达式在 drizzle 中较繁琐，简化为四次 count）
    for (const cls of ['2xx', '3xx', '4xx', '5xx'] as const) {
      const r = db
        .select({ count: sql<number>`COUNT(*)` })
        .from(requestLogs)
        .where(and(rangeCond, statusClassCondition(cls)))
        .get();
      statusDistribution[cls] = r?.count ?? 0;
    }

    // 7 天趋势（按协议分桶：HTTP / WebSocket / SSE）
    const trendRows = db
      .select({
        day: sql<string>`strftime('%Y-%m-%d', ${requestLogs.createdAt} / 1000, 'unixepoch', 'localtime')`,
        format: requestLogs.format,
        count: sql<number>`COUNT(*)`,
      })
      .from(requestLogs)
      .where(gte(requestLogs.createdAt, sevenDaysAgo))
      .groupBy(
        sql`strftime('%Y-%m-%d', ${requestLogs.createdAt} / 1000, 'unixepoch', 'localtime')`,
        requestLogs.format,
      )
      .all();

    const dayMap = new Map<string, { http: number; ws: number; sse: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dayMap.set(key, { http: 0, ws: 0, sse: 0 });
    }
    for (const r of trendRows) {
      const bucket = dayMap.get(r.day);
      if (!bucket) continue;
      if (r.format === 'sse') bucket.sse += r.count;
      else bucket.http += r.count; // 当前协议只有 http / sse，ws 暂归 http
    }
    const trendPoints = Array.from(dayMap.entries()).map(([date, v]) => ({
      date: date.slice(5), // MM-DD
      http: v.http,
      ws: v.ws,
      sse: v.sse,
    }));

    res.success({
      total,
      today,
      avgMs,
      successRate,
      statusDistribution,
      trendPoints,
    });

    // 防止 baseRange 警告未使用
    void baseRange;
    void distRows;
  }),
);

// ----------------------- 删除 -----------------------
router.delete(
  '/request-logs',
  asyncHandler(async (req: Request, res: Response) => {
    const body = deleteSchema.parse(req.body ?? {});
    const db = getDb();

    let deleted = 0;
    if (body.ids && body.ids.length > 0) {
      const r = db.delete(requestLogs).where(inArray(requestLogs.id, body.ids)).run();
      deleted = r.changes ?? 0;
    } else if (body.projectId) {
      const ids = db
        .select({ id: requestLogs.id })
        .from(requestLogs)
        .leftJoin(mockApis, eq(requestLogs.apiId, mockApis.id))
        .leftJoin(featureGroups, eq(mockApis.featureGroupId, featureGroups.id))
        .where(eq(featureGroups.projectId, body.projectId))
        .all();
      if (ids.length > 0) {
        const r = db
          .delete(requestLogs)
          .where(
            inArray(
              requestLogs.id,
              ids.map((x) => x.id),
            ),
          )
          .run();
        deleted = r.changes ?? 0;
      }
    } else if (body.all) {
      const r = db.delete(requestLogs).run();
      deleted = r.changes ?? 0;
    }

    res.success({ deleted });
  }),
);

// ----------------------- 导出 -----------------------
router.get(
  '/request-logs/export',
  asyncHandler(async (req: Request, res: Response) => {
    const q = exportSchema.parse(req.query);
    const db = getDb();
    const rangeCond = buildRangeCondition(q);
    const statusCond = statusClassCondition(q.statusClass);
    const keywordCond = q.keyword
      ? or(
          like(requestLogs.requestPath, `%${q.keyword}%`),
          like(mockApis.name, `%${q.keyword}%`),
          like(mockApis.path, `%${q.keyword}%`),
          like(requestLogs.clientIp, `%${q.keyword}%`),
          like(requestLogs.requestId, `%${q.keyword}%`),
        )
      : undefined;

    const where = and(
      q.projectId ? eq(projects.id, q.projectId) : undefined,
      q.apiId ? eq(requestLogs.apiId, q.apiId) : undefined,
      q.method ? eq(requestLogs.requestMethod, q.method) : undefined,
      rangeCond,
      statusCond,
      keywordCond,
    );

    const rows = db
      .select({
        id: requestLogs.id,
        createdAt: requestLogs.createdAt,
        method: requestLogs.requestMethod,
        path: requestLogs.requestPath,
        apiName: mockApis.name,
        apiPath: mockApis.path,
        status: requestLogs.responseStatus,
        responseTime: requestLogs.responseTime,
        clientIp: requestLogs.clientIp,
        requestId: requestLogs.requestId,
      })
      .from(requestLogs)
      .leftJoin(mockApis, eq(requestLogs.apiId, mockApis.id))
      .leftJoin(featureGroups, eq(mockApis.featureGroupId, featureGroups.id))
      .leftJoin(projects, eq(featureGroups.projectId, projects.id))
      .where(where)
      .orderBy(desc(requestLogs.id))
      .limit(10_000)
      .all();

    const filename = `request-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const headers = [
      'id',
      'created_at',
      'method',
      'path',
      'api_name',
      'api_path',
      'status',
      'response_time_ms',
      'client_ip',
      'request_id',
    ];
    const csvEscape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    res.write(headers.join(',') + '\n');
    for (const r of rows) {
      res.write(
        [
          r.id,
          r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
          r.method,
          r.path,
          r.apiName,
          r.apiPath,
          r.status,
          r.responseTime,
          r.clientIp,
          r.requestId,
        ]
          .map(csvEscape)
          .join(',') + '\n',
      );
    }
    res.end();
  }),
);

export { router as requestLogsRouter };
