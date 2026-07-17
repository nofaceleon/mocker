import vm from 'node:vm';
import { logger } from '../utils/logger.js';
import { execute, type WhereClause } from './db-ops.js';
import { ensureBusinessTable } from './schema-manager.js';
import type { RequestContext } from './request.js';

const DEFAULT_TIMEOUT_MS = 2000;

export type ScriptLogEntry = {
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
  at: number;
};

export type ScriptReq = {
  body: Record<string, unknown>;
  query: Record<string, unknown>;
  path: Record<string, string>;
  params: Record<string, string>;
  headers: Record<string, string>;
  method: string;
  url: string;
};

export type ScriptDbApi = {
  insert: (table: string, data: Record<string, unknown>) => unknown;
  select: (table: string, where?: WhereClause) => unknown[];
  update: (
    table: string,
    where: WhereClause,
    patch: Record<string, unknown>,
  ) => { affected: number };
  delete: (table: string, where?: WhereClause) => { affected: number };
};

export type ScriptRunInput = {
  code: string;
  req: RequestContext;
  dbResult?: unknown;
  timeoutMs?: number;
};

export type ScriptRunResult = {
  value: unknown;
  logs: ScriptLogEntry[];
  durationMs: number;
};

export class ScriptError extends Error {
  readonly code = 'SCRIPT_ERROR';
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ScriptError';
  }
}

/** 供脚本使用的 db 对象（同步，better-sqlite3） */
export function createScriptDbApi(): ScriptDbApi {
  return {
    insert(table: string, data: Record<string, unknown>) {
      const row = data ?? {};
      if (Object.keys(row).length === 0) {
        throw new Error('db.insert requires non-empty data');
      }
      ensureBusinessTable(table, row);
      const r = execute('insert', table, row, {});
      return r.kind === 'row' ? r.row : { affected: r.kind === 'affected' ? r.affected : 0 };
    },
    select(table: string, where: WhereClause = {}) {
      const r = execute('select', table, undefined, where ?? {});
      return r.kind === 'rows' ? r.rows : [];
    },
    update(table: string, where: WhereClause, patch: Record<string, unknown>) {
      const r = execute('update', table, patch ?? {}, where ?? {});
      return { affected: r.kind === 'affected' ? r.affected : 0 };
    },
    delete(table: string, where: WhereClause = {}) {
      const r = execute('delete', table, undefined, where ?? {});
      return { affected: r.kind === 'affected' ? r.affected : 0 };
    },
  };
}

function buildScriptReq(req: RequestContext): ScriptReq {
  return {
    body: req.body ?? {},
    query: req.query ?? {},
    path: req.path ?? {},
    params: req.path ?? {},
    headers: req.headers ?? {},
    method: req.raw.method,
    url: req.raw.url,
  };
}

function createLogApi(logs: ScriptLogEntry[]) {
  const push = (level: ScriptLogEntry['level'], message: unknown, data?: unknown) => {
    logs.push({
      level,
      message: typeof message === 'string' ? message : safeString(message),
      data,
      at: Date.now(),
    });
  };
  return {
    info: (message: unknown, data?: unknown) => push('info', message, data),
    warn: (message: unknown, data?: unknown) => push('warn', message, data),
    error: (message: unknown, data?: unknown) => push('error', message, data),
  };
}

/**
 * 在受限 vm 沙箱中执行用户脚本。
 * 约定：脚本定义 `async function handle(req, db, log)` 或 `function handle(req, db, log)`，
 * 返回值作为响应体；返回 undefined 则继续走 responseBody 模板。
 */
export async function runScript(input: ScriptRunInput): Promise<ScriptRunResult> {
  const code = input.code?.trim();
  if (!code) {
    return { value: undefined, logs: [], durationMs: 0 };
  }

  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const logs: ScriptLogEntry[] = [];
  const started = Date.now();
  const db = createScriptDbApi();
  const log = createLogApi(logs);
  const req = buildScriptReq(input.req);

  const sandbox: Record<string, unknown> = {
    req,
    db,
    log,
    dbResult: input.dbResult,
    console: {
      log: (...args: unknown[]) => log.info(args.map(safeString).join(' ')),
      info: (...args: unknown[]) => log.info(args.map(safeString).join(' ')),
      warn: (...args: unknown[]) => log.warn(args.map(safeString).join(' ')),
      error: (...args: unknown[]) => log.error(args.map(safeString).join(' ')),
    },
    JSON,
    Date,
    Math,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Error,
    Map,
    Set,
    RegExp,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    Promise,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };

  const context = vm.createContext(sandbox, {
    name: 'mockhub-script',
    codeGeneration: { strings: false, wasm: false },
  });

  const wrapped = `${code}
;
(async function __mockhub_run() {
  if (typeof handle !== 'function') {
    throw new Error('脚本必须定义 function handle(req, db, log) 或 async function handle(req, db, log)');
  }
  return await handle(req, db, log);
})()`;

  let script: vm.Script;
  try {
    script = new vm.Script(wrapped, { filename: 'mock-api-script.js' });
  } catch (err) {
    throw new ScriptError(
      err instanceof Error ? `脚本语法错误: ${err.message}` : '脚本语法错误',
      err,
    );
  }

  try {
    const runPromise = Promise.resolve(
      script.runInContext(context, {
        timeout: timeoutMs,
        displayErrors: true,
        breakOnSigint: true,
      }) as unknown,
    );

    const value = await Promise.race([
      runPromise,
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new ScriptError(`脚本执行超时（>${timeoutMs}ms）`)),
          timeoutMs + 50,
        );
      }),
    ]);

    return { value, logs, durationMs: Date.now() - started };
  } catch (err) {
    if (err instanceof ScriptError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err, durationMs: Date.now() - started }, 'script execution failed');
    throw new ScriptError(msg, err);
  }
}

function safeString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return v.message;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
