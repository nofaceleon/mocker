import axios, { type AxiosResponse } from 'axios';
import { EventEmitter } from 'node:events';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import {
  callbackConfigs,
  callbackTasks,
  type CallbackAttemptLog,
  type CallbackConfig,
  type CallbackTask,
} from '../../db/schema.js';
import { logger } from '../../utils/logger.js';
import { renderTemplate } from './callback-template.js';

/** 内部事件总线：engine 投递任务事件，scheduler 订阅 */
export const callbackEvents = new EventEmitter();

/** 入参：handler 触发时构造，渲染后的最终值都已生成 */
export type EnqueueTaskInput = {
  apiId: number;
  callbackConfigId: number;
  requestId?: string | null;
  callbackUrl: string; // 已渲染
  callbackMethod: string;
  callbackHeaders: Record<string, string>; // 已渲染
  callbackBody: string | null; // 已渲染
  delayMs: number;
  maxRetries: number;
  retryStrategy: 'fixed' | 'exponential';
  retryInterval: number;
  retryCondition: BuiltinRetryCondition | { kind: 'custom'; expr: string };
  /**
   * 渲染上下文（原始 API 调用的 req/response），用于多回调链推进时
   * 后续节点继续沿用同一上下文做模板替换。
   */
  templateContext?: Record<string, unknown> | null;
};

export type BuiltinRetryCondition = 'always' | 'server_error' | 'success_only';

/** delayType='fixed'|'random' + delayValue="5000"|"3000-8000" → 毫秒 */
export function resolveDelayMs(
  delayType: 'fixed' | 'random',
  delayValue: string,
): number {
  const raw = (delayValue ?? '').trim();
  if (!raw) return 0;
  if (delayType === 'random') {
    const m = raw.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const min = Math.max(0, Number(m[1]));
      const max = Math.max(min, Number(m[2]));
      return Math.round(min + Math.random() * (max - min));
    }
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** 创建一条待发回调任务并落库 */
export function enqueueCallbackTask(input: EnqueueTaskInput): CallbackTask | null {
  try {
    const db = getDb();
    const scheduledAt = new Date(Date.now() + Math.max(0, input.delayMs));
    const [row] = db
      .insert(callbackTasks)
      .values({
        apiId: input.apiId,
        callbackConfigId: input.callbackConfigId,
        requestId: input.requestId ?? null,
        callbackUrl: input.callbackUrl,
        callbackMethod: input.callbackMethod,
        callbackHeaders: input.callbackHeaders,
        callbackBody: input.callbackBody,
        status: 'pending',
        retryCount: 0,
        maxRetries: Math.max(0, input.maxRetries),
        scheduledAt,
        responseStatus: null,
        responseBody: null,
        errorMessage: null,
        attemptLogs: [],
        sentAt: null,
        nextRetryAt: null,
        templateContext: input.templateContext ?? null,
      })
      .returning()
      .all();
    logger.info(
      { taskId: row.id, apiId: input.apiId, delayMs: input.delayMs, url: input.callbackUrl },
      'callback task enqueued',
    );
    return row;
  } catch (err) {
    logger.error({ err }, 'failed to enqueue callback task');
    return null;
  }
}

/** 把 callback config 渲染到最终入队参数（替换 {{req.x}} 和 {{response.x}} 等） */
export function renderCallbackEnqueueInput(
  cfg: CallbackConfig,
  ctx: { req: Record<string, unknown>; response: unknown },
): EnqueueTaskInput | null {
  if (!cfg.callbackUrl) return null;
  const renderedUrl = renderStringSafe(cfg.callbackUrl, ctx);
  if (!renderedUrl) return null;
  const renderedMethod = (cfg.callbackMethod || 'POST').toUpperCase();
  const headersTemplate = (cfg.callbackHeaders ?? {}) as Record<string, string>;
  const renderedHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headersTemplate)) {
    const rv = renderStringSafe(String(v), ctx);
    renderedHeaders[k] = rv ?? '';
  }
  const renderedBody = cfg.callbackBody ? (renderStringSafe(cfg.callbackBody, ctx) ?? null) : null;

  const delayMs = resolveDelayMs(cfg.delayType, cfg.delayValue);
  const cond = parseRetryCondition(cfg.retryCondition);

  return {
    apiId: cfg.apiId,
    callbackConfigId: cfg.id,
    callbackUrl: renderedUrl,
    callbackMethod: renderedMethod,
    callbackHeaders: renderedHeaders,
    callbackBody: renderedBody,
    delayMs,
    maxRetries: cfg.maxRetries,
    retryStrategy: cfg.retryStrategy,
    retryInterval: cfg.retryInterval,
    retryCondition: cond,
    templateContext: { req: ctx.req, response: ctx.response },
  };
}

