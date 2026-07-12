import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { requestLogs, callbackConfigs, type MockApi } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { matchBest, type Candidate } from './matcher.js';
import { registry } from './registry.js';
import { extractContext, type RequestContext } from './request.js';
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
import { runScript, ScriptError } from './script-runtime.js';
import { callbackScheduler } from './callback/callback-scheduler.js';
import { enqueueCallbackTask, renderCallbackEnqueueInput } from './callback/callback-engine.js';

const MAX_LOG_BODY_SIZE = 32 * 1024;

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
  const meta = extractRequestMeta(req);

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
        clientIp: meta.clientIp,
        requestId: meta.requestId,
        format: 'http',
      });
      return;
    }

    await executeMatched(req, res, matched.api, matched.params, start, meta);
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
  meta: RequestMeta,
): Promise<void> {
  // 1. 提取参数
  const reqCtx = extractContext(req, pathParams);

  // 2. 校验
  const rules = parseValidationRules(api.validationRules);
  const valid = rules.isEnabled === false
    ? { ok: true as const }
    : validate(rules, reqCtx as unknown as Record<string, unknown>);
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
      clientIp: meta.clientIp,
      requestId: meta.requestId,
      format: 'http',
    });
    return;
  }

  // 3. 执行数据联动（如果有）
  let dbResult: unknown;
  if (api.dataOp !== 'none' && api.dataTable) {
    const where = buildRuntimeWhere(api, reqCtx);

    if (api.dataOp === 'insert') {
      const row = resolveDataPayload(api, reqCtx, 'insert');
      if (Object.keys(row).length === 0) {
        throw new Error('insert 需要非空写入数据：配置 dataPayload 模板，或在请求 body 中传字段');
      }
      ensureBusinessTable(api.dataTable, row);
      dbResult = unwrapResult(execute('insert', api.dataTable, row, {}));
    } else if (api.dataOp === 'update') {
      const patch = resolveDataPayload(api, reqCtx, 'update');
      dbResult = unwrapResult(execute('update', api.dataTable, patch, where));
    } else if (api.dataOp === 'select') {
      dbResult = unwrapResult(execute('select', api.dataTable, undefined, where));
    } else if (api.dataOp === 'delete') {
      dbResult = unwrapResult(execute('delete', api.dataTable, undefined, where));
    }
  }

  // 4. 自定义脚本（可选）：返回值覆盖响应体；undefined 则继续走 responseBody 模板
  let scriptResult: unknown = undefined;
  let scriptOverride = false;
  if (api.script && api.script.trim()) {
    try {
      const run = await runScript({ code: api.script, req: reqCtx, dbResult });
      if (run.value !== undefined) {
        scriptResult = run.value;
        scriptOverride = true;
      }
    } catch (err) {
      const message =
        err instanceof ScriptError
          ? err.message
          : err instanceof Error
            ? err.message
            : '脚本执行失败';
      const body = { code: 'SCRIPT_ERROR', message };
      res.status(500).json(body);
      writeLogSafely({
        apiId: api.id,
        requestMethod: req.method,
        requestPath: stripMockPrefix(req.path),
        requestParams: reqCtx.query,
        requestBody: reqCtx.body,
        requestHeaders: reqCtx.headers,
        responseStatus: 500,
        responseBody: body,
        responseTime: Date.now() - start,
        clientIp: meta.clientIp,
        requestId: meta.requestId,
        format: 'http',
      });
      return;
    }
  }

  // 5. 构建渲染上下文
  const renderCtx: ResponseContext = {
    req: reqCtx,
    dbResult,
    response: scriptOverride ? scriptResult : undefined,
  };

  // 6. 判断是否为SSE请求（根据protocol字段）
  if (api.protocol === 'SSE') {
    await handleSSERequest(req, res, api, renderCtx, start, meta, scriptOverride ? scriptResult : undefined);
    return;
  }

  // 7. 普通HTTP响应
  await handleHTTPResponse(req, res, api, renderCtx, start, meta, scriptOverride ? scriptResult : undefined);
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
  meta: RequestMeta,
  scriptBody?: unknown,
): Promise<void> {
  const responseBody =
    scriptBody !== undefined ? scriptBody : parseResponseBody(api.responseBody);
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
      clientIp: meta.clientIp,
      requestId: meta.requestId,
      format: 'sse',
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

  // 立即发送响应头，不等待缓冲
  res.flushHeaders();

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
        clientIp: meta.clientIp,
        requestId: meta.requestId,
        format: 'sse',
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
    // 只有一个事件，等待一小段时间后再关闭（确保客户端能接收到）
    setTimeout(() => {
      if (!clientDisconnected) {
        res.end();
      }
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
        clientIp: meta.clientIp,
        requestId: meta.requestId,
        format: 'sse',
      });
    }, 100);
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
  meta: RequestMeta,
  scriptBody?: unknown,
): Promise<void> {
  // 脚本有返回值时直接作为响应体；否则渲染 responseBody 模板
  const rendered =
    scriptBody !== undefined
      ? scriptBody
      : renderTemplate(parseResponseBody(api.responseBody), renderCtx);

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
    clientIp: meta.clientIp,
    requestId: meta.requestId,
    format: 'http',
  });

  // 响应已落盘后再入队回调（不影响主链路时延）
  scheduleCallback(api, renderCtx.req, rendered);
}

