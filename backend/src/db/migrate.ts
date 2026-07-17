import 'dotenv/config';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const dir = path.dirname(config.db.path);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[migrate] created data dir: ${dir}`);
  }

  const migrationsFolder = path.resolve(__dirname, '../../drizzle');
  if (!fs.existsSync(migrationsFolder)) {
    console.error(`[migrate] migrations folder not found: ${migrationsFolder}`);
    console.error('[migrate] run `pnpm db:generate` first to create migrations');
    process.exit(1);
  }

  console.log(`[migrate] db path: ${config.db.path}`);
  console.log(`[migrate] migrations: ${migrationsFolder}`);

  const sqlite = new Database(config.db.path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite);

  try {
    migrate(db, { migrationsFolder });
    console.log('[migrate] ✓ done');
  } catch (err) {
    console.error('[migrate] ✗ failed:', err);
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

main();
