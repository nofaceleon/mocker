import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  projects,
  featureGroups,
  mockApis,
  requestLogs,
  callbackConfigs,
  HTTP_METHODS,
} from '../db/schema.js';
import { ApiError, asyncHandler } from '../middleware/error-handler.js';
import {
  exportProject,
  importProject,
  EXPORT_VERSION,
  type ProjectExportBundle,
} from '../services/project-export.js';
import { registry } from '../mock-engine/registry.js';
import { config } from '../config/index.js';

const router = Router();

// ---------- Schemas ----------
const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional().nullable(),
});

const updateSchema = createSchema.partial();

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// ---------- Helpers ----------
function notFoundOr<T>(value: T | undefined, id: number | string): T {
  if (!value) throw new ApiError('NOT_FOUND', `Resource ${id} not found`, 404);
  return value;
}

// ---------- Routes ----------

// 列表（含功能组数、接口数统计）
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const db = getDb();
    // 使用 sql.raw 引用外部表列名，避免 Drizzle 模板在关联子查询中丢失表限定符
    const rows = db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        featureGroupCount: sql<number>`(SELECT COUNT(*) FROM ${featureGroups} WHERE ${featureGroups.projectId} = ${sql.raw('projects.id')})`,
        apiCount: sql<number>`(SELECT COUNT(*) FROM ${mockApis} WHERE ${mockApis.featureGroupId} IN (SELECT id FROM ${featureGroups} WHERE ${featureGroups.projectId} = ${sql.raw('projects.id')}))`,
        callCount: sql<number>`(SELECT COUNT(*) FROM ${requestLogs} WHERE ${requestLogs.apiId} IN (SELECT id FROM ${mockApis} WHERE ${mockApis.featureGroupId} IN (SELECT id FROM ${featureGroups} WHERE ${featureGroups.projectId} = ${sql.raw('projects.id')})))`,
      })
      .from(projects)
      .orderBy(desc(projects.updatedAt))
      .all();
    res.success(rows);
  }),
);

// 详情（含功能组列表）
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const db = getDb();
    const project = notFoundOr(db.select().from(projects).where(eq(projects.id, id)).get(), id);
    const groups = db
      .select()
      .from(featureGroups)
      .where(eq(featureGroups.projectId, id))
      .orderBy(featureGroups.sortOrder, featureGroups.id)
      .all();
    res.success({ ...project, featureGroups: groups });
  }),
);

/**
 * AI 对话编辑：项目全景树（轻量列表，不含大字段）。
 * 改接口前先调此接口定位 featureGroupId / apiId。
 */
router.get(
  '/:id/agent-tree',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const db = getDb();
    const project = notFoundOr(db.select().from(projects).where(eq(projects.id, id)).get(), id);

    const groups = db
      .select()
      .from(featureGroups)
      .where(eq(featureGroups.projectId, id))
      .orderBy(asc(featureGroups.sortOrder), asc(featureGroups.id))
      .all();

    const groupIds = groups.map((g) => g.id);
    const apis =
      groupIds.length === 0
        ? []
        : db
            .select({
              id: mockApis.id,
              featureGroupId: mockApis.featureGroupId,
              name: mockApis.name,
              description: mockApis.description,
              protocol: mockApis.protocol,
              method: mockApis.method,
              path: mockApis.path,
              isEnabled: mockApis.isEnabled,
              sortOrder: mockApis.sortOrder,
              dataOp: mockApis.dataOp,
              dataTable: mockApis.dataTable,
            })
            .from(mockApis)
            .where(inArray(mockApis.featureGroupId, groupIds))
            .orderBy(asc(mockApis.sortOrder), asc(mockApis.id))
            .all();

    const apiIds = apis.map((a) => a.id);
    const enabledCallbacks =
      apiIds.length === 0
        ? []
        : db
            .select({ apiId: callbackConfigs.apiId })
            .from(callbackConfigs)
            .where(and(inArray(callbackConfigs.apiId, apiIds), eq(callbackConfigs.isEnabled, true)))
            .all();
    const callbackSet = new Set(enabledCallbacks.map((c) => c.apiId));

    const host = req.get('host') || `localhost:${config.port}`;
    const protocol = req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    const apisByGroup = new Map<number, typeof apis>();
    for (const api of apis) {
      const list = apisByGroup.get(api.featureGroupId) ?? [];
      list.push(api);
      apisByGroup.set(api.featureGroupId, list);
    }

    res.success({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
      },
      baseUrl,
      featureGroups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        sortOrder: g.sortOrder,
        apis: (apisByGroup.get(g.id) ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          protocol: a.protocol,
          method: a.method,
          path: a.path,
          isEnabled: a.isEnabled,
          sortOrder: a.sortOrder,
          dataOp: a.dataOp,
          dataTable: a.dataTable,
          hasCallback: callbackSet.has(a.id),
          fullUrl: `${baseUrl}${a.path}`,
        })),
      })),
    });
  }),
);

