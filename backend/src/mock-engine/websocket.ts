import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { getDb } from '../db/index.js';
import { requestLogs, type MockApi } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { registry } from './registry.js';
import { compileRoute } from './router.js';
import { runScript, ScriptError } from './script-runtime.js';
import type { RequestContext } from './request.js';
import type { Candidate } from './matcher.js';

export type WsConfig = {
  welcome?: unknown;
  echo?: boolean;
  pushInterval?: number;
  pushMessage?: unknown;
  disconnectAfterMs?: number;
};

/**
 * 在 HTTP server 上挂载 WebSocket upgrade 处理。
 * 路径命中 protocol=WebSocket 的 mock 接口后建立连接。
 */
export function attachWebSocketServer(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = url.pathname || '/';
      registry.ensureLoaded();
      const matched = matchWebSocketApi(path, registry.list() as Candidate[]);
      if (!matched) {
        socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req, matched.api, matched.params, url);
      });
    } catch (err) {
      logger.error({ err }, 'websocket upgrade failed');
      socket.destroy();
    }
  });

  wss.on(
    'connection',
    (ws: WebSocket, req: IncomingMessage, api: MockApi, pathParams: Record<string, string>, url: URL) => {
      void handleConnection(ws, req, api, pathParams, url);
    },
  );

  logger.info('WebSocket server attached');
  return wss;
}

function matchWebSocketApi(
  path: string,
  candidates: Candidate[],
): { api: MockApi; params: Record<string, string> } | null {
  const hits: Array<{ api: MockApi; params: Record<string, string>; sortOrder: number; id: number; precision: number }> =
    [];

  for (const c of candidates) {
    if (!c.api.isEnabled || c.api.protocol !== 'WebSocket') continue;
    const compiled = c.compiled ?? compileRoute(c.api.path);
    const m = compiled.regex.exec(path);
    if (!m) continue;
    const params: Record<string, string> = {};
    compiled.paramNames.forEach((name, idx) => {
      const value = m[idx + 1];
      if (value !== undefined) params[name] = decodeURIComponent(value);
    });
    let precision = 0;
    if (c.api.path.includes('*')) precision = 2;
    else if (c.api.path.includes(':')) precision = 1;
    hits.push({ api: c.api, params, sortOrder: c.api.sortOrder, id: c.api.id, precision });
  }

  if (hits.length === 0) return null;
  hits.sort((a, b) => {
    if (a.precision !== b.precision) return a.precision - b.precision;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id - b.id;
  });
  return hits[0];
}

async function handleConnection(
  ws: WebSocket,
  req: IncomingMessage,
  api: MockApi,
  pathParams: Record<string, string>,
  url: URL,
): Promise<void> {
  const start = Date.now();
  const clientIp = req.socket.remoteAddress ?? null;
  const config = parseWsConfig(api.responseBody);
  let closed = false;
  let pushTimer: ReturnType<typeof setInterval> | null = null;
  let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    closed = true;
    if (pushTimer) clearInterval(pushTimer);
    if (disconnectTimer) clearTimeout(disconnectTimer);
  };

  ws.on('close', () => cleanup());
  ws.on('error', (err) => {
    logger.warn({ err, apiId: api.id }, 'websocket error');
    cleanup();
  });

  // 欢迎消息
  if (config.welcome !== undefined && config.welcome !== null) {
    sendJson(ws, config.welcome);
  } else if (api.responseBody != null && typeof api.responseBody !== 'object') {
    ws.send(String(api.responseBody));
  } else if (
    api.responseBody &&
    typeof api.responseBody === 'object' &&
    !('welcome' in (api.responseBody as object)) &&
    !('echo' in (api.responseBody as object))
  ) {
    // 整段 responseBody 作为欢迎消息（简单模式）
    sendJson(ws, api.responseBody);
  }

  // 定时推送
  if (config.pushInterval && config.pushInterval > 0) {
    const payload = config.pushMessage ?? { type: 'push', ts: Date.now() };
    pushTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const msg =
          typeof payload === 'object' && payload !== null
            ? { ...(payload as object), ts: Date.now() }
            : payload;
        sendJson(ws, msg);
      }
    }, config.pushInterval);
  }

  // 模拟断开
  if (config.disconnectAfterMs && config.disconnectAfterMs > 0) {
    disconnectTimer = setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(4000, 'mock disconnect');
      }
    }, config.disconnectAfterMs);
  }

  ws.on('message', (data: RawData) => {
    void onMessage(ws, api, pathParams, url, data, config);
  });

  writeWsLog({
    apiId: api.id,
    requestMethod: 'WS',
    requestPath: url.pathname,
    requestParams: Object.fromEntries(url.searchParams.entries()),
    requestBody: { event: 'open', pathParams },
    requestHeaders: pickHeaders(req),
    responseStatus: 101,
    responseBody: { event: 'connected', welcome: config.welcome ?? null },
    responseTime: Date.now() - start,
    clientIp,
  });
}

