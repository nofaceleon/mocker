import type Database from 'better-sqlite3';
import { getRawSqlite } from '../db/index.js';
import { logger } from '../utils/logger.js';

export type DbOpsResult =
  | { kind: 'rows'; rows: unknown[] }
  | { kind: 'row'; row: Record<string, unknown> }
  | { kind: 'affected'; affected: number };

export type WhereClause = Record<string, unknown>;

/**
 * 在指定业务表上执行 CRUD。
 * where 简化为 { key: value } 等值匹配（P0 范围，P2 可扩展）。
 */
export function execute(
  op: 'insert' | 'select' | 'update' | 'delete',
  table: string,
  payload: Record<string, unknown> | WhereClause | undefined,
  where?: WhereClause,
): DbOpsResult {
  const sqlite = getRawSqlite();
  validateIdentifier(table);

  switch (op) {
    case 'insert':
      return doInsert(sqlite, table, (payload as Record<string, unknown>) ?? {});
    case 'select':
      return doSelect(sqlite, table, where ?? (payload as WhereClause) ?? {});
    case 'update':
      return doUpdate(sqlite, table, (payload as Record<string, unknown>) ?? {}, where ?? {});
    case 'delete':
      return doDelete(sqlite, table, where ?? (payload as WhereClause) ?? {});
  }
}

function doInsert(sqlite: Database.Database, table: string, data: Record<string, unknown>): DbOpsResult {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  if (entries.length === 0) {
    return { kind: 'affected', affected: 0 };
  }
  const cols = entries.map(([k]) => k);
  const placeholders = cols.map(() => '?').join(', ');
  const values = entries.map(([, v]) => normalizeValue(v));
  const sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}, created_at, updated_at) VALUES (${placeholders}, ?, ?)`;
  const now = Date.now();
  const stmt = sqlite.prepare(sql);
  const info = stmt.run(...values, now, now);
  const newRow = sqlite
    .prepare(`SELECT * FROM "${table}" WHERE id = ?`)
    .get(info.lastInsertRowid) as Record<string, unknown> | undefined;
  return { kind: 'row', row: newRow ?? { id: info.lastInsertRowid } };
}

function doSelect(sqlite: Database.Database, table: string, where: WhereClause): DbOpsResult {
  const { sql, values } = buildSelect(table, where);
  const stmt = sqlite.prepare(sql);
  const rows = stmt.all(...values) as unknown[];
  return { kind: 'rows', rows };
}

function doUpdate(
  sqlite: Database.Database,
  table: string,
  patch: Record<string, unknown>,
  where: WhereClause,
): DbOpsResult {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return { kind: 'affected', affected: 0 };
  const setClause = entries.map(([k]) => `"${k}" = ?`).join(', ');
  const { whereSql, whereValues } = buildWhere(where);
  const sql = `UPDATE "${table}" SET ${setClause}, updated_at = ? ${whereSql}`;
  const stmt = sqlite.prepare(sql);
  const info = stmt.run(...entries.map(([, v]) => normalizeValue(v)), Date.now(), ...whereValues);
  return { kind: 'affected', affected: info.changes };
}

function doDelete(sqlite: Database.Database, table: string, where: WhereClause): DbOpsResult {
  const { whereSql, whereValues } = buildWhere(where);
  const sql = `DELETE FROM "${table}" ${whereSql}`;
  const stmt = sqlite.prepare(sql);
  const info = stmt.run(...whereValues);
  return { kind: 'affected', affected: info.changes };
}

function buildSelect(table: string, where: WhereClause): { sql: string; values: unknown[] } {
  const { whereSql, whereValues } = buildWhere(where);
  return {
    sql: `SELECT * FROM "${table}" ${whereSql} ORDER BY id ASC`,
    values: whereValues,
  };
}

function buildWhere(where: WhereClause): { whereSql: string; whereValues: unknown[] } {
  const entries = Object.entries(where).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return { whereSql: '', whereValues: [] };
  const clauses = entries.map(([k]) => `"${k}" = ?`).join(' AND ');
  return {
    whereSql: `WHERE ${clauses}`,
    whereValues: entries.map(([, v]) => normalizeValue(v)),
  };
}

function normalizeValue(v: unknown): unknown {
  if (v === undefined || v === null) return v;
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

/** 防御性：表名/列名只允许字母数字下划线 */
export function validateIdentifier(name: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }
}