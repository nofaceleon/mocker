import type { MockApi } from '../db/schema.js';
import { compileRoute, ROUTE_PRECISION, type CompiledRoute, type RoutePrecision } from './router.js';

export type MatchedApi = {
  api: MockApi;
  match: RegExpMatchArray;
  params: Record<string, string>;
};

type Candidate = {
  api: MockApi;
  compiled: CompiledRoute;
};

/**
 * 匹配单个 API：method 必须命中，path 正则必须命中。
 * 返回 null 或 MatchedApi。
 */
export function matchSingle(candidate: Candidate, method: string, path: string): MatchedApi | null {
  if (!candidate.api.isEnabled) return null;
  if (candidate.api.method !== method) return null;

  const m = candidate.compiled.regex.exec(path);
  if (!m) return null;

  const params: Record<string, string> = {};
  candidate.compiled.paramNames.forEach((name, idx) => {
    const value = m[idx + 1];
    if (value !== undefined) params[name] = decodeURIComponent(value);
  });

  return { api: candidate.api, match: m, params };
}

/**
 * 从一组候选中选出最佳匹配。
 *
 * 排序规则（优先级从高到低）：
 *  1. 路由精度（exact > parametric > wildcard）
 *  2. 用户定义的 sort_order 升序
 *  3. 数据库 id 升序（稳定排序）
 */
export function matchBest(method: string, path: string, candidates: Candidate[]): MatchedApi | null {
  const hits: MatchedApi[] = [];
  for (const c of candidates) {
    const m = matchSingle(c, method, path);
    if (m) hits.push(m);
  }

  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0];

  hits.sort((a, b) => {
    const pa = a.api.id ? precisionOf(a.api.path) : ROUTE_PRECISION.EXACT;
    const pb = b.api.id ? precisionOf(b.api.path) : ROUTE_PRECISION.EXACT;
    if (pa !== pb) return pa - pb;
    if (a.api.sortOrder !== b.api.sortOrder) return a.api.sortOrder - b.api.sortOrder;
    return a.api.id - b.api.id;
  });
  return hits[0];
}

function precisionOf(path: string): RoutePrecision {
  if (path.includes('*')) return ROUTE_PRECISION.WILDCARD;
  if (path.includes(':')) return ROUTE_PRECISION.PARAMETRIC;
  return ROUTE_PRECISION.EXACT;
}

export type { Candidate };