async function onMessage(
  ws: WebSocket,
  api: MockApi,
  pathParams: Record<string, string>,
  url: URL,
  data: RawData,
  config: WsConfig,
): Promise<void> {
  const raw = data.toString('utf8');
  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* keep string */
  }

  const reqCtx: RequestContext = {
    path: pathParams,
    query: Object.fromEntries(url.searchParams.entries()),
    originalQuery: Object.fromEntries(url.searchParams.entries()),
    body: (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed
      : { message: parsed }) as Record<string, unknown>,
    headers: {},
    raw: { method: 'WS', path: url.pathname, url: url.pathname + url.search },
  };

  try {
    if (api.script && api.script.trim()) {
      const run = await runScript({ code: api.script, req: reqCtx });
      if (run.value !== undefined && ws.readyState === WebSocket.OPEN) {
        sendJson(ws, run.value);
      }
    } else if (config.echo !== false) {
      // 默认 echo
      if (ws.readyState === WebSocket.OPEN) {
        sendJson(ws, { type: 'echo', data: parsed });
      }
    }
  } catch (err) {
    const message =
      err instanceof ScriptError ? err.message : err instanceof Error ? err.message : 'script error';
    if (ws.readyState === WebSocket.OPEN) {
      sendJson(ws, { type: 'error', code: 'SCRIPT_ERROR', message });
    }
  }

  writeWsLog({
    apiId: api.id,
    requestMethod: 'WS',
    requestPath: url.pathname,
    requestParams: reqCtx.query,
    requestBody: parsed,
    requestHeaders: {},
    responseStatus: 200,
    responseBody: { event: 'message' },
    responseTime: 0,
    clientIp: null,
  });
}

function parseWsConfig(raw: unknown): WsConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { echo: true };
  }
  const o = raw as Record<string, unknown>;
  return {
    welcome: o.welcome,
    echo: o.echo !== false,
    pushInterval: typeof o.pushInterval === 'number' ? o.pushInterval : undefined,
    pushMessage: o.pushMessage,
    disconnectAfterMs: typeof o.disconnectAfterMs === 'number' ? o.disconnectAfterMs : undefined,
  };
}

function sendJson(ws: WebSocket, value: unknown): void {
  if (typeof value === 'string') {
    ws.send(value);
    return;
  }
  try {
    ws.send(JSON.stringify(value));
  } catch {
    ws.send(String(value));
  }
}

function pickHeaders(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    out[k] = Array.isArray(v) ? v.join(', ') : v;
  }
  return out;
}

function writeWsLog(entry: {
  apiId: number | null;
  requestMethod: string;
  requestPath: string;
  requestParams: unknown;
  requestBody: unknown;
  requestHeaders: Record<string, string>;
  responseStatus: number;
  responseBody: unknown;
  responseTime: number;
  clientIp: string | null;
}): void {
  try {
    const db = getDb();
    db.insert(requestLogs)
      .values({
        apiId: entry.apiId,
        requestMethod: entry.requestMethod,
        requestPath: entry.requestPath,
        requestParams: entry.requestParams as never,
        requestBody: entry.requestBody as never,
        requestHeaders: entry.requestHeaders,
        responseStatus: entry.responseStatus,
        responseBody:
          typeof entry.responseBody === 'string'
            ? entry.responseBody
            : JSON.stringify(entry.responseBody),
        responseTime: entry.responseTime,
        clientIp: entry.clientIp,
        requestId: null,
        format: 'websocket',
      })
      .run();
  } catch (err) {
    logger.warn({ err }, 'failed to write websocket log');
  }
}
