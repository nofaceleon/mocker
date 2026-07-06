import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { requestLogs, type MockApi } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { matchBest, type Candidate } from './matcher.js';
import { registry } from './registry.js';
import { extractContext } from './request.js';
import { validate, buildFailResponse } from './validator.js';
import {
  renderTemplate,
  applyDelay,
  type ResponseContext,
  parseSSEConfig,
  formatSSEEvent,
  formatSSEComment,
} from './response.js';
import { execute } from './db-ops.js';
import { ensureBusinessTable } from './schema-manager.js';

/**
 * Mock 引擎主入口：所有 /mock/* 请求都走这里。
 * 不属于 mock 平台的请求会通过 Express 的 404 处理。
 */
export async function handleMockRequest(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  const start = Date.now();

  // 进入 try/catch 守护，绝不让引擎崩溃（PRD 11.3 稳定性）
  try {
    const path = req.path || '/';
    const method = req.method;

    registry.ensureLoaded();
    const matched = matchBest(method, path, registry.list() as Candidate[]);
    if (!matched) {
      // 不静默吞掉，统一返回 404 但仍写日志（apiId = null）
      sendNotFound(res, method, path);
      writeLogSafely({
        apiId: null,
        requestMethod: method,
        requestPath: path,
        requestParams: req.query,
        requestBody: req.body,
        requestHeaders: sanitizeHeaders(req.headers as Record<string, string | string[]>),
        responseStatus: 404,
        responseBody: { code: 'NOT_FOUND', message: `No mock matched ${method} ${path}` },
        responseTime: Date.now() - start,
      });
      return;
    }

    await executeMatched(req, res, matched.api, matched.params, start);
  } catch (err) {
    logger.error({ err, path: req.path, method: req.method }, 'mock engine crashed');
    if (!res.headersSent) {
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'mock engine failed',
      });
    }
  }
}

async function executeMatched(
  req: Request,
  res: Response,
  api: MockApi,
  pathParams: Record<string, string>,
  start: number,
): Promise<void> {
  // 1. 提取参数
  const reqCtx = extractContext(req, pathParams);

  // 2. 校验
  const rules = parseValidationRules(api.validationRules);
  const valid = validate(rules, reqCtx as unknown as Record<string, unknown>);
  if (!valid.ok) {
    const fail = buildFailResponse(rules, valid.errors);
    res.status(fail.status).json(fail.body);
    writeLogSafely({
      apiId: api.id,
      requestMethod: req.method,
      requestPath: stripMockPrefix(req.path),
      requestParams: reqCtx.query,
      requestBody: reqCtx.body,
      requestHeaders: reqCtx.headers,
      responseStatus: fail.status,
      responseBody: fail.body,
      responseTime: Date.now() - start,
    });
    return;
  }

  // 3. 执行数据联动（如果有）
  let dbResult: unknown;
  if (api.dataOp !== 'none' && api.dataTable) {
    const where = buildRuntimeWhere(api, reqCtx);

    if (api.dataOp === 'insert') {
      const body = (reqCtx.body ?? {}) as Record<string, unknown>;
      if (Object.keys(body).length === 0) {
        throw new Error('insert requires non-empty body');
      }
      ensureBusinessTable(api.dataTable, body);
      dbResult = unwrapResult(execute('insert', api.dataTable, body, {}));
    } else if (api.dataOp === 'update') {
      const patch = (reqCtx.body ?? {}) as Record<string, unknown>;
      dbResult = unwrapResult(execute('update', api.dataTable, patch, where));
    } else if (api.dataOp === 'select') {
      dbResult = unwrapResult(execute('select', api.dataTable, undefined, where));
    } else if (api.dataOp === 'delete') {
      dbResult = unwrapResult(execute('delete', api.dataTable, undefined, where));
    }
  }

  // 4. 构建渲染上下文
  const renderCtx: ResponseContext = { req: reqCtx, dbResult };

  // 5. 判断是否为SSE请求（根据protocol字段）
  if (api.protocol === 'SSE') {
    await handleSSERequest(req, res, api, renderCtx, start);
    return;
  }

  // 6. 普通HTTP响应
  await handleHTTPResponse(req, res, api, renderCtx, start);
}

