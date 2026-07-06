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