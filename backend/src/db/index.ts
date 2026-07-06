import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import * as schema from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type Db = BetterSQLite3Database<typeof schema>;

let sqliteInstance: Database.Database | null = null;
let dbInstance: Db | null = null;

function ensureDataDir(): void {
  const dir = path.dirname(config.db.path);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info({ dir }, 'created data directory');
  }
}

function openSqlite(): Database.Database {
  ensureDataDir();
  const sqlite = new Database(config.db.path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('synchronous = NORMAL');
  return sqlite;
}

export function getDb(): Db {
  if (dbInstance) return dbInstance;

  sqliteInstance = openSqlite();
  dbInstance = drizzle(sqliteInstance, { schema });

  runMigrations(dbInstance);
  logger.info({ path: config.db.path }, 'database ready');
  return dbInstance;
}

function runMigrations(db: Db): void {
  const migrationsFolder = path.resolve(__dirname, '../../drizzle');
  if (!fs.existsSync(migrationsFolder)) {
    logger.warn({ migrationsFolder }, 'no migrations folder found, skipping migrate');
    return;
  }
  try {
    migrate(db, { migrationsFolder });
    logger.info({ migrationsFolder }, 'migrations applied');
  } catch (err) {
    logger.error({ err, migrationsFolder }, 'migration failed');
    throw err;
  }
}

export function closeDb(): void {
  if (sqliteInstance) {
    sqliteInstance.close();
    sqliteInstance = null;
    dbInstance = null;
    logger.info('database closed');
  }
}

/** 仅供 migrate.ts 脚本和测试使用：拿原始 sqlite 实例（用于 backup 等） */
export function getRawSqlite(): Database.Database {
  if (!sqliteInstance) {
    sqliteInstance = openSqlite();
  }
  return sqliteInstance;
}

export { schema };
export * from './schema.js';