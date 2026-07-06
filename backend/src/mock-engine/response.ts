import type { RequestContext } from './request.js';

export type ResponseContext = {
  req: RequestContext;
  dbResult?: unknown;
};

/**
 * 在响应体（可能是 string/number/object/array）上递归替换 {{...}} 模板。
 * 支持：
 *  - {{req.body.userName}} / {{req.query.id}} / {{req.path.id}} / {{req.headers.xToken}}
 *  - {{req.raw.method}}
 *  - {{dbResult}} / {{dbResult.id}} / {{dbResult.0.name}}（数组下标访问）
 *  - 不在 ctx 中的变量原样保留
 */
export function renderTemplate(value: unknown, ctx: ResponseContext): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return renderString(value, ctx);
  if (Array.isArray(value)) return value.map((v) => renderTemplate(v, ctx));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = renderTemplate(v, ctx);
    }
    return out;
  }
  return value;
}

const TEMPLATE_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

function renderString(input: string, ctx: ResponseContext): unknown {
  // 整段就是单一模板 → 返回原始类型（数字/布尔/对象）
  const singleMatch = /^\{\{\s*([^{}]+?)\s*\}\}$/.exec(input);
  if (singleMatch) {
    const v = resolvePath(singleMatch[1].trim(), ctx);
    return v;
  }

  return input.replace(TEMPLATE_RE, (_, expr: string) => {
    const v = resolvePath(expr.trim(), ctx);
    return stringifyForReplacement(v);
  });
}

function stringifyForReplacement(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

/**
 * 解析 "req.body.user.name" 这样的路径，按 "." 分段访问 ctx。
 * 数组下标用 "0"/"1"。
 * 解析失败（路径不存在）返回 undefined（调用方会原样保留模板或返回空字符串）。
 */
function resolvePath(path: string, ctx: ResponseContext): unknown {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return undefined;

  let current: unknown = ctx;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const idx = Number(part);
      if (!Number.isInteger(idx)) return undefined;
      current = current[idx];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * 应用响应延迟。
 *  - delay > 0 且 delayMax > delay：随机延迟 [delay, delayMax]
 *  - 否则固定 delay 毫秒
 */
export function applyDelay(delay: number, delayMax: number): Promise<void> {
  let ms = Math.max(0, delay);
  if (delayMax > delay) {
    ms = delay + Math.random() * (delayMax - delay);
  }
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, Math.round(ms)));
}

// ============= SSE 相关 =============

export type SSEEvent = {
  id?: string;
  event?: string;
  data: unknown;
  retry?: number;
};

export type SSEConfig = {
  events: SSEEvent[];
  interval?: number;       // 事件发送间隔(ms)，默认500
  loop?: boolean;          // 是否循环发送，默认false
  comment?: string;        // 初始注释行（可选）
};

/**
 * 解析SSE配置。
 * responseBody 支持两种格式：
 * 1. SSEConfig对象：{ events: [...], interval: 1000, loop: false }
 * 2. 单个事件对象：{ event: "message", data: "hello" }（自动包装为数组）
 */
export function parseSSEConfig(responseBody: unknown, ctx: ResponseContext): SSEConfig | null {
  if (!responseBody || typeof responseBody !== 'object') return null;

  const body = responseBody as Record<string, unknown>;

  // 格式1：完整的SSEConfig
  if (Array.isArray(body.events)) {
    const events = body.events.map((e: unknown) => renderTemplate(e, ctx) as SSEEvent);
    return {
      events,
      interval: typeof body.interval === 'number' ? body.interval : 500,
      loop: body.loop === true,
      comment: typeof body.comment === 'string' ? body.comment : undefined,
    };
  }

  // 格式2：单个事件（兼容简单配置）
  if ('data' in body || 'event' in body) {
    return {
      events: [renderTemplate(body, ctx) as SSEEvent],
      interval: 500,
      loop: false,
    };
  }

  return null;
}

/**
 * 将SSE事件格式化为标准SSE文本格式。
 * 格式：https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
 */
export function formatSSEEvent(event: SSEEvent): string {
  const lines: string[] = [];

  if (event.id) {
    lines.push(`id: ${event.id}`);
  }
  if (event.event) {
    lines.push(`event: ${event.event}`);
  }

  // data 可以是多行
  const dataStr = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
  for (const line of dataStr.split('\n')) {
    lines.push(`data: ${line}`);
  }

  if (event.retry) {
    lines.push(`retry: ${event.retry}`);
  }

  // 事件以空行结尾
  return lines.join('\n') + '\n\n';
}

/**
 * 格式化SSE注释
 */
export function formatSSEComment(comment: string): string {
  return `: ${comment}\n\n`;
}