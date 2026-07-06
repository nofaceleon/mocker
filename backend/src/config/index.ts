import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function toNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolveDbPath(raw: string | undefined): string {
  const fallback = path.resolve(process.cwd(), '../data/mock.db');
  if (!raw) return fallback;
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: toNumber(process.env.PORT, 3000),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  maxBodySize: toNumber(process.env.MAX_BODY_SIZE, 1024 * 1024),
  db: {
    path: resolveDbPath(process.env.DB_PATH),
    backupDir: path.resolve(process.cwd(), '../data/backups'),
  },
} as const;

export type AppConfig = typeof config;