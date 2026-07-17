import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

/** 业务错误：业务代码主动抛出 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Express 错误处理：放在所有路由之后 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: '请求参数校验失败',
      details: err.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
    return;
  }

  // better-sqlite3 UNIQUE 冲突
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code;
    if (code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      res.status(409).json({
        code: 'CONFLICT',
        message: '资源已存在或违反唯一性约束',
      });
      return;
    }
  }

  logger.error({ err, path: req.path, method: req.method }, 'unhandled api error');
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ code: 'INTERNAL_ERROR', message });
};

/** 包装 async handler，自动捕获 promise rejection */
export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown> | unknown,
) {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
