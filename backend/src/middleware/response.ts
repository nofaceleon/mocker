import type { Request, Response, NextFunction } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Response {
      success: <T>(data: T, meta?: Record<string, unknown>) => void;
      fail: (code: string, message: string, status?: number, details?: unknown) => void;
    }
  }
}

export function responseMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.success = <T>(data: T, meta?: Record<string, unknown>) => {
    const body: Record<string, unknown> = { code: 'OK', data };
    if (meta) body.meta = meta;
    res.json(body);
  };

  res.fail = (code: string, message: string, status = 400, details?: unknown) => {
    res.status(status).json({
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    });
  };

  next();
}