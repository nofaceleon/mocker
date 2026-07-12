import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import { getDb, getRawSqlite } from '../db/index.js';
import { featureGroups, mockApis, mockData } from '../db/schema.js';
import {
  listBusinessTables,
  listColumns,
  tableExists,
  validateIdentifier,
  addBusinessColumn,
  renameBusinessColumn,
  dropBusinessColumn,
  dropBusinessTable,
  isReservedColumn,
} from '../mock-engine/index.js';
import { ApiError, asyncHandler } from '../middleware/error-handler.js';

const router = Router();

const RESERVED_TABLES = new Set([
  'projects',
  'feature_groups',
  'mock_apis',
  'mock_data',
  'request_logs',
  'callback_configs',
  'callback_tasks',
  'sqlite_sequence',
]);

const projectIdParamSchema = z.object({
  projectId: z.coerce.number().int().positive(),
});

const tableNameParamSchema = z.object({
  tableName: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
});

const rowIdParamSchema = z.object({
  tableName: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  rowId: z.coerce.number().int().positive(),
});

const tableQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(500).optional().default(50),
  q: z.string().optional(),
});

function assertBusinessTable(tableName: string): void {
  validateIdentifier(tableName);
  if (RESERVED_TABLES.has(tableName)) {
    throw new ApiError('FORBIDDEN', `系统表 ${tableName} 不可操作`, 403);
  }
  const sqlite = getRawSqlite();
  if (!tableExists(sqlite, tableName)) {
    throw new ApiError('NOT_FOUND', `表 ${tableName} 不存在`, 404);
  }
  // 二次确认：必须在业务表列表中（排除遗漏的系统表）
  const allowed = new Set(listBusinessTables().map((t) => t.name));
  if (!allowed.has(tableName)) {
    throw new ApiError('FORBIDDEN', `表 ${tableName} 不是可管理的业务表`, 403);
  }
}

function tableRowCount(tableName: string): number {
  const sqlite = getRawSqlite();
  return (sqlite.prepare(`SELECT COUNT(*) AS c FROM "${tableName}"`).get() as { c: number }).c;
}

// 列出指定项目下所有可浏览的数据（元数据 + mock_data，不含全量行）
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

    const apiIds = apis.map((a) => a.id);
    const mockDataRows =
      apiIds.length === 0
        ? []
        : db
            .select()
            .from(mockData)
            .orderBy(asc(mockData.id))
            .all()
            .filter((m) => apiIds.includes(m.apiId));

    const referencedTables = new Set(
      apis.map((a) => a.dataTable).filter((t): t is string => !!t && t !== ''),
    );
    const allTables = listBusinessTables();
    const projectTables = allTables.filter((t) => referencedTables.has(t.name));

    const businessTables = projectTables.map((t) => ({
      name: t.name,
      columns: listColumns(sqlite, t.name),
      rows: [] as unknown[],
      rowCount: tableRowCount(t.name),
    }));

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