function renderStringSafe(input: string, ctx: { req: Record<string, unknown>; response: unknown }): string | null {
  try {
    const out = renderStringAny(input, ctx);
    if (out === null || out === undefined) return null;
    if (typeof out === 'string') return out;
    try {
      return JSON.stringify(out);
    } catch {
      return String(out);
    }
  } catch (err) {
    logger.warn({ err, input }, 'failed to render callback template');
    return null;
  }
}

/** 调用回调模板的"整段单一模板返回原类型"语义；其余返回字符串 */
function renderStringAny(input: string, ctx: { req: Record<string, unknown>; response: unknown }): unknown {
  const single = /^\{\{\s*([^{}]+?)\s*\}\}$/.exec(input);
  const tctx = { req: ctx.req, response: ctx.response };
  if (single) {
    const out = renderTemplate(input, tctx);
    return out;
  }
  return renderTemplate(input, tctx);
}

/** 把 DB retry_condition 字段解析为内部条件对象 */
export function parseRetryCondition(
  raw: string | null | undefined,
): BuiltinRetryCondition | { kind: 'custom'; expr: string } {
  const v = (raw ?? '').trim();
  if (!v || v === 'server_error') return 'server_error';
  if (v === 'always') return 'always';
  if (v === 'success_only') return 'success_only';
  // 自定义：约定为 JSON 字符串，形如 {"kind":"custom","expr":"statusCode != 200"}
  if (v.startsWith('{')) {
    try {
      const obj = JSON.parse(v) as { kind?: string; expr?: string };
      if (obj.kind === 'custom' && typeof obj.expr === 'string') return { kind: 'custom', expr: obj.expr };
    } catch {
      // ignore
    }
  }
  return 'server_error';
}

/** 重试触发判定 */
export function shouldRetry(
  cond: BuiltinRetryCondition | { kind: 'custom'; expr: string },
  status: number | null,
  networkError: boolean,
): boolean {
  if (networkError) return cond !== 'success_only';
  if (status === null) return false;
  if (cond === 'always') return status < 200 || status >= 300;
  if (cond === 'success_only') return status >= 200 && status < 300 ? false : true; // 即只在成功时不重试（其它都重试）
  if (cond === 'server_error') return status >= 500;
  // custom
  try {
    const fn = new Function('statusCode', `return (${cond.expr});`);
    return Boolean(fn(status));
  } catch (err) {
    logger.warn({ err, expr: cond.expr }, 'invalid retry_condition expr, fallback to server_error');
    return status >= 500;
  }
}

