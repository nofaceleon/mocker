import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError } from '../middleware/error-handler.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 把 MockHub 给 AI 用的「AGENTS 对接指南」资源以正确 Content-Type 暴露。
 * - /agents-guide.md            → text/markdown; charset=utf-8
 * - /agents-guide.example.json  → application/json; charset=utf-8
 * - /agents-edit.md             → text/markdown; charset=utf-8
 *
 * 由 frontend dev server 通过 proxy 转发到 :3000，prod 则由 Express 直接服务。
 * 显式设 charset 是为了绕开某些浏览器对 .md / .json 默认按本地编码解码导致中文乱码的问题。
 *
 * 资源单一来源：frontend/src/assets/，避免在两个仓里双写。
 *  - dev：直接读 frontend/src/assets/（同机、相对路径）
 *  - prod：backend/scripts/copy-assets.mjs 把它们复制到 backend/dist/assets/
 */
function resolveAssetsDir(): string {
  const candidates = [
    path.resolve(__dirname, '../../../frontend/src/assets'), // dev: backend/src/api -> ../../../mockhub/frontend/src/assets
    path.resolve(__dirname, '../assets'), // prod: backend/dist/api -> ../assets
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  throw new Error(`agents-guide assets not found. Tried:\n  ${candidates.join('\n  ')}`);
}

const ASSETS_DIR = resolveAssetsDir();

type Asset = {
  filename: string;
  contentType: string;
};

const ASSETS: Record<string, Asset> = {
  '/agents-guide.md': { filename: 'agents-guide.md', contentType: 'text/markdown; charset=utf-8' },
  '/agents-guide.example.json': {
    filename: 'agents-guide.example.json',
    contentType: 'application/json; charset=utf-8',
  },
  '/agents-edit.md': { filename: 'agents-edit.md', contentType: 'text/markdown; charset=utf-8' },
};

function serveAsset(asset: Asset) {
  return (_req: Request, res: Response) => {
    const filePath = path.join(ASSETS_DIR, asset.filename);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      res.setHeader('Content-Type', asset.contentType);
      res.setHeader('Cache-Control', 'no-cache');
      res.send(content);
    } catch (err) {
      logger.warn({ err, filePath }, 'agents-guide asset read failed');
      throw new ApiError('NOT_FOUND', `Resource ${asset.filename} not found`, 404);
    }
  };
}

const router = Router();
for (const [route, asset] of Object.entries(ASSETS)) {
  router.get(route, serveAsset(asset));
}

export { router as agentsGuideRouter };
