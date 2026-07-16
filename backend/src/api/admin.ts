import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import axios from 'axios';
import { config } from '../config/index.js';
import { backup, restore, listBackups, deleteBackup } from '../utils/backup.js';
import { closeDb, getDb } from '../db/index.js';
import { ApiError, asyncHandler } from '../middleware/error-handler.js';
import { logger } from '../utils/logger.js';

const router = Router();

const restoreSchema = z.object({
  name: z.string().min(1),
});

const probeUrlSchema = z.object({
  url: z
    .string()
    .min(1)
    .max(2048)
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    }, '请输入有效的 http(s) URL'),
  method: z
    .enum(['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])
    .optional()
    .default('GET'),
  timeoutMs: z.number().int().min(1000).max(30_000).optional().default(10_000),
});

// 创建备份
router.post(
  '/backup',
  asyncHandler(async (_req: Request, res: Response) => {
    const target = await backup();
    res.success({ path: target, name: path.basename(target) });
  }),
);

// 列出备份
router.get(
  '/backups',
  asyncHandler(async (_req: Request, res: Response) => {
    res.success(listBackups());
  }),
);

// 恢复备份
router.post(
  '/restore',
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = restoreSchema.parse(req.body);
    const filePath = path.join(config.db.backupDir, name);
    if (!fs.existsSync(filePath)) {
      throw new ApiError('NOT_FOUND', `备份 ${name} 不存在`, 404);
    }
    if (!/\.db$/.test(name)) {
      throw new ApiError('BAD_REQUEST', '只允许恢复 .db 文件', 400);
    }
    // 恢复前关闭当前 DB 连接，restore 后由下个请求触发重新连接
    closeDb();
    await restore(filePath);
    logger.warn({ restoredFrom: name }, 'database restored, will reload on next request');
    res.success({ restoredFrom: name, dbPath: config.db.path });
  }),
);

// 删除备份
const deleteBackupParamSchema = z.object({
  name: z.string().min(1).regex(/\.db$/),
});

router.delete(
  '/backups/:name',
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = deleteBackupParamSchema.parse(req.params);
    deleteBackup(name);
    res.success({ name, deleted: true });
  }),
);

// 数据库健康检查（扩展 health 接口的 DB 视角）
router.get(
  '/health/db',
  asyncHandler(async (_req: Request, res: Response) => {
    getDb(); // 触发 lazy 初始化（若未初始化）
    res.success({
      dbPath: config.db.path,
      backupDir: config.db.backupDir,
      port: config.port,
      status: 'ok',
    });
  }),
);

// 探测给定 URL 是否可访问（服务端发起，绕过浏览器 CORS）
router.post(
  '/probe-url',
  asyncHandler(async (req: Request, res: Response) => {
    const { url, method, timeoutMs } = probeUrlSchema.parse(req.body);
    const started = Date.now();
    try {
      // 连通性探测只需状态码/头，用 stream 拿到响应后立刻丢弃 body，避免大响应触发 maxContentLength
      const resp = await axios.request({
        url,
        method,
        timeout: timeoutMs,
        maxRedirects: 5,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        responseType: 'stream',
        validateStatus: () => true,
        headers: {
          'User-Agent': 'MockStudio-URL-Probe/1.0',
          Accept: '*/*',
        },
      });
      const stream = resp.data as { destroy?: () => void } | null;
      stream?.destroy?.();
      const elapsedMs = Date.now() - started;
      const status = resp.status;
      res.success({
        ok: status >= 200 && status < 400,
        reachable: true,
        status,
        statusText: resp.statusText || null,
        elapsedMs,
        contentType: (resp.headers['content-type'] as string | undefined) ?? null,
        error: null,
      });
    } catch (err) {
      const elapsedMs = Date.now() - started;
      const ax = err as { code?: string; message?: string };
      const message = ax.message ?? (err instanceof Error ? err.message : String(err));
      logger.info({ url, method, err: message, code: ax.code }, 'probe-url failed');
      res.success({
        ok: false,
        reachable: false,
        status: null,
        statusText: null,
        elapsedMs,
        contentType: null,
        error: ax.code ? `${ax.code}: ${message}` : message,
      });
    }
  }),
);

export { router as adminRouter };