// 查询单个业务表（分页 + 搜索）
router.get(
  '/data-browser/tables/:tableName',
  asyncHandler(async (req: Request, res: Response) => {
    const { tableName } = tableNameParamSchema.parse(req.params);
    assertBusinessTable(tableName);
    const { page, pageSize, q } = tableQuerySchema.parse(req.query);
    const sqlite = getRawSqlite();

    const columns = listColumns(sqlite, tableName);
    const offset = (page - 1) * pageSize;

    let whereSql = '';
    const params: unknown[] = [];
    if (q && q.trim()) {
      const like = `%${q.trim()}%`;
      // 所有列 CAST 为 TEXT 后 LIKE，覆盖数字/文本
      whereSql = 'WHERE ' + columns.map((c) => `CAST("${c.name}" AS TEXT) LIKE ?`).join(' OR ');
      columns.forEach(() => params.push(like));
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

// 列出所有业务表（含行数）
router.get(
  '/data-browser/tables',
  asyncHandler(async (_req: Request, res: Response) => {
    const tables = listBusinessTables().map((t) => ({
      name: t.name,
      columns: t.columns,
      rowCount: tableRowCount(t.name),
    }));
    res.success(tables);
  }),
);

// 删除单行（按 id）
router.delete(
  '/data-browser/tables/:tableName/rows/:rowId',
  asyncHandler(async (req: Request, res: Response) => {
    const { tableName, rowId } = rowIdParamSchema.parse(req.params);
    assertBusinessTable(tableName);
    const sqlite = getRawSqlite();
    const info = sqlite.prepare(`DELETE FROM "${tableName}" WHERE id = ?`).run(rowId);
    if (info.changes === 0) {
      throw new ApiError('NOT_FOUND', `行 id=${rowId} 不存在`, 404);
    }
    res.success({ table: tableName, id: rowId, deleted: true });
  }),
);

// 清空业务表（保留表结构）
router.post(
  '/data-browser/tables/:tableName/clear',
  asyncHandler(async (req: Request, res: Response) => {
    const { tableName } = tableNameParamSchema.parse(req.params);
    assertBusinessTable(tableName);
    const sqlite = getRawSqlite();
    const info = sqlite.prepare(`DELETE FROM "${tableName}"`).run();
    res.success({ table: tableName, cleared: true, affected: info.changes });
  }),
);

// 删除业务表
router.delete(
  '/data-browser/tables/:tableName',
  asyncHandler(async (req: Request, res: Response) => {
    const { tableName } = tableNameParamSchema.parse(req.params);
    assertBusinessTable(tableName);
    try {
      dropBusinessTable(tableName);
    } catch (err) {
      throw new ApiError('DROP_FAILED', err instanceof Error ? err.message : '删除表失败', 400);
    }
    // 清理接口上仍指向该表的 dataTable 引用
    const db = getDb();
    db.update(mockApis).set({ dataTable: null }).where(eq(mockApis.dataTable, tableName)).run();
    res.success({ table: tableName, deleted: true });
  }),
);

const addColumnSchema = z.object({
  name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  type: z.enum(['TEXT', 'REAL', 'INTEGER', 'BLOB']).optional().default('TEXT'),
});

const renameColumnSchema = z.object({
  newName: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
});

const columnNameParamSchema = z.object({
  tableName: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  columnName: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
});

// 新增列
router.post(
  '/data-browser/tables/:tableName/columns',
  asyncHandler(async (req: Request, res: Response) => {
    const { tableName } = tableNameParamSchema.parse(req.params);
    assertBusinessTable(tableName);
    const body = addColumnSchema.parse(req.body);
    try {
      const columns = addBusinessColumn(tableName, body.name, body.type);
      res.success({ table: tableName, columns }, { status: 201 });
    } catch (err) {
      throw new ApiError('ALTER_FAILED', err instanceof Error ? err.message : '新增列失败', 400);
    }
  }),
);

// 重命名列
router.patch(
  '/data-browser/tables/:tableName/columns/:columnName',
  asyncHandler(async (req: Request, res: Response) => {
    const { tableName, columnName } = columnNameParamSchema.parse(req.params);
    assertBusinessTable(tableName);
    const body = renameColumnSchema.parse(req.body);
    if (isReservedColumn(columnName)) {
      throw new ApiError('FORBIDDEN', `列 ${columnName} 为系统保留字段`, 403);
    }
    try {
      const columns = renameBusinessColumn(tableName, columnName, body.newName);
      res.success({ table: tableName, columns });
    } catch (err) {
      throw new ApiError('ALTER_FAILED', err instanceof Error ? err.message : '重命名列失败', 400);
    }
  }),
);

// 删除列
router.delete(
  '/data-browser/tables/:tableName/columns/:columnName',
  asyncHandler(async (req: Request, res: Response) => {
    const { tableName, columnName } = columnNameParamSchema.parse(req.params);
    assertBusinessTable(tableName);
    if (isReservedColumn(columnName)) {
      throw new ApiError('FORBIDDEN', `列 ${columnName} 为系统保留字段，不可删除`, 403);
    }
    try {
      const columns = dropBusinessColumn(tableName, columnName);
      res.success({ table: tableName, columns, dropped: columnName });
    } catch (err) {
      throw new ApiError('ALTER_FAILED', err instanceof Error ? err.message : '删除列失败', 400);
    }
  }),
);

export { router as dataBrowserRouter };
