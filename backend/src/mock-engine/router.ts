import { pathToRegexp, type Key } from 'path-to-regexp';

export type CompiledRoute = {
  regex: RegExp;
  paramNames: string[];
  /** 路由精度：exact < parametric < wildcard，用于同 method 下的优先级排序 */
  precision: RoutePrecision;
};

export const ROUTE_PRECISION = {
  EXACT: 0,
  PARAMETRIC: 1,
  WILDCARD: 2,
} as const;

export type RoutePrecision = (typeof ROUTE_PRECISION)[keyof typeof ROUTE_PRECISION];

/**
 * 编译单个 path 模板为正则表达式。
 *
 * 支持：
 *  - `/foo`         → 精确匹配
 *  - `/foo/:id`     → 参数匹配，捕获 :id
 *  - `/foo/*`       → 通配符匹配，匹配剩余任意路径
 *
 * 注意：v6 不再支持 `*name` 命名通配符，统一用 `*`（位置在 pathToRegexp 内通过 index 0 表达）
 */
export function compileRoute(path: string): CompiledRoute {
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  const keys: Key[] = [];
  const regex = pathToRegexp(path, keys, { strict: false, end: true, sensitive: false });

  const paramNames = keys.map((k) => String(k.name));

  // 精度判定
  let precision: RoutePrecision = ROUTE_PRECISION.EXACT;
  if (path.includes('*')) {
    precision = ROUTE_PRECISION.WILDCARD;
  } else if (paramNames.length > 0) {
    precision = ROUTE_PRECISION.PARAMETRIC;
  }

  return { regex, paramNames, precision };
}

/** 判断 path 模板是否为精确路径（无参数、无通配符） */
export function isExactPath(path: string): boolean {
  return !path.includes(':') && !path.includes('*');
}