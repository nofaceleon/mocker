import type { MockApi, MockApiResponse, ResponseCondition, ResponseOperator } from '../db/schema.js';
import type { RequestContext } from './request.js';
import { logger } from '../utils/logger.js';

/**
 * 响应解析器：根据请求参数和多响应配置，选择最合适的响应。
 *
 * 优先级：
 * 1. X-Mock-Response-Id 请求头 → 手动选择（最高优先级）
 * 2. X-Mock-Response-Name 请求头 → 按名称匹配
 * 3. 按数组顺序遍历，conditions 全部满足 → 自动匹配
 * 4. isDefault=true 的响应 → 兜底
 * 5. null → 使用旧扁平字段（向后兼容）
 */
export function resolveResponse(
  api: MockApi,
  reqCtx: RequestContext,
): { resolved: MockApiResponse | null; fields: ResolvedFields } {
  const responses = (api.responses as MockApiResponse[] | null) ?? null;

  // 无多响应数据 → 使用旧扁平字段
  if (!responses || responses.length === 0) {
    logger.debug({ apiId: api.id }, 'resolver: no responses array, using fallback');
    return { resolved: null, fields: fallbackFields(api) };
  }

  logger.debug({ apiId: api.id, count: responses.length, query: reqCtx.originalQuery }, 'resolver: evaluating responses');

  // 1. 手动选择：X-Mock-Response-Id
  const manualId = reqCtx.headers['xMockResponseId'];
  if (manualId) {
    const found = responses.find((r) => r.id === manualId);
    if (found) {
      return { resolved: found, fields: mergeFields(api, found) };
    }
  }

  // 2. 手动选择：X-Mock-Response-Name
  const manualName = reqCtx.headers['xMockResponseName'];
  if (manualName) {
    const found = responses.find((r) => r.name === manualName);
    if (found) {
      return { resolved: found, fields: mergeFields(api, found) };
    }
  }

  // 3. 条件自动匹配（顺序优先，第一个满足的胜出）
  for (const resp of responses) {
    if (resp.isDefault) {
      logger.debug({ apiId: api.id, respName: resp.name }, 'resolver: skip default response');
      continue;
    }
    if (!resp.conditions || resp.conditions.length === 0) {
      logger.debug({ apiId: api.id, respName: resp.name }, 'resolver: skip response with no conditions');
      continue;
    }
    const matched = matchConditions(resp.conditions, reqCtx);
    logger.debug({ apiId: api.id, respName: resp.name, conditions: resp.conditions, matched }, 'resolver: condition check');
    if (matched) {
      return { resolved: resp, fields: mergeFields(api, resp) };
    }
  }

  // 4. 默认响应兜底
  const defaultResp = responses.find((r) => r.isDefault);
  if (defaultResp) {
    logger.debug({ apiId: api.id, respName: defaultResp.name }, 'resolver: using default fallback');
    return { resolved: defaultResp, fields: mergeFields(api, defaultResp) };
  }

  // 5. 无默认响应 → 使用旧扁平字段
  logger.debug({ apiId: api.id }, 'resolver: no default response, using fallback');
  return { resolved: null, fields: fallbackFields(api) };
}

export type ResolvedFields = {
  responseStatus: number;
  responseDelay: number;
  responseDelayMax: number;
  responseContentType: string;
  responseHeaders: Record<string, string> | null;
  responseBody: unknown;
};

function fallbackFields(api: MockApi): ResolvedFields {
  return {
    responseStatus: api.responseStatus ?? 200,
    responseDelay: api.responseDelay ?? 0,
    responseDelayMax: api.responseDelayMax ?? 0,
    responseContentType: api.responseContentType ?? 'application/json',
    responseHeaders: api.responseHeaders ?? null,
    responseBody: api.responseBody ?? null,
  };
}

function mergeFields(api: MockApi, resp: MockApiResponse): ResolvedFields {
  return {
    responseStatus: resp.responseStatus ?? api.responseStatus ?? 200,
    responseDelay: resp.responseDelay ?? api.responseDelay ?? 0,
    responseDelayMax: resp.responseDelayMax ?? api.responseDelayMax ?? 0,
    responseContentType: resp.responseContentType ?? api.responseContentType ?? 'application/json',
    responseHeaders: resp.responseHeaders ?? api.responseHeaders ?? null,
    responseBody: resp.responseBody ?? api.responseBody ?? null,
  };
}

function matchConditions(conditions: ResponseCondition[], reqCtx: RequestContext): boolean {
  return conditions.every((cond) => {
    const actual = getSourceValue(cond.source, cond.field, reqCtx);
    const result = evaluateCondition(actual, cond.operator, cond.value);
    logger.debug({ source: cond.source, field: cond.field, operator: cond.operator, expected: cond.value, actual, result }, 'resolver: condition eval');
    return result;
  });
}

function getSourceValue(
  source: ResponseCondition['source'],
  field: string,
  reqCtx: RequestContext,
): unknown {
  switch (source) {
    case 'query':
      // 用户配置的字段名可能是原始名（如 is_fail），reqCtx.query 已转 camelCase（isFail）
      // 同时尝试原始名和 camelCase
      return reqCtx.originalQuery[field] ?? reqCtx.query[field] ?? reqCtx.query[toCamel(field)];
    case 'body':
      // body 也做了 normalizeKeys，同时尝试原始键名
      return reqCtx.body[field] ?? reqCtx.body[toCamel(field)];
    case 'header':
      // headers 已被 normalizeKeys 转为 camelCase，同时尝试原始键名
      return reqCtx.headers[field] ?? reqCtx.headers[toCamel(field)];
    case 'path':
      return reqCtx.path[field];
    default:
      return undefined;
  }
}

function toCamel(s: string): string {
  return s.replace(/[-_]([a-zA-Z0-9])/g, (_, c) => c.toUpperCase());
}

function evaluateCondition(actual: unknown, operator: ResponseOperator, expected: string): boolean {
  if (actual === undefined || actual === null) {
    // null/undefined 只在 equals/not_equals 时有意义
    if (operator === 'equals') return expected === '' || expected === 'null';
    if (operator === 'not_equals') return expected !== '' && expected !== 'null';
    return false;
  }

  const actualStr = String(actual);
  const actualNum = Number(actual);

  switch (operator) {
    case 'equals':
      // 尝试数值比较
      if (!isNaN(actualNum) && !isNaN(Number(expected))) {
        return actualNum === Number(expected);
      }
      return actualStr === expected;
    case 'not_equals':
      if (!isNaN(actualNum) && !isNaN(Number(expected))) {
        return actualNum !== Number(expected);
      }
      return actualStr !== expected;
    case 'contains':
      return actualStr.includes(expected);
    case 'gt':
      return !isNaN(actualNum) && actualNum > Number(expected);
    case 'lt':
      return !isNaN(actualNum) && actualNum < Number(expected);
    case 'gte':
      return !isNaN(actualNum) && actualNum >= Number(expected);
    case 'lte':
      return !isNaN(actualNum) && actualNum <= Number(expected);
    case 'regex':
      try {
        const regex = new RegExp(expected);
        // 简单的 ReDoS 防护：设置超时避免灾难性回溯
        const startTime = Date.now();
        const result = regex.test(actualStr);
        const elapsed = Date.now() - startTime;
        if (elapsed > 100) {
          logger.warn({ pattern: expected, elapsed }, 'resolver: regex evaluation took too long, possible ReDoS');
        }
        return result;
      } catch {
        return false;
      }
    default:
      return false;
  }
}
