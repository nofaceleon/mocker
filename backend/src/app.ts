import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { handleMockRequest } from './mock-engine/index.js';
import { apiRouter } from './api/index.js';
import { responseMiddleware } from './middleware/response.js';
import { errorHandler } from './middleware/error-handler.js';
import { logger } from './utils/logger.js';

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

  // Mock 引擎入口：/mock/*
  app.use('/mock', handleMockRequest as unknown as express.RequestHandler);

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