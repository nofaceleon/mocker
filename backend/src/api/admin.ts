import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config/index.js';
import { backup, restore, listBackups, deleteBackup } from '../utils/backup.js';
import { closeDb, getDb } from '../db/index.js';
import { ApiError, asyncHandler } from '../middleware/error-handler.js';
import { logger } from '../utils/logger.js';

const router = Router();

const restoreSchema = z.object({
  name: z.string().min(1),
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

export { router as adminRouter };