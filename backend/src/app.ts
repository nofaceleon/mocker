import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { handleMockRequest } from './mock-engine/index.js';
import { apiRouter } from './api/index.js';
import { agentsGuideRouter } from './api/agents-guide.js';
import { responseMiddleware } from './middleware/response.js';
import { errorHandler } from './middleware/error-handler.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    cors({
      origin: config.corsOrigin.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );

  app.use(express.json({ limit: config.maxBodySize }));
  app.use(express.urlencoded({ extended: true, limit: config.maxBodySize }));

  // 全局响应包装（在路由之前）
  app.use(responseMiddleware);

  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug({ method: req.method, url: req.url }, 'incoming');
    next();
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'mockhub-backend', ts: Date.now() });
  });

  // 管理 API：/api/*
  app.use('/api', apiRouter);

  // agents-guide 静态资源（.md / .json）必须在 SPA 兜底和 mock 引擎之前注册，
  // 否则生产环境浏览器导航（Accept: text/html）会先被 index.html 截获，
  // React Router 对 /agents-guide.md 无路由 → Unexpected Application Error 404
  app.use('/', agentsGuideRouter);

  // 生产环境：托管前端静态文件 + SPA 兜底
  //   - express.static 只服务实际存在的文件（JS/CSS/图片等），不存在的路径调用 next()
  //   - 对于浏览器导航（Accept 含 text/html）且非 API 路径，返回 index.html 给 SPA
  //   - 放在 mock 引擎前，保证浏览器导航不走 mock 引擎的 404 JSON
  if (config.env === 'production') {
    const frontendDist = path.resolve(__dirname, '../../frontend/dist');
    app.use(express.static(frontendDist));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'GET') {
        const accept = req.headers.accept || '';
        if (accept.includes('text/html')) {
          res.sendFile(path.resolve(frontendDist, 'index.html'));
          return;
        }
      }
      next();
    });
  }

  // Mock 引擎入口（根路径，用户自定义路由原样生效）
  app.use('/', handleMockRequest as unknown as express.RequestHandler);

  // 404
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    });
  });

  // 统一错误处理（必须放最后）
  app.use(errorHandler);

  return app;
}
