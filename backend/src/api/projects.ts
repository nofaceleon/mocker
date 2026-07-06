import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, desc, sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { projects, featureGroups, mockApis, mockData } from '../db/schema.js';
import { ApiError, asyncHandler } from '../middleware/error-handler.js';

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
    const rows = db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        featureGroupCount: sql<number>`(SELECT COUNT(*) FROM ${featureGroups} WHERE ${featureGroups.projectId} = ${projects.id})`,
        apiCount: sql<number>`(SELECT COUNT(*) FROM ${mockApis} WHERE ${mockApis.featureGroupId} IN (SELECT id FROM ${featureGroups} WHERE ${featureGroups.projectId} = ${projects.id}))`,
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
    const project = notFoundOr(
      db.select().from(projects).where(eq(projects.id, id)).get(),
      id,
    );
    const groups = db
      .select()
      .from(featureGroups)
      .where(eq(featureGroups.projectId, id))
      .orderBy(featureGroups.sortOrder, featureGroups.id)
      .all();
    res.success({ ...project, featureGroups: groups });
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

    const existing = notFoundOr(
      db.select().from(projects).where(eq(projects.id, id)).get(),
      id,
    );
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
    const existing = notFoundOr(
      db.select().from(projects).where(eq(projects.id, id)).get(),
      id,
    );
    // 外键 ON DELETE CASCADE 已配置 feature_groups → projects
    // 但 mock_apis → feature_groups 需要 feature_groups 先被删（也 cascade）
    // 由于 SQLite 外键开启，删除 projects 时所有依赖行会自动级联
    db.delete(projects).where(eq(projects.id, id)).run();
    res.success({ id: existing.id, deleted: true });
  }),
);

export { router as projectsRouter };