/**
 * 处理SSE请求
 */
async function handleSSERequest(
  req: Request,
  res: Response,
  api: MockApi,
  renderCtx: ResponseContext,
  start: number,
): Promise<void> {
  const responseBody = parseResponseBody(api.responseBody);
  const sseConfig = parseSSEConfig(responseBody, renderCtx);

  if (!sseConfig || sseConfig.events.length === 0) {
    // 无效的SSE配置，返回错误
    res.status(400).json({
      code: 'INVALID_SSE_CONFIG',
      message: 'SSE接口需要配置events数组，格式：{ "events": [{ "event": "message", "data": {...} }] }',
    });
    writeLogSafely({
      apiId: api.id,
      requestMethod: req.method,
      requestPath: stripMockPrefix(req.path),
      requestParams: renderCtx.req.query,
      requestBody: renderCtx.req.body,
      requestHeaders: renderCtx.req.headers,
      responseStatus: 400,
      responseBody: { code: 'INVALID_SSE_CONFIG' },
      responseTime: Date.now() - start,
    });
    return;
  }

  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲

  // 设置自定义响应头（如果有）
  const headers = parseObjectField(api.responseHeaders) as Record<string, string> | null;
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      // 覆盖Content-Type等可能导致问题的头
      if (k.toLowerCase() !== 'content-type' &&
          k.toLowerCase() !== 'cache-control' &&
          k.toLowerCase() !== 'connection') {
        res.setHeader(k, String(v));
      }
    }
  }

  // 发送初始注释（打开连接）
  if (sseConfig.comment) {
    res.write(formatSSEComment(sseConfig.comment));
  }

  const interval = sseConfig.interval ?? 500;
  const events = sseConfig.events;
  let eventIndex = 0;
  let eventsSent = 0;

  // 发送事件的函数
  const sendNextEvent = (): boolean => {
    if (eventIndex >= events.length) {
      if (sseConfig.loop) {
        eventIndex = 0; // 循环模式
      } else {
        return false; // 非循环模式，发送完毕
      }
    }

    const event = events[eventIndex];
    const sseText = formatSSEEvent(event);
    res.write(sseText);
    eventIndex++;
    eventsSent++;
    return true;
  };

  // 处理客户端断开连接
  let clientDisconnected = false;
  req.on('close', () => {
    clientDisconnected = true;
  });

  // 发送第一个事件（减少首字节延迟）
  if (events.length > 0) {
    await applyDelay(api.responseDelay ?? 0, api.responseDelayMax ?? 0);
    sendNextEvent();
  }

  // 继续发送剩余事件
  if (events.length > 1 || sseConfig.loop) {
    const sendLoop = async () => {
      // 等待间隔后再发送下一个事件
      while (!clientDisconnected) {
        await new Promise((resolve) => setTimeout(resolve, interval));
        const hasMore = sendNextEvent();
        if (!hasMore) break;
      }

      // 发送完毕，关闭连接
      if (!clientDisconnected) {
        res.end();
      }

      // 写日志
      writeLogSafely({
        apiId: api.id,
        requestMethod: req.method,
        requestPath: stripMockPrefix(req.path),
        requestParams: renderCtx.req.query,
        requestBody: renderCtx.req.body,
        requestHeaders: renderCtx.req.headers,
        responseStatus: 200,
        responseBody: { eventsSent, format: 'sse' },
        responseTime: Date.now() - start,
      });
    };

    // 异步执行事件发送循环，不阻塞请求处理
    sendLoop().catch((err) => {
      logger.error({ err }, 'SSE send loop failed');
      if (!clientDisconnected && !res.writableEnded) {
        res.end();
      }
    });
  } else {
    // 只有一个事件，发送完毕后关闭
    res.end();
    writeLogSafely({
      apiId: api.id,
      requestMethod: req.method,
      requestPath: stripMockPrefix(req.path),
      requestParams: renderCtx.req.query,
      requestBody: renderCtx.req.body,
      requestHeaders: renderCtx.req.headers,
      responseStatus: 200,
      responseBody: { eventsSent: 1, format: 'sse' },
      responseTime: Date.now() - start,
    });
  }
}

