import type { MockApi, ValidationParamRule } from '@/types/api';

/**
 * 根据 ParamRule 的字段信息生成示例值（优先用 default / enum / min，按 type 兜底）。
 * 用于「在线测试」面板自动填充请求参数。
 */
export function buildSampleFromRule(rule: ValidationParamRule): unknown {
  if (rule.default !== undefined && rule.default !== null) return rule.default;
  if (Array.isArray(rule.enum) && rule.enum.length > 0) return rule.enum[0];

  switch (rule.type) {
    case 'string':
      return sampleString(rule);
    case 'number': {
      // 优先落在 [min, max] 内；避免旧逻辑在 min>1 时仍返回 1 导致校验失败
      if (typeof rule.min === 'number') return rule.min;
      if (typeof rule.max === 'number') return Math.min(0, rule.max);
      return 0;
    }
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
  let value = '';
  // 常见字段名兜底（提升测试请求通过校验的概率）
  if (name === 'email') value = 'user@example.com';
  else if (name === 'mobile' || name === 'phone') value = '13800000000';
  else if (name === 'username' || name === 'user_name') value = 'demo_user';
  else if (name === 'password') value = 'demo_pass_123';
  else if (name === 'url' || name === 'imageurl' || name.endsWith('url')) value = 'https://example.com';
  else if (name === 'id' || name.endsWith('_id') || name.endsWith('id')) value = '1';
  else if (name === 'name' || name.endsWith('name')) value = 'demo';
  else if (name === 'type' || name.endsWith('_type')) value = 'hlht';
  else if (name === 'batch_id') value = '8f3e2a1b6c4d09e7';
  else if (name === 'remark' || name === 'description' || name === 'desc') value = 'demo备注';
  else if (name === 'keyword' || name === 'search') value = 'demo';
  else if (name === 'pageindex' || name === 'page_index' || name === 'page') value = '1';
  else if (name === 'pagenum' || name === 'page_size' || name === 'pagesize') value = '20';
  else if (name === 'status') value = '1';
  else if (name === 'env') value = '1';
  else if (name.includes('time')) value = '2026-07-04 14:30:00';
  else if (rule.pattern) {
    // 用一个能通过常见 pattern 的示例值
    if (rule.pattern.includes('@')) value = 'user@example.com';
    else if (rule.pattern.includes('https?://')) value = 'https://example.com';
    else value = `demo-${rule.name}`;
  } else {
    value = `demo-${rule.name}`;
  }

  // 满足 min/max 长度，避免 required+min 规则把短样本判失败
  const minLen = typeof rule.min === 'number' ? Math.max(0, rule.min) : 0;
  const maxLen = typeof rule.max === 'number' ? rule.max : undefined;
  if (value.length < minLen) {
    value = value + 'x'.repeat(minLen - value.length);
  }
  if (maxLen !== undefined && value.length > maxLen) {
    value = value.slice(0, Math.max(minLen, maxLen));
  }
  return value;
}

/**
 * 把 path 中的 `:name` 占位符按 pathRules 替换成示例值
 * 例如 `/users/:id` → `/users/1`
 *
 * 兜底：即使 pathRules 为空（或某个占位符没匹配到规则），
 * 也用通用默认值替换，否则批量测试时 matcher 会因 `:xxx`
 * 残留在 path 中而匹配不到路由。
 */
export function buildPathFromTemplate(
  pathTemplate: string,
  pathRules: ValidationParamRule[],
): string {
  return pathTemplate.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_match, name) => {
    const rule = pathRules.find((r) => r.name === name);
    if (rule) return String(buildSampleFromRule(rule));
    const fallback = String(buildSampleFromRule({ name, type: 'string' }));
    return fallback || '1';
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