/**
 * AI 对话编辑：按 method + path 在项目内定位接口。
 * GET /api/projects/:id/mock-apis?method=POST&path=/face
 */
const agentLookupQuerySchema = z.object({
  method: z.enum(HTTP_METHODS).optional(),
  path: z.string().min(1).max(500).optional(),
  name: z.string().min(1).max(100).optional(),
});

router.get(
  '/:id/mock-apis',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const q = agentLookupQuerySchema.parse(req.query);
    const db = getDb();
    const project = notFoundOr(
      db.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).get(),
      id,
    );

    const groups = db
      .select({ id: featureGroups.id })
      .from(featureGroups)
      .where(eq(featureGroups.projectId, project.id))
      .all();
    const groupIds = groups.map((g) => g.id);
    if (groupIds.length === 0) {
      res.success([]);
      return;
    }

    let rows = db
      .select({
        id: mockApis.id,
        featureGroupId: mockApis.featureGroupId,
        name: mockApis.name,
        description: mockApis.description,
        protocol: mockApis.protocol,
        method: mockApis.method,
        path: mockApis.path,
        isEnabled: mockApis.isEnabled,
        sortOrder: mockApis.sortOrder,
      })
      .from(mockApis)
      .where(inArray(mockApis.featureGroupId, groupIds))
      .orderBy(asc(mockApis.sortOrder), asc(mockApis.id))
      .all();

    if (q.method) rows = rows.filter((r) => r.method === q.method);
    if (q.path) rows = rows.filter((r) => r.path === q.path);
    if (q.name) {
      const keyword = q.name.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(keyword));
    }

    res.success(rows);
  }),
);

// 新建
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const body = createSchema.parse(req.body);
    const db = getDb();
    const exists = db.select().from(projects).where(eq(projects.name, body.name)).get();
    if (exists) throw new ApiError('CONFLICT', `项目名 "${body.name}" 已存在`, 409);
    const [row] = db
      .insert(projects)
      .values({ name: body.name, description: body.description ?? null })
      .returning()
      .all();
    res.success(row, { status: 201 });
  }),
);

// 更新
router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const body = updateSchema.parse(req.body);
    const db = getDb();

    if (body.name) {
      const exists = db
        .select()
        .from(projects)
        .where(eq(projects.name, body.name))
        .all()
        .find((p) => p.id !== id);
      if (exists) throw new ApiError('CONFLICT', `项目名 "${body.name}" 已被其他项目使用`, 409);
    }

    const existing = notFoundOr(db.select().from(projects).where(eq(projects.id, id)).get(), id);
    db.update(projects)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
      })
      .where(eq(projects.id, id))
      .run();
    res.success({ ...existing, ...body });
  }),
);

// 删除（级联：project → feature_groups → mock_apis → mock_data）
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const db = getDb();
    const existing = notFoundOr(db.select().from(projects).where(eq(projects.id, id)).get(), id);
    // 外键 ON DELETE CASCADE 已配置 feature_groups → projects
    // 但 mock_apis → feature_groups 需要 feature_groups 先被删（也 cascade）
    // 由于 SQLite 外键开启，删除 projects 时所有依赖行会自动级联
    db.delete(projects).where(eq(projects.id, id)).run();
    registry.reload();
    res.success({ id: existing.id, deleted: true });
  }),
);

// 导出项目配置 JSON
const exportQuerySchema = z.object({
  groups: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isInteger(n) && n > 0)
        : undefined,
    ),
  includeData: z
    .enum(['0', '1', 'true', 'false'])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
});

router.get(
  '/:id/export',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const q = exportQuerySchema.parse(req.query);
    const bundle = exportProject(id, {
      groupIds: q.groups,
      includeData: q.includeData ?? false,
    });
    res.success(bundle);
  }),
);

// 导入项目配置 JSON
const importSchema = z.object({
  mode: z.enum(['create', 'skip', 'overwrite']).optional().default('create'),
  name: z.string().min(1).max(100).optional(),
  bundle: z.object({
    version: z.union([z.literal(EXPORT_VERSION), z.literal(1)]),
    exportedAt: z.string().optional(),
    project: z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(2000).optional().nullable(),
    }),
    featureGroups: z.array(z.unknown()).default([]),
  }),
});

router.post(
  '/import',
  asyncHandler(async (req: Request, res: Response) => {
    // 兼容两种 body：{ bundle, mode } 或直接 bundle
    const raw = req.body as Record<string, unknown>;
    const payload =
      raw && typeof raw === 'object' && 'bundle' in raw
        ? raw
        : { bundle: raw, mode: raw?.mode, name: raw?.name };
    const body = importSchema.parse(payload);
    const result = importProject(body.bundle as ProjectExportBundle, {
      mode: body.mode,
      name: body.name,
    });
    res.success(result, { status: 201 });
  }),
);

export { router as projectsRouter };