/** 执行单个任务（发送请求 + 落结果 + 按需入队下一次重试） */
export async function executeTask(task: CallbackTask, cfg: CallbackConfig | null): Promise<void> {
  const db = getDb();
  let status: number | null = null;
  let responseBody: string | null = null;
  let networkError: string | null = null;

  try {
    const resp = await sendCallback(task);
    status = resp.status;
    responseBody = await readBody(resp);
  } catch (err) {
    networkError = err instanceof Error ? err.message : String(err);
    logger.warn({ err, taskId: task.id }, 'callback request failed');
  }

  const retryCfg = cfg
    ? parseRetryCondition(cfg.retryCondition)
    : 'server_error';

  const willRetry =
    cfg?.retryEnabled && task.retryCount < task.maxRetries && shouldRetry(retryCfg, status, networkError !== null);

  const now = new Date();
  const prevLogs = parseAttemptLogs(task.attemptLogs);
  const attemptNo = prevLogs.length + 1;
  const success = status !== null && status >= 200 && status < 300 && !networkError;
  const attempt: CallbackAttemptLog = {
    attempt: attemptNo,
    at: now.toISOString(),
    request: {
      url: task.callbackUrl,
      method: task.callbackMethod,
      headers: task.callbackHeaders ?? null,
      body: task.callbackBody ?? null,
    },
    responseStatus: status,
    responseBody,
    errorMessage: networkError,
    outcome: willRetry ? 'will_retry' : success ? 'success' : 'failed',
  };
  const attemptLogs = [...prevLogs, attempt];

  if (willRetry) {
    const nextInterval =
      cfg!.retryStrategy === 'exponential'
        ? cfg!.retryInterval * Math.pow(2, task.retryCount)
        : cfg!.retryInterval;
    const nextAt = new Date(now.getTime() + Math.max(0, nextInterval));
    db.update(callbackTasks)
      .set({
        retryCount: task.retryCount + 1,
        responseStatus: status,
        responseBody: responseBody,
        errorMessage: networkError,
        attemptLogs,
        nextRetryAt: nextAt,
        scheduledAt: nextAt,
        status: 'pending',
      })
      .where(eq(callbackTasks.id, task.id))
      .run();
    logger.info({ taskId: task.id, retryCount: task.retryCount + 1, nextAt }, 'callback scheduled for retry');
    callbackEvents.emit('retry:scheduled', task.id);
    return;
  }

  const finalStatus: 'sent' | 'failed' = success ? 'sent' : 'failed';
  db.update(callbackTasks)
    .set({
      responseStatus: status,
      responseBody: responseBody,
      errorMessage: networkError,
      attemptLogs,
      status: finalStatus,
      sentAt: now,
      nextRetryAt: null,
    })
    .where(eq(callbackTasks.id, task.id))
    .run();

  logger.info(
    { taskId: task.id, status: finalStatus, responseStatus: status, attempts: attemptLogs.length },
    'callback task finished',
  );

  // 链推进：当前任务进入终态后通知 scheduler 找下一条
  callbackEvents.emit('task:finished', {
    taskId: task.id,
    apiId: task.apiId,
    callbackConfigId: task.callbackConfigId,
  });
}

function parseAttemptLogs(raw: unknown): CallbackAttemptLog[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as CallbackAttemptLog[];
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? (v as CallbackAttemptLog[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function sendCallback(task: CallbackTask): Promise<AxiosResponse> {
  const headers: Record<string, string> = { ...(task.callbackHeaders ?? {}) };
  const method = (task.callbackMethod || 'POST').toLowerCase();
  const data = task.callbackBody ?? undefined;
  const isJson = headers['Content-Type']?.toLowerCase().includes('json') || headers['content-type']?.toLowerCase().includes('json');
  if (data && method !== 'get' && method !== 'head' && isJson) {
    try {
      const parsed = JSON.parse(data);
      return await axios.request({
        url: task.callbackUrl,
        method,
        headers,
        data: parsed,
        timeout: 30_000,
        validateStatus: () => true,
      });
    } catch {
      // 回落到原始字符串
    }
  }
  return axios.request({
    url: task.callbackUrl,
    method,
    headers,
    data,
    timeout: 30_000,
    validateStatus: () => true,
  });
}

async function readBody(resp: AxiosResponse): Promise<string> {
  const data = resp.data;
  if (data === undefined || data === null) return '';
  if (typeof data === 'string') return data.slice(0, 10_000);
  try {
    return JSON.stringify(data).slice(0, 10_000);
  } catch {
    return String(data).slice(0, 10_000);
  }
}

/** 通过 id 把任务重新标记为 pending 并立即执行（用于手动重发） */
export async function reExecute(taskId: number): Promise<void> {
  const db = getDb();
  const task = db.select().from(callbackTasks).where(eq(callbackTasks.id, taskId)).get();
  if (!task) throw new Error(`callback task ${taskId} not found`);
  // 手动重发：保留历史 attemptLogs，从新一轮尝试继续追加
  db.update(callbackTasks)
    .set({
      status: 'pending',
      retryCount: 0,
      scheduledAt: new Date(),
      responseStatus: null,
      responseBody: null,
      errorMessage: null,
      nextRetryAt: null,
    })
    .where(eq(callbackTasks.id, taskId))
    .run();
  // 取出最新行执行
  const fresh = db.select().from(callbackTasks).where(eq(callbackTasks.id, taskId)).get();
  if (!fresh) return;
  const cfg = db.select().from(callbackConfigs).where(eq(callbackConfigs.apiId, fresh.apiId)).get() ?? null;
  await executeTask(fresh, cfg);
}

/** 把 pending 任务标记为 failed（手动取消） */
export function cancelTask(taskId: number): boolean {
  const db = getDb();
  const r = db
    .update(callbackTasks)
    .set({ status: 'failed', errorMessage: 'cancelled by user', nextRetryAt: null })
    .where(eq(callbackTasks.id, taskId))
    .run();
  return r.changes > 0;
}