/**
 * 处理普通HTTP响应
 */
async function handleHTTPResponse(
  req: Request,
  res: Response,
  api: MockApi,
  renderCtx: ResponseContext,
  start: number,
): Promise<void> {
  const responseBody = parseResponseBody(api.responseBody);
  const rendered = renderTemplate(responseBody, renderCtx);

  // 设置 headers
  const headers = parseObjectField(api.responseHeaders) as Record<string, string> | null;
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      res.setHeader(k, String(v));
    }
  }
  res.setHeader('Content-Type', api.responseContentType ?? 'application/json');

  // 应用延迟
  await applyDelay(api.responseDelay ?? 0, api.responseDelayMax ?? 0);

  // 写响应
  res.status(api.responseStatus ?? 200).send(rendered);

  // 写日志
  writeLogSafely({
    apiId: api.id,
    requestMethod: req.method,
    requestPath: stripMockPrefix(req.path),
    requestParams: renderCtx.req.query,
    requestBody: renderCtx.req.body,
    requestHeaders: renderCtx.req.headers,
    responseStatus: api.responseStatus ?? 200,
    responseBody: rendered,
    responseTime: Date.now() - start,
  });
}

function stripMockPrefix(p: string): string {
  // app.use('/mock', ...) 已自动剥 /mock 前缀，req.path 已是相对路径
  // 若仍包含 /mock（边界 case），再做一次兜底
  if (p.startsWith('/mock')) return p.slice(4) || '/';
  return p;
}

function parseResponseBody(raw: unknown): unknown {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

function parseValidationRules(raw: unknown): import('../db/schema.js').ValidationRules {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as import('../db/schema.js').ValidationRules;
    } catch {
      return {};
    }
  }
  return raw as import('../db/schema.js').ValidationRules;
}

function sendNotFound(res: Response, method: string, path: string): void {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `No mock matched ${method} ${path}`,
  });
}

function unwrapResult(r: ReturnType<typeof execute>): unknown {
  if (r.kind === 'rows') return r.rows;
  if (r.kind === 'row') return r.row;
  return { affected: r.affected };
}

/** 把 path 参数填进 dataWhere，构造运行时 where */
function buildRuntimeWhere(api: MockApi, ctx: ReturnType<typeof extractContext>): Record<string, unknown> {
  const base = (parseObjectField(api.dataWhere) as Record<string, unknown> | null) ?? {};
  // path 参数优先级最高（用于 /face/:id 这种按 id 查询）
  const merged: Record<string, unknown> = { ...ctx.path, ...base };
  return merged;
}

function parseObjectField(raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

type LogPayload = {
  apiId: number | null;
  requestMethod: string;
  requestPath: string;
  requestParams: unknown;
  requestBody: unknown;
  requestHeaders: Record<string, string>;
  responseStatus: number;
  responseBody: unknown;
  responseTime: number;
};

function writeLogSafely(payload: LogPayload): void {
  try {
    const db = getDb();
    db.insert(requestLogs)
      .values({
        apiId: payload.apiId,
        requestMethod: payload.requestMethod,
        requestPath: payload.requestPath,
        requestParams: payload.requestParams as never,
        requestBody: payload.requestBody as never,
        requestHeaders: payload.requestHeaders as never,
        responseStatus: payload.responseStatus,
        responseBody: serializeForLog(payload.responseBody),
        responseTime: payload.responseTime,
      })
      .run();
  } catch (err) {
    // 日志失败绝不影响业务
    logger.warn({ err }, 'failed to write request log');
  }
}

function serializeForLog(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function sanitizeHeaders(
  h: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (v === undefined) continue;
    out[k] = Array.isArray(v) ? v.join(', ') : v;
  }
  return out;
}