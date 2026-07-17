import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { mockData, mockApis } from '../db/schema.js';
import { ApiError, asyncHandler } from '../middleware/error-handler.js';

const router = Router();

const apiIdParamSchema = z.object({
  apiId: z.coerce.number().int().positive(),
});
const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createSchema = z.object({
  dataKey: z.string().max(100).optional().nullable(),
  dataValue: z.unknown(),
});

const updateSchema = createSchema.partial();

// 列出指定接口的手动 Mock 数据
router.get(
  '/mock-apis/:apiId/data',
  asyncHandler(async (req: Request, res: Response) => {
    const { apiId } = apiIdParamSchema.parse(req.params);
    const db = getDb();
    const rows = db
      .select()
      .from(mockData)
      .where(eq(mockData.apiId, apiId))
      .orderBy(asc(mockData.id))
      .all();
    res.success(rows);
  }),
);

// 新增 Mock 数据
router.post(
  '/mock-apis/:apiId/data',
  asyncHandler(async (req: Request, res: Response) => {
    const { apiId } = apiIdParamSchema.parse(req.params);
    const body = createSchema.parse(req.body);
    const db = getDb();
    const api = db.select().from(mockApis).where(eq(mockApis.id, apiId)).get();
    if (!api) throw new ApiError('NOT_FOUND', `接口 ${apiId} 不存在`, 404);

    const [row] = db
      .insert(mockData)
      .values({
        apiId,
        dataKey: body.dataKey ?? null,
        dataValue: body.dataValue as never,
      })
      .returning()
      .all();
    res.success(row, { status: 201 });
  }),
);

// 更新
router.put(
  '/mock-data/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const body = updateSchema.parse(req.body);
    const db = getDb();
    const existing = db.select().from(mockData).where(eq(mockData.id, id)).get();
    if (!existing) throw new ApiError('NOT_FOUND', `数据 ${id} 不存在`, 404);
    db.update(mockData)
      .set({
        ...(body.dataKey !== undefined ? { dataKey: body.dataKey } : {}),
        ...(body.dataValue !== undefined ? { dataValue: body.dataValue as never } : {}),
      })
      .where(eq(mockData.id, id))
      .run();
    res.success({ ...existing, ...body });
  }),
);

// 删除
router.delete(
  '/mock-data/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const db = getDb();
    const existing = db.select().from(mockData).where(eq(mockData.id, id)).get();
    if (!existing) throw new ApiError('NOT_FOUND', `数据 ${id} 不存在`, 404);
    db.delete(mockData).where(eq(mockData.id, id)).run();
    res.success({ id, deleted: true });
  }),
);

export { router as mockDataRouter };
