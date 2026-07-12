import type Database from 'better-sqlite3';
import { getRawSqlite } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { validateIdentifier } from './db-ops.js';

export type ColumnInfo = {
  name: string;
  type: string;
  notnull: boolean;
  pk: boolean;
};

const RESERVED_COLUMNS = new Set(['id', 'created_at', 'updated_at']);

/**
 * 若表不存在，按 sampleRow 的字段自动建表（id / created_at / updated_at 为内置列）。
 * 已存在的表：返回当前 schema 信息，不做 ALTER。
 *
 * P0 设计取舍：
 *  - 业务表结构宽容：数字 → REAL，其余 → TEXT
 *  - JSON 对象 → TEXT 存储，查询时不展开
 *  - 不做 ALTER（避免数据迁移复杂度，P1 再加）
 */
export function ensureBusinessTable(table: string, sampleRow: Record<string, unknown>): void {
  validateIdentifier(table);
  const sqlite = getRawSqlite();

  if (tableExists(sqlite, table)) return;

  const cols = inferColumns(sampleRow);
  const colsSql = cols.map((c) => `"${c.name}" ${c.type}`).join(', ');
  const sql = `CREATE TABLE "${table}" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ${colsSql},
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`;
  sqlite.exec(sql);
  logger.info({ table, columns: cols.map((c) => c.name) }, 'business table auto-created');
}

export function tableExists(sqlite: Database.Database, table: string): boolean {
  const row = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?")
    .get(table);
  return !!row;
}

export function listColumns(sqlite: Database.Database, table: string): ColumnInfo[] {
  const rows = sqlite.prepare(`PRAGMA table_info("${table}")`).all() as Array<{
    name: string;
    type: string;
    notnull: number;
    pk: number;
  }>;
  return rows.map((r) => ({
    name: r.name,
    type: r.type,
    notnull: !!r.notnull,
    pk: !!r.pk,
  }));
}

export function listBusinessTables(): Array<{ name: string; columns: ColumnInfo[] }> {
  const sqlite = getRawSqlite();
  const rows = sqlite
    .prepare(
      // ESCAPE '\\' 把 _ 当字面量处理，避免 LIKE 通配符误匹配
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name NOT LIKE '\\_\\_%' ESCAPE '\\'",
    )
    .all() as Array<{ name: string }>;

  const reserved = new Set([
    'projects',
    'feature_groups',
    'mock_apis',
    'mock_data',
    'request_logs',
    'callback_configs',
    'callback_tasks',
  ]);

  return rows
    .filter((r) => !reserved.has(r.name))
    .map((r) => ({ name: r.name, columns: listColumns(sqlite, r.name) }));
}

function inferColumns(sampleRow: Record<string, unknown>): Array<{ name: string; type: string }> {
  const cols: Array<{ name: string; type: string }> = [];
  for (const [k, v] of Object.entries(sampleRow)) {
    if (RESERVED_COLUMNS.has(k)) continue;
    validateIdentifier(k);
    cols.push({ name: k, type: typeof v === 'number' ? 'REAL' : 'TEXT' });
  }
  return cols;
}

const ALLOWED_COL_TYPES = new Set(['TEXT', 'REAL', 'INTEGER', 'BLOB']);

export function normalizeColumnType(type: string): string {
  const t = (type || 'TEXT').toUpperCase().trim();
  if (ALLOWED_COL_TYPES.has(t)) return t;
  throw new Error(`不支持的列类型: ${type}（允许 TEXT / REAL / INTEGER / BLOB）`);
}

export function isReservedColumn(name: string): boolean {
  return RESERVED_COLUMNS.has(name);
}

