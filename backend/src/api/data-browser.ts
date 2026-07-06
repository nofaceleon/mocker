import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import { getDb, getRawSqlite } from '../db/index.js';
import { featureGroups, mockApis, mockData } from '../db/schema.js';
import { listBusinessTables, listColumns } from '../mock-engine/index.js';
import { ApiError, asyncHandler } from '../middleware/error-handler.js';

const router = Router();

const projectIdParamSchema = z.object({
  projectId: z.coerce.number().int().positive(),
});

// 列出指定项目下所有可浏览的数据：
//   1) mock_data 表（手动管理的数据）
//   2) 自动建表的业务表（按 featureGroup -> dataTable 关联展示）
router.get(
  '/projects/:projectId/data-browser',
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const db = getDb();
    const sqlite = getRawSqlite();

    const groups = db
      .select()
      .from(featureGroups)
      .where(eq(featureGroups.projectId, projectId))
      .all();
    if (groups.length === 0) {
      res.success({ businessTables: [], mockData: [], apis: [] });
      return;
    }

    const groupIds = new Set(groups.map((g) => g.id));
    const apis = db
      .select()
      .from(mockApis)
      .orderBy(asc(mockApis.sortOrder), asc(mockApis.id))
      .all()
      .filter((a) => groupIds.has(a.featureGroupId));

    // 1) 手动 Mock 数据
    const apiIds = apis.map((a) => a.id);
    const mockDataRows = apiIds.length === 0
      ? []
      : db
          .select()
          .from(mockData)
          .orderBy(asc(mockData.id))
          .all()
          .filter((m) => apiIds.includes(m.apiId));

    // 2) 业务表：找出项目下所有 apis 引用过的 dataTable
    const referencedTables = new Set(
      apis.map((a) => a.dataTable).filter((t): t is string => !!t && t !== ''),
    );
    const allTables = listBusinessTables();
    const projectTables = allTables.filter((t) => referencedTables.has(t.name));

    const businessTables = projectTables.map((t) => {
      const rows = sqlite
        .prepare(`SELECT * FROM "${t.name}" ORDER BY id DESC LIMIT 200`)
        .all() as unknown[];
      return {
        name: t.name,
        columns: listColumns(sqlite, t.name),
        rows,
        rowCount: (sqlite.prepare(`SELECT COUNT(*) AS c FROM "${t.name}"`).get() as { c: number }).c,
      };
    });

    res.success({
      businessTables,
      mockData: mockDataRows,
      apis: apis.map((a) => ({
        id: a.id,
        name: a.name,
        method: a.method,
        path: a.path,
        dataOp: a.dataOp,
        dataTable: a.dataTable,
        featureGroupId: a.featureGroupId,
      })),
    });
  }),
);

// 查询单个业务表的详细数据（支持分页）
const tableQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(500).optional().default(50),
  q: z.string().optional(),
});

const tableNameParamSchema = z.object({
  tableName: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
});

router.get(
  '/data-browser/tables/:tableName',
  asyncHandler(async (req: Request, res: Response) => {
    const { tableName } = tableNameParamSchema.parse(req.params);
    const { page, pageSize, q } = tableQuerySchema.parse(req.query);
    const sqlite = getRawSqlite();

    const exists = sqlite
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?")
      .get(tableName);
    if (!exists) throw new ApiError('NOT_FOUND', `表 ${tableName} 不存在`, 404);

    const columns = listColumns(sqlite, tableName);
    const offset = (page - 1) * pageSize;

    let whereSql = '';
    const params: unknown[] = [];
    if (q && q.trim()) {
      // 简单 LIKE 搜索所有 TEXT 列
      const textCols = columns.filter((c) => c.type.toUpperCase().includes('TEXT'));
      if (textCols.length > 0) {
        const like = `%${q.trim()}%`;
        whereSql =
          'WHERE ' + textCols.map((c) => `"${c.name}" LIKE ?`).join(' OR ');
        textCols.forEach(() => params.push(like));
      }
    }

    const total = (
      sqlite.prepare(`SELECT COUNT(*) AS c FROM "${tableName}" ${whereSql}`).get(...params) as {
        c: number;
      }
    ).c;
    const rows = sqlite
      .prepare(`SELECT * FROM "${tableName}" ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...params, pageSize, offset);

    res.success({
      table: tableName,
      columns,
      rows,
      total,
      page,
      pageSize,
    });
  }),
);

// 列出所有业务表（不依赖项目）
router.get(
  '/data-browser/tables',
  asyncHandler(async (_req: Request, res: Response) => {
    const tables = listBusinessTables();
    res.success(tables);
  }),
);

export { router as dataBrowserRouter };