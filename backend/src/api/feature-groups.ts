import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, and, asc, sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { featureGroups, mockApis, projects } from '../db/schema.js';
import { ApiError, asyncHandler } from '../middleware/error-handler.js';
import { registry } from '../mock-engine/index.js';

const router = Router();

// ---------- Schemas ----------
const projectIdParamSchema = z.object({
  projectId: z.coerce.number().int().positive(),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
});

const updateSchema = createSchema.partial();

const reorderSchema = z.object({
  orderedIds: z.array(z.number().int().positive()).min(1),
});

// ---------- Routes ----------

// 列出指定项目下的功能组（含接口数）
router.get(
  '/projects/:projectId/feature-groups',
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const db = getDb();
    const rows = db
      .select({
        id: featureGroups.id,
        projectId: featureGroups.projectId,
        name: featureGroups.name,
        description: featureGroups.description,
        sortOrder: featureGroups.sortOrder,
        createdAt: featureGroups.createdAt,
        updatedAt: featureGroups.updatedAt,
        apiCount: sql<number>`(SELECT COUNT(*) FROM ${mockApis} WHERE ${mockApis.featureGroupId} = ${sql.raw('feature_groups.id')})`,
      })
      .from(featureGroups)
      .where(eq(featureGroups.projectId, projectId))
      .orderBy(asc(featureGroups.sortOrder), asc(featureGroups.id))
      .all();
    res.success(rows);
  }),
);

// 新建功能组
router.post(
  '/projects/:projectId/feature-groups',
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = createSchema.parse(req.body);
    const db = getDb();

    const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
    if (!project) throw new ApiError('NOT_FOUND', `项目 ${projectId} 不存在`, 404);

    const dup = db
      .select()
      .from(featureGroups)
      .where(and(eq(featureGroups.projectId, projectId), eq(featureGroups.name, body.name)))
      .get();
    if (dup) throw new ApiError('CONFLICT', `功能组 "${body.name}" 已存在`, 409);

    const [row] = db
      .insert(featureGroups)
      .values({
        projectId,
        name: body.name,
        description: body.description ?? null,
        sortOrder: body.sortOrder ?? 0,
      })
      .returning()
      .all();
    res.success(row, { status: 201 });
  }),
);

// 更新功能组
router.put(
  '/feature-groups/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const body = updateSchema.parse(req.body);
    const db = getDb();
    const existing = db.select().from(featureGroups).where(eq(featureGroups.id, id)).get();
    if (!existing) throw new ApiError('NOT_FOUND', `功能组 ${id} 不存在`, 404);

    if (body.name && body.name !== existing.name) {
      const dup = db
        .select()
        .from(featureGroups)
        .where(
          and(eq(featureGroups.projectId, existing.projectId), eq(featureGroups.name, body.name)),
        )
        .all()
        .find((g) => g.id !== id);
      if (dup) throw new ApiError('CONFLICT', `功能组名 "${body.name}" 已被使用`, 409);
    }

    db.update(featureGroups)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      })
      .where(eq(featureGroups.id, id))
      .run();
    res.success({ ...existing, ...body });
  }),
);

// 删除功能组（级联删除 mock_apis 和 mock_data）
router.delete(
  '/feature-groups/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const db = getDb();
    const existing = db.select().from(featureGroups).where(eq(featureGroups.id, id)).get();
    if (!existing) throw new ApiError('NOT_FOUND', `功能组 ${id} 不存在`, 404);

    // 先收集组下所有 api id，以便从 registry 移除
    const apiIds = db
      .select({ id: mockApis.id })
      .from(mockApis)
      .where(eq(mockApis.featureGroupId, id))
      .all()
      .map((r) => r.id);

    db.delete(featureGroups).where(eq(featureGroups.id, id)).run();

    // 热更新路由表
    for (const apiId of apiIds) registry.remove(apiId);

    res.success({ id, deleted: true, removedApis: apiIds.length });
  }),
);

// 批量重排
router.patch(
  '/projects/:projectId/feature-groups/reorder',
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { orderedIds } = reorderSchema.parse(req.body);
    const db = getDb();

    const existing = db
      .select({ id: featureGroups.id })
      .from(featureGroups)
      .where(eq(featureGroups.projectId, projectId))
      .all()
      .map((g) => g.id);

    const extra = orderedIds.filter((id) => !existing.includes(id));
    const missing = existing.filter((id) => !orderedIds.includes(id));
    if (extra.length > 0 || missing.length > 0) {
      throw new ApiError(
        'BAD_REQUEST',
        `reorder ids 必须覆盖该项目的全部功能组 (extra: ${extra}, missing: ${missing})`,
        400,
      );
    }

    db.transaction((tx) => {
      orderedIds.forEach((id, idx) => {
        tx.update(featureGroups).set({ sortOrder: idx }).where(eq(featureGroups.id, id)).run();
      });
    });
    res.success({ updated: orderedIds.length });
  }),
);

export { router as featureGroupsRouter };