/** 新增业务列（不可覆盖内置列） */
export function addBusinessColumn(table: string, name: string, type: string = 'TEXT'): ColumnInfo[] {
  validateIdentifier(table);
  validateIdentifier(name);
  if (RESERVED_COLUMNS.has(name)) {
    throw new Error(`列 ${name} 为系统保留字段，不可新增`);
  }
  const colType = normalizeColumnType(type);
  const sqlite = getRawSqlite();
  if (!tableExists(sqlite, table)) throw new Error(`表 ${table} 不存在`);
  const existing = listColumns(sqlite, table);
  if (existing.some((c) => c.name === name)) {
    throw new Error(`列 ${name} 已存在`);
  }
  sqlite.exec(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${colType}`);
  logger.info({ table, name, colType }, 'business column added');
  return listColumns(sqlite, table);
}

/** 重命名业务列（不可改内置列） */
export function renameBusinessColumn(table: string, oldName: string, newName: string): ColumnInfo[] {
  validateIdentifier(table);
  validateIdentifier(oldName);
  validateIdentifier(newName);
  if (RESERVED_COLUMNS.has(oldName)) {
    throw new Error(`列 ${oldName} 为系统保留字段，不可重命名`);
  }
  if (RESERVED_COLUMNS.has(newName)) {
    throw new Error(`列 ${newName} 为系统保留字段，不可使用`);
  }
  if (oldName === newName) {
    const sqlite = getRawSqlite();
    return listColumns(sqlite, table);
  }
  const sqlite = getRawSqlite();
  if (!tableExists(sqlite, table)) throw new Error(`表 ${table} 不存在`);
  const existing = listColumns(sqlite, table);
  if (!existing.some((c) => c.name === oldName)) {
    throw new Error(`列 ${oldName} 不存在`);
  }
  if (existing.some((c) => c.name === newName)) {
    throw new Error(`列 ${newName} 已存在`);
  }
  sqlite.exec(`ALTER TABLE "${table}" RENAME COLUMN "${oldName}" TO "${newName}"`);
  logger.info({ table, oldName, newName }, 'business column renamed');
  return listColumns(sqlite, table);
}

/** 删除业务列（不可删内置列；SQLite DROP COLUMN） */
export function dropBusinessColumn(table: string, name: string): ColumnInfo[] {
  validateIdentifier(table);
  validateIdentifier(name);
  if (RESERVED_COLUMNS.has(name)) {
    throw new Error(`列 ${name} 为系统保留字段，不可删除`);
  }
  const sqlite = getRawSqlite();
  if (!tableExists(sqlite, table)) throw new Error(`表 ${table} 不存在`);
  const existing = listColumns(sqlite, table);
  if (!existing.some((c) => c.name === name)) {
    throw new Error(`列 ${name} 不存在`);
  }
  // 至少保留 id + 时间戳
  const userCols = existing.filter((c) => !RESERVED_COLUMNS.has(c.name));
  if (userCols.length <= 1 && userCols[0]?.name === name) {
    // 允许删到只剩系统列
  }
  try {
    sqlite.exec(`ALTER TABLE "${table}" DROP COLUMN "${name}"`);
  } catch (err) {
    // 旧 SQLite 无 DROP COLUMN 时回退重建
    logger.warn({ err, table, name }, 'DROP COLUMN failed, rebuild table');
    rebuildWithoutColumn(sqlite, table, name);
  }
  logger.info({ table, name }, 'business column dropped');
  return listColumns(sqlite, table);
}

function rebuildWithoutColumn(sqlite: Database.Database, table: string, dropName: string): void {
  const cols = listColumns(sqlite, table).filter((c) => c.name !== dropName);
  if (cols.length === 0) throw new Error('无法删除：表将无任何列');
  const tmp = `__tmp_${table}_${Date.now()}`;
  const colDefs = cols
    .map((c) => {
      if (c.name === 'id' && c.pk) return `"id" INTEGER PRIMARY KEY AUTOINCREMENT`;
      return `"${c.name}" ${c.type || 'TEXT'}${c.notnull ? ' NOT NULL' : ''}`;
    })
    .join(', ');
  const names = cols.map((c) => `"${c.name}"`).join(', ');
  sqlite.exec(`CREATE TABLE "${tmp}" (${colDefs})`);
  sqlite.exec(`INSERT INTO "${tmp}" (${names}) SELECT ${names} FROM "${table}"`);
  sqlite.exec(`DROP TABLE "${table}"`);
  sqlite.exec(`ALTER TABLE "${tmp}" RENAME TO "${table}"`);
}

/** 删除业务表 */
export function dropBusinessTable(table: string): void {
  validateIdentifier(table);
  const sqlite = getRawSqlite();
  if (!tableExists(sqlite, table)) throw new Error(`表 ${table} 不存在`);
  sqlite.exec(`DROP TABLE IF EXISTS "${table}"`);
  logger.info({ table }, 'business table dropped');
}