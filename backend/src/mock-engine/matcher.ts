import type { MockApi } from '../db/schema.js';
import { compileRoute, ROUTE_PRECISION, type CompiledRoute, type RoutePrecision } from './router.js';

export type MatchedApi = {
  api: MockApi;
  match: RegExpMatchArray;
  params: Record<string, string>;
};

/** method + path 模板完全相同的冲突接口摘要 */
export type RouteConflictApi = {
  id: number;
  name: string;
  method: string;
  path: string;
};

export type RouteConflict = {
  message: string;
  /** 含当前命中接口在内的全部冲突接口 */
  apis: RouteConflictApi[];
  /** 实际命中的接口 id */
  winnerId: number;
};

export type MatchBestResult = {
  matched: MatchedApi;
  /** method+path 与命中接口完全相同的其它启用接口（不含命中自身） */
  exactPathConflicts: RouteConflictApi[];
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
export function matchBest(
  method: string,
  path: string,
  candidates: Candidate[],
): MatchBestResult | null {
  const hits: MatchedApi[] = [];
  for (const c of candidates) {
    const m = matchSingle(c, method, path);
    if (m) hits.push(m);
  }

  if (hits.length === 0) return null;

  hits.sort((a, b) => {
    const pa = a.api.id ? precisionOf(a.api.path) : ROUTE_PRECISION.EXACT;
    const pb = b.api.id ? precisionOf(b.api.path) : ROUTE_PRECISION.EXACT;
    if (pa !== pb) return pa - pb;
    if (a.api.sortOrder !== b.api.sortOrder) return a.api.sortOrder - b.api.sortOrder;
    return a.api.id - b.api.id;
  });

  const matched = hits[0];
  const exactPathConflicts = hits
    .filter(
      (h) =>
        h.api.id !== matched.api.id &&
        h.api.method === matched.api.method &&
        h.api.path === matched.api.path,
    )
    .map((h) => toConflictApi(h.api));

  return { matched, exactPathConflicts };
}

/** 查找与指定 method+path 模板完全相同的其它启用接口 */
export function findExactPathConflicts(
  method: string,
  path: string,
  candidates: Candidate[],
  excludeId?: number,
): RouteConflictApi[] {
  return candidates
    .filter(
      (c) =>
        c.api.isEnabled &&
        c.api.method === method &&
        c.api.path === path &&
        c.api.id !== excludeId,
    )
    .map((c) => toConflictApi(c.api));
}

/**
 * @param current 当前执行的接口
 * @param others 同 method+path 的其它启用接口
 * @param opts.forced 在线测试强制指定接口时为 true（真实请求仍按 id 更小优先）
 */
export function buildRouteConflict(
  current: Pick<MockApi, 'id' | 'name' | 'method' | 'path'>,
  others: RouteConflictApi[],
  opts?: { forced?: boolean },
): RouteConflict | null {
  if (others.length === 0) return null;
  const apis = [toConflictApi(current), ...others].sort((a, b) => a.id - b.id);
  const realWinnerId = apis[0]!.id;
  const list = apis.map((a) => `#${a.id}「${a.name}」`).join('、');
  const message = opts?.forced
    ? `路由冲突：${current.method} ${current.path} 存在多个启用接口 ${list}。在线测试强制使用 #${current.id}；真实请求会命中 #${realWinnerId}（同 path 时 id 更小优先）。请禁用或修改重复接口的 path。`
    : `路由冲突：${current.method} ${current.path} 存在多个启用接口 ${list}。当前命中 #${current.id}（同 path 时 id 更小优先）。请禁用或修改重复接口的 path。`;
  return {
    message,
    apis,
    winnerId: realWinnerId,
  };
}

function toConflictApi(api: Pick<MockApi, 'id' | 'name' | 'method' | 'path'>): RouteConflictApi {
  return { id: api.id, name: api.name, method: api.method, path: api.path };
}

function precisionOf(path: string): RoutePrecision {
  if (path.includes('*')) return ROUTE_PRECISION.WILDCARD;
  if (path.includes(':')) return ROUTE_PRECISION.PARAMETRIC;
  return ROUTE_PRECISION.EXACT;
}

export type { Candidate };