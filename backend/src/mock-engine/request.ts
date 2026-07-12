import type { Request } from 'express';
import type { MockApi, ValidationRules } from '../db/schema.js';

/** Mock 引擎内部统一的请求上下文（对模板/脚本暴露） */
export type RequestContext = {
  path: Record<string, string>;
  query: Record<string, unknown>;
  /** 原始 query 参数（key 未转驼峰），用于 SQL where 条件等需要原始列名的场景 */
  originalQuery: Record<string, unknown>;
  body: Record<string, unknown>;
  headers: Record<string, string>;
  raw: { method: string; path: string; url: string };
};

/**
 * 从 Express Request 中提取 Mock 引擎需要的四类参数。
 * path 参数已由 matcher 解析好（matched.params），body 已经 express.json 解析过。
 */
export function extractContext(
  req: Request,
  pathParams: Record<string, string> = {},
): RequestContext {
  return {
    path: pathParams,
    query: normalizeKeys(req.query as Record<string, unknown> | undefined),
    originalQuery: (req.query as Record<string, unknown> | undefined) ?? {},
    body: normalizeKeys(req.body as Record<string, unknown> | undefined),
    headers: pickRelevantHeaders(req.headers as Record<string, string | string[] | undefined>),
    raw: {
      method: req.method,
      path: req.path,
      url: req.originalUrl ?? req.url,
    },
  };
}

/** 把 query/body 中的横杠命名的键转成驼峰，方便 `{{req.body.userName}}` 访问 */
export function normalizeKeys(
  input: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    out[toCamel(k)] = v;
  }
  return out;
}

function toCamel(s: string): string {
  return s.replace(/[-_]([a-zA-Z0-9])/g, (_, c) => c.toUpperCase());
}

function pickRelevantHeaders(
  input: Record<string, string | string[] | undefined> | undefined,
): Record<string, string> {
  if (!input) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    const value = Array.isArray(v) ? v.join(', ') : v;
    out[toCamel(k)] = value;
  }
  return out;
}

/** 根据 api.validationRules 提取各位置规则（默认空） */
export function getValidationRules(api: MockApi): ValidationRules {
  return (api.validationRules as ValidationRules | null) ?? {};
}