function stripMockPrefix(p: string): string {
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

/** 把 path 参数和 query 参数填进 dataWhere，构造运行时 where */
function buildRuntimeWhere(api: MockApi, ctx: ReturnType<typeof extractContext>): Record<string, unknown> {
  const base = (parseObjectField(api.dataWhere) as Record<string, unknown> | null) ?? {};
  // 优先级：用户配置的 dataWhere > query 参数 > 路径参数
  const merged: Record<string, unknown> = { ...ctx.path, ...ctx.query, ...base };
  return merged;
}

/**
 * insert/update 写入数据：
 * - 若配置了 dataPayload 模板（非空对象），用 {{req.body.x}} 等渲染后作为写入行
 * - 否则回退为整包请求 body
 */
function resolveDataPayload(
  api: MockApi,
  ctx: ReturnType<typeof extractContext>,
  _mode: 'insert' | 'update',
): Record<string, unknown> {
  const template = parseObjectField(
    (api as MockApi & { dataPayload?: unknown }).dataPayload,
  ) as Record<string, unknown> | null;
  if (template && typeof template === 'object' && !Array.isArray(template) && Object.keys(template).length > 0) {
    const rendered = renderTemplate(template, { req: ctx });
    if (rendered && typeof rendered === 'object' && !Array.isArray(rendered)) {
      // 去掉模板未解析到的 undefined 字段
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rendered as Record<string, unknown>)) {
        if (v !== undefined) out[k] = v;
      }
      return out;
    }
  }
  return (ctx.body ?? {}) as Record<string, unknown>;
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
  clientIp: string;
  requestId: string;
  format: 'http' | 'sse';
};

type RequestMeta = {
  clientIp: string;
  requestId: string;
};

function extractRequestMeta(req: Request): RequestMeta {
  const headerVal = req.headers['x-request-id'];
  const headerId = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  const requestId =
    typeof headerId === 'string' && headerId.trim().length > 0
      ? headerId.trim().slice(0, 64)
      : crypto.randomBytes(8).toString('hex');
  const clientIp =
    (typeof req.ip === 'string' && req.ip) ||
    req.socket?.remoteAddress ||
    'unknown';
  return { clientIp, requestId };
}

function writeLogSafely(payload: LogPayload): void {
  try {
    const db = getDb();
    // drizzle 0.38 的 json mode 字段会再次 JSON.stringify，所以传入前必须先把"已经是 JSON 字符串"的值还原成对象/数组
    // truncateForLog 返回的是已 stringify 的字符串，这里用 JSON.parse 反序列化回去再交给 drizzle
    db.insert(requestLogs)
      .values({
        apiId: payload.apiId,
        requestMethod: payload.requestMethod,
        requestPath: payload.requestPath,
        requestParams: parseJsonBack(truncateForLog(payload.requestParams, false)),
        requestBody: parseJsonBack(truncateForLog(payload.requestBody, false)),
        requestHeaders: payload.requestHeaders ?? {},
        responseStatus: payload.responseStatus,
        responseBody: truncateForLog(payload.responseBody, true),
        responseTime: payload.responseTime,
        clientIp: payload.clientIp,
        requestId: payload.requestId,
        format: payload.format,
      })
      .run();
  } catch (err) {
    // 日志失败绝不影响业务
    logger.warn({ err }, 'failed to write request log');
  }
}

// 把 truncateForLog 产出的"已经是 JSON 字符串"还原成对象/数组，
// 让 drizzle 的 mode:'json' 字段在 mapToDriverValue 中再次 stringify 时只产生一层。
function parseJsonBack(s: string): unknown {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function truncateForLog(v: unknown, asString: true): string;
function truncateForLog(v: unknown, asString: false): string;
function truncateForLog(v: unknown, asString = false): string {
  try {
    const json = JSON.stringify(v);
    if (!json) return '';
    if (json.length > MAX_LOG_BODY_SIZE) {
      const sliced = json.slice(0, MAX_LOG_BODY_SIZE);
      return asString
        ? `${sliced}...<truncated ${json.length - MAX_LOG_BODY_SIZE} bytes>`
        : JSON.stringify({
            __truncated: true,
            preview: sliced,
            originalSize: json.length,
          });
    }
    return json;
  } catch {
    return asString ? String(v) : '';
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

/**
 * 响应写出后，异步入队该接口的回调任务。
 * - 仅普通 HTTP 协议触发（SSE 跳过）
 * - 仅 callback_config.isEnabled 时触发
 * - 任何错误都不应影响主链路
 */
function scheduleCallback(
  api: MockApi,
  reqCtxForTemplate: RequestContext,
  responseBody: unknown,
): void {
  try {
    const db = getDb();
    const cfg = db
      .select()
      .from(callbackConfigs)
      .where(eq(callbackConfigs.apiId, api.id))
      .get();
    if (!cfg || !cfg.isEnabled) return;
    const input = renderCallbackEnqueueInput(cfg, {
      req: reqCtxForTemplate,
      response: responseBody,
    });
    if (!input) {
      logger.warn({ apiId: api.id }, 'callback config enabled but url rendered empty, skip');
      return;
    }
    const task = enqueueCallbackTask({
      ...input,
      apiId: api.id,
      callbackConfigId: cfg.id,
      requestId:
        reqCtxForTemplate.headers['xRequestId'] ??
        reqCtxForTemplate.headers['xrequestid'] ??
        null,
    });
    if (task) callbackScheduler.scheduleExisting(task.id);
  } catch (err) {
    logger.warn({ err, apiId: api.id }, 'scheduleCallback failed');
  }
}