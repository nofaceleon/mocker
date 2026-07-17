import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  featureGroups,
  mockApis,
  type MockApi,
  type ValidationRules,
  type HttpMethod,
} from '../db/schema.js';
import { ApiError, asyncHandler } from '../middleware/error-handler.js';
import { registry } from '../mock-engine/index.js';
import {
  parseSpecText,
  normalizeSpec,
  SpecParseError,
  type NormalizedImportItem,
} from '../services/swagger-normalizer.js';

const router = Router();

// ---------- Schemas ----------
const fgIdParamSchema = z.object({
  featureGroupId: z.coerce.number().int().positive(),
});

const parseBodySchema = z.object({
  fileName: z.string().min(1).max(200),
  content: z.string().min(1).max(5_000_000), // 5MB 软上限
});

const commitBodySchema = z.object({
  decisions: z
    .array(
      z.object({
        index: z.number().int().nonnegative(),
        action: z.enum(['create', 'overwrite', 'skip']),
        // 允许前端在 commit 阶段覆盖 name/path（用户在预览阶段编辑过）
        name: z.string().min(1).max(100).optional(),
        path: z.string().min(1).max(500).startsWith('/').optional(),
      }),
    )
    .min(1)
    .max(2000),
});

// ---------- Routes ----------

/**
 * 解析 swagger/openapi 文本，返回预览列表 + 冲突检测
 * POST /api/feature-groups/:featureGroupId/swagger/parse
 */
router.post(
  '/feature-groups/:featureGroupId/swagger/parse',
  asyncHandler(async (req: Request, res: Response) => {
    const { featureGroupId } = fgIdParamSchema.parse(req.params);
    const { fileName, content } = parseBodySchema.parse(req.body);

    // 校验功能组存在
    const db = getDb();
    const fg = db.select().from(featureGroups).where(eq(featureGroups.id, featureGroupId)).get();
    if (!fg) {
      throw new ApiError('NOT_FOUND', `功能组 ${featureGroupId} 不存在`, 404);
    }

    // 解析文本
    let parsed: unknown;
    try {
      parsed = parseSpecText(content, fileName);
    } catch (err) {
      if (err instanceof SpecParseError) {
        throw new ApiError(err.code, err.message, 400);
      }
      throw err;
    }

    // 归一化
    let result;
    try {
      result = normalizeSpec(parsed);
    } catch (err) {
      if (err instanceof SpecParseError) {
        throw new ApiError(err.code, err.message, 400);
      }
      throw err;
    }

    if (result.items.length === 0) {
      throw new ApiError(
        'NO_HTTP_OPERATIONS',
        '未解析出任何 HTTP 接口（仅支持 GET/POST/PUT/DELETE/PATCH）',
        400,
      );
    }

    // 查询已有接口用于冲突检测（仅启用状态算冲突）
    const existing = db
      .select()
      .from(mockApis)
      .where(eq(mockApis.featureGroupId, featureGroupId))
      .all();

    const itemsWithConflict = result.items.map((item) => {
      const conflict = detectConflict(existing, item);
      return {
        ...item,
        conflict,
      };
    });

    const summary = {
      total: itemsWithConflict.length,
      supported: itemsWithConflict.filter((i) => i.isSupported).length,
      conflicts: itemsWithConflict.filter((i) => i.conflict !== null).length,
    };

    res.success({
      specInfo: result.specInfo,
      items: itemsWithConflict,
      summary,
    });
  }),
);

/**
 * 提交导入决策
 * POST /api/feature-groups/:featureGroupId/swagger/commit
 */
router.post(
  '/feature-groups/:featureGroupId/swagger/commit',
  asyncHandler(async (req: Request, res: Response) => {
    const { featureGroupId } = fgIdParamSchema.parse(req.params);
    const { decisions } = commitBodySchema.parse(req.body);

    const db = getDb();
    const fg = db.select().from(featureGroups).where(eq(featureGroups.id, featureGroupId)).get();
    if (!fg) {
      throw new ApiError('NOT_FOUND', `功能组 ${featureGroupId} 不存在`, 404);
    }

    const existing = db
      .select()
      .from(mockApis)
      .where(eq(mockApis.featureGroupId, featureGroupId))
      .all();

    // 加载所有决策对应的 items 数据（从请求体直接携带完整的 preview 数据）
    const itemsField = z
      .record(
        z.string(),
        z.object({
          index: z.number().int().nonnegative(),
          name: z.string(),
          description: z.string(),
          method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
          path: z.string(),
          isSupported: z.boolean(),
          validationRules: z.unknown(),
          responseStatus: z.number().int(),
          responseContentType: z.string(),
          responseBody: z.unknown(),
          isEnabled: z.boolean(),
        }),
      )
      .parse(req.body.items ?? {});

    let created = 0;
    let overwritten = 0;
    let skipped = 0;
    const errors: Array<{ index: number; reason: string }> = [];

    for (const decision of decisions) {
      const itemKey = String(decision.index);
      const item = itemsField[itemKey];
      if (!item) {
        errors.push({ index: decision.index, reason: '找不到对应的预览数据，请重新解析' });
        continue;
      }
      if (!item.isSupported) {
        errors.push({ index: decision.index, reason: item.description || '不支持的协议/方法' });
        continue;
      }
      if (decision.action === 'skip') {
        skipped += 1;
        continue;
      }

      const finalName = (decision.name ?? item.name).trim();
      const finalPath = (decision.path ?? item.path).trim();

      try {
        if (decision.action === 'overwrite') {
          // 找现有冲突接口（method+path 匹配）
          const target = existing.find((e) => e.method === item.method && e.path === finalPath);
          if (target) {
            // 更新现有接口（保留 id 和 createdAt）
            db.update(mockApis)
              .set({
                name: finalName,
                description: item.description || null,
                path: finalPath,
                responseStatus: item.responseStatus,
                responseContentType: item.responseContentType,
                responseBody: item.responseBody,
                validationRules: (item.validationRules as ValidationRules | null) ?? null,
              })
              .where(eq(mockApis.id, target.id))
              .run();
            const updated = db.select().from(mockApis).where(eq(mockApis.id, target.id)).get()!;
            registry.upsert(updated);
            overwritten += 1;
          } else {
            // 找不到冲突目标，回退为 create
            createOne(db, featureGroupId, item.method, finalPath, finalName, {
              description: item.description,
              validationRules: item.validationRules,
              responseStatus: item.responseStatus,
              responseContentType: item.responseContentType,
              responseBody: item.responseBody,
              isEnabled: item.isEnabled,
            });
            created += 1;
          }
        } else if (decision.action === 'create') {
          // 校验冲突
          assertNoConflict(db, item.method, finalPath);
          createOne(db, featureGroupId, item.method, finalPath, finalName, {
            description: item.description,
            validationRules: item.validationRules,
            responseStatus: item.responseStatus,
            responseContentType: item.responseContentType,
            responseBody: item.responseBody,
            isEnabled: item.isEnabled,
          });
          created += 1;
        }
      } catch (err) {
        errors.push({
          index: decision.index,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    res.success({
      created,
      overwritten,
      skipped,
      errors,
    });
  }),
);

function createOne(
  db: ReturnType<typeof getDb>,
  featureGroupId: number,
  method: HttpMethod,
  path: string,
  name: string,
  item: {
    description: string;
    validationRules: unknown;
    responseStatus: number;
    responseContentType: string;
    responseBody: unknown;
    isEnabled: boolean;
  },
): void {
  const [row] = db
    .insert(mockApis)
    .values({
      featureGroupId,
      name,
      description: item.description || null,
      protocol: 'HTTP',
      method,
      path,
      isEnabled: item.isEnabled,
      sortOrder: 0,
      responseStatus: item.responseStatus,
      responseDelay: 0,
      responseDelayMax: 0,
      responseContentType: item.responseContentType,
      responseHeaders: null,
      responseBody: item.responseBody ?? null,
      validationRules: (item.validationRules as ValidationRules | null) ?? null,
      dataOp: 'none',
      dataTable: null,
      dataWhere: null,
      script: null,
    })
    .returning()
    .all();
  registry.upsert(row);
}

function assertNoConflict(db: ReturnType<typeof getDb>, method: HttpMethod, path: string): void {
  const candidates = db
    .select()
    .from(mockApis)
    .where(and(eq(mockApis.method, method), eq(mockApis.isEnabled, true)))
    .all();
  const conflict = candidates.find((c) => c.path === path);
  if (conflict) {
    throw new ApiError(
      'ROUTE_CONFLICT',
      `路由冲突：${method} ${path} 已被接口 #${conflict.id} "${conflict.name}" 占用`,
      409,
      { conflictApiId: conflict.id, conflictName: conflict.name },
    );
  }
}

type ConflictInfo = {
  kind: 'route' | 'name';
  existingId: number;
  existingName: string;
  existingMethod: HttpMethod;
  existingPath: string;
};

function detectConflict(existing: MockApi[], item: NormalizedImportItem): ConflictInfo | null {
  // 仅 (method, path) 冲突会阻止创建，name 重复不阻塞（仅标记提醒）
  const routeMatch = existing.find(
    (e) => e.method === item.method && e.path === item.path && e.isEnabled,
  );
  if (routeMatch) {
    return {
      kind: 'route',
      existingId: routeMatch.id,
      existingName: routeMatch.name,
      existingMethod: routeMatch.method,
      existingPath: routeMatch.path,
    };
  }
  const nameMatch = existing.find((e) => e.name === item.name);
  if (nameMatch) {
    return {
      kind: 'name',
      existingId: nameMatch.id,
      existingName: nameMatch.name,
      existingMethod: nameMatch.method,
      existingPath: nameMatch.path,
    };
  }
  return null;
}

export { router as swaggerImportRouter };
