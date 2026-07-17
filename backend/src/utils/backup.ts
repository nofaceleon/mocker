import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { logger } from './logger.js';

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/** 备份 SQLite 数据库到 backupDir，返回备份文件路径 */
export async function backup(dbPath: string = config.db.path): Promise<string> {
  ensureDir(config.db.backupDir);
  const target = path.join(config.db.backupDir, `mock-${timestamp()}.db`);

  // 简单方案：直接复制文件。WAL 模式下需要先 checkpoint 保证一致。
  // 也可使用 SQLite 的 `.backup` API（在线热备），更可靠。
  await copyWithConsistency(dbPath, target);

  logger.info({ dbPath, target }, 'database backup created');
  return target;
}

function copyWithConsistency(srcPath: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let src: Database.Database | null = null;
    try {
      src = new Database(srcPath, { readonly: true });
      // 使用 SQLite 内置 backup API
      src
        .backup(destPath)
        .then(() => {
          src?.close();
          resolve();
        })
        .catch((err) => {
          src?.close();
          reject(err);
        });
    } catch (err) {
      src?.close();
      reject(err);
    }
  });
}

/** 从备份恢复数据库 */
export async function restore(backupPath: string): Promise<void> {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }
  // 为安全起见，恢复前先备份当前数据库
  await backup(config.db.path);
  fs.copyFileSync(backupPath, config.db.path);
  logger.info({ backupPath, restoredTo: config.db.path }, 'database restored from backup');
}

/** 列出所有备份文件，按时间倒序 */
export function listBackups(): Array<{ name: string; path: string; size: number; mtime: Date }> {
  ensureDir(config.db.backupDir);
  return fs
    .readdirSync(config.db.backupDir)
    .filter((f) => f.endsWith('.db'))
    .map((name) => {
      const fullPath = path.join(config.db.backupDir, name);
      const stat = fs.statSync(fullPath);
      return { name, path: fullPath, size: stat.size, mtime: stat.mtime };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

/** 删除指定备份 */
export function deleteBackup(name: string): void {
  const target = path.join(config.db.backupDir, name);
  if (!fs.existsSync(target)) {
    throw new Error(`Backup not found: ${name}`);
  }
  fs.unlinkSync(target);
  logger.info({ name }, 'backup deleted');
}
