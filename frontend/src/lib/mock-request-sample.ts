import type { MockApi, ValidationParamRule } from '@/types/api';

/**
 * 根据 ParamRule 的字段信息生成示例值（优先用 default / enum / min，按 type 兜底）。
 * 用于「在线测试」面板自动填充请求参数。
 */
export function buildSampleFromRule(rule: ValidationParamRule): unknown {
  if (rule.default !== undefined && rule.default !== null) return rule.default;
  if (Array.isArray(rule.enum) && rule.enum.length > 0) return rule.enum[0];
  if (typeof rule.min === 'number') return rule.min;

  switch (rule.type) {
    case 'string':
      return sampleString(rule);
    case 'number':
      return typeof rule.max === 'number' && rule.max > 0 ? 1 : 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return null;
  }
}

function sampleString(rule: ValidationParamRule): string {
  const name = rule.name.toLowerCase();
  // 常见字段名兜底（提升测试请求通过校验的概率）
  if (name === 'email') return 'user@example.com';
  if (name === 'mobile' || name === 'phone') return '13800000000';
  if (name === 'username' || name === 'user_name') return 'demo_user';
  if (name === 'password') return 'demo_pass_123';
  if (name === 'url' || name === 'imageurl' || name.endsWith('url')) return 'https://example.com';
  if (name === 'id' || name.endsWith('_id') || name.endsWith('id')) return '1';
  if (name === 'name' || name.endsWith('name')) return 'demo';
  if (name === 'type' || name.endsWith('_type')) return 'hlht';
  if (name === 'batch_id') return '8f3e2a1b6c4d09e7';
  if (name === 'remark' || name === 'description' || name === 'desc') return 'demo备注';
  if (name === 'keyword' || name === 'search') return '';
  if (name === 'pageindex' || name === 'page_index' || name === 'page') return '1';
  if (name === 'pagenum' || name === 'page_size' || name === 'pagesize') return '20';
  if (name === 'status') return '1';
  if (name === 'env') return '1';
  if (name.includes('time')) return '2026-07-04 14:30:00';
  if (rule.pattern) {
    // 用一个能通过常见 pattern 的示例值
    if (rule.pattern.includes('@')) return 'user@example.com';
    if (rule.pattern.includes('https?://')) return 'https://example.com';
    return `demo-${rule.name}`;
  }
  if (typeof rule.max === 'number') {
    return 'a'.repeat(Math.max(1, Math.min(8, Math.floor(rule.max / 2))));
  }
  return `demo-${rule.name}`;
}

/**
 * 把 path 中的 `:name` 占位符按 pathRules 替换成示例值
 * 例如 `/users/:id` → `/users/1`
 */
export function buildPathFromTemplate(
  pathTemplate: string,
  pathRules: ValidationParamRule[],
): string {
  return pathTemplate.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_match, name) => {
    const rule = pathRules.find((r) => r.name === name);
    if (!rule) return _match;
    return String(buildSampleFromRule(rule));
  });
}

/**
 * 把 body rules 转成示例 JSON 对象。
 * key 使用 camelCase（与 mock 引擎的 normalizeKeys 对齐，
 * 避免 validator 拿不到值误报 Required）。
 */
export function buildBodySample(
  bodyRules: ValidationParamRule[],
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const rule of bodyRules) {
    const key = toCamelCase(rule.name);
    obj[key] = buildSampleFromRule(rule);
  }
  return obj;
}

/**
 * 把 query rules 转成示例 query 对象（值都是字符串）
 */
export function buildQuerySample(
  queryRules: ValidationParamRule[],
): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const rule of queryRules) {
    const key = toCamelCase(rule.name);
    obj[key] = String(buildSampleFromRule(rule));
  }
  return obj;
}

/**
 * snake_case → camelCase，与 mock 引擎 request.ts 的 normalizeKeys 保持一致。
 */
function toCamelCase(s: string): string {
  return s.replace(/[-_]([a-zA-Z0-9])/g, (_match, c: string) => c.toUpperCase());
}

/**
 * 把 header rules 转成示例 header 对象
 */
export function buildHeaderSample(
  headerRules: ValidationParamRule[],
): Record<string, string> {
  return buildQuerySample(headerRules);
}

export type MockRequestSample = {
  path: string;
  query: Record<string, string>;
  body: unknown;
  headers: Record<string, string>;
};

/**
 * 一站式生成「在线测试」面板所需的全部示例值
 */
export function buildMockRequestSample(api: MockApi): MockRequestSample {
  const rules = api.validationRules ?? {};
  const pathRules = rules.path ?? [];
  const queryRules = rules.query ?? [];
  const headerRules = rules.header ?? [];
  const bodyRules = rules.body ?? [];

  return {
    path: buildPathFromTemplate(api.path, pathRules),
    query: buildQuerySample(queryRules),
    body: api.method === 'GET' ? null : buildBodySample(bodyRules),
    headers: buildHeaderSample(headerRules),
  };
}

/**
 * 把 query 对象拼到 path 末尾（?k=v&k=v）
 */
export function appendQueryToPath(path: string, query: Record<string, string>): string {
  const keys = Object.keys(query).filter((k) => query[k] !== '' && query[k] != null);
  if (keys.length === 0) return path;
  const qs = keys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join('&');
  return path.includes('?') ? `${path}&${qs}` : `${path}?${qs}`;
}