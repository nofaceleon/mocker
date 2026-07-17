import * as yaml from 'yaml';
import {
  HTTP_METHODS,
  type HttpMethod,
  type ValidationRules,
  type ParamRule,
} from '../db/schema.js';

export type OpenApiVersion = '2.0' | '3.0' | 'unknown';

export type NormalizedImportItem = {
  index: number;
  name: string;
  description: string;
  method: HttpMethod;
  path: string;
  isSupported: boolean;
  unsupportedReason?: string;
  validationRules: ValidationRules | null;
  responseStatus: number;
  responseContentType: string;
  responseBody: unknown;
  isEnabled: boolean;
};

export type NormalizedSpecInfo = {
  title: string;
  version: string;
  openApiVersion: OpenApiVersion;
  baseUrl: string;
};

export type ParseResult = {
  specInfo: NormalizedSpecInfo;
  items: NormalizedImportItem[];
};

const HTTP_METHOD_SET = new Set<string>(HTTP_METHODS.map((m) => m.toLowerCase()));

const REF_MAX_DEPTH = 3;
const MAX_NAME_LEN = 100;

/**
 * 解析原始文本（JSON 或 YAML）为对象
 */
export function parseSpecText(content: string, fileName: string): unknown {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new SpecParseError('文件内容为空', 'EMPTY_FILE');
  }

  const lowerName = fileName.toLowerCase();
  const looksJson =
    lowerName.endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[');
  const looksYaml = lowerName.endsWith('.yaml') || lowerName.endsWith('.yml');

  // 优先按扩展名选择解析器，扩展名缺失时尝试 JSON 失败后回退 YAML
  if (looksJson && !looksYaml) {
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      throw new SpecParseError(
        `JSON 解析失败: ${err instanceof Error ? err.message : String(err)}`,
        'INVALID_JSON',
      );
    }
  }

  try {
    // 用 yaml 包（eemeli/yaml）的 parseDocument：
    // - uniqueKeys: false 容忍重复 key（Swagger 文档版本演进时常见）
    // - strict: false 忽略未知 tag 等次要警告
    // - keepSourceTokens: true 保留每个 Pair 的原始顺序，方便检测并改重名重复 key
    const doc = yaml.parseDocument(trimmed, {
      strict: false,
      uniqueKeys: false,
      keepSourceTokens: true,
    });
    // 仅过滤掉 "Map keys must be unique" 警告，其它解析错误仍抛错
    const fatalErrors = doc.errors.filter((e) => !/Map keys must be unique/i.test(e.message));
    if (fatalErrors.length > 0) {
      const first = fatalErrors[0];
      throw new SpecParseError(
        `YAML 解析失败: ${first.message}${first.pos && first.pos.length >= 2 ? ` (line ${first.pos[0] + 1})` : ''}`,
        'INVALID_YAML',
      );
    }
    // 自动处理 definitions / paths 下重复 key：
    // 同一映射里第二次及以后出现的同名 key 会被自动改名为 `<key>__dup<N>`，
    // 所有 $ref 同步替换。这样 Swagger 文档即使有版本演进遗留的重复定义也能正确导入。
    dedupeYamlMapDuplicates(doc);
    const parsed = doc.toJS();
    if (parsed === undefined || parsed === null) {
      throw new SpecParseError('YAML 解析结果为空', 'INVALID_YAML');
    }
    return parsed;
  } catch (err) {
    if (err instanceof SpecParseError) throw err;
    // 兜底：尝试按 JSON 解析（用户可能传了无扩展名的 JSON 文件）
    if (!looksYaml) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // 继续抛 YAML 错误
      }
    }
    throw new SpecParseError(
      `YAML 解析失败: ${err instanceof Error ? err.message : String(err)}`,
      'INVALID_YAML',
    );
  }
}

/**
 * 递归扫描 YAML AST，遇到同名 key 第二次及以后出现时自动改名为 `<key>__dup<N>`，
 * 并同步更新文档内所有对应 `$ref: '#/.../X'` 引用。
 *
 * 典型场景：Swagger 文档作者在版本演进后没删除旧定义，导致同一个 `BatchPreviewRequest`
 * 出现了两次，被两个不同的 operation 引用——本工具会自动让两次定义共存。
 */
function dedupeYamlMapDuplicates(doc: yaml.Document): void {
  // 先收集 root 级别的"容器"字段名（definitions、paths）
  const root = doc.contents as yaml.YAMLMap | null | undefined;
  if (!root || !(root instanceof yaml.YAMLMap)) return;

  const rootItems = root.items as yaml.Pair[];
  for (const pair of rootItems) {
    const pairKey = pair.key as { value?: unknown };
    if (!(pair.value instanceof yaml.YAMLMap)) continue;
    const containerKey = String(pairKey.value ?? '');
    // 我们只关心 definitions / paths 这两类容器
    if (containerKey !== 'definitions' && containerKey !== 'paths') continue;

    // 第一步：扫描容器，对同名 key 第二次及以后出现的重命名为 <key>__dup<N>，
    // 并记录每个原 key 第一次出现的源行号
    const renameMap = new Map<string, string>(); // 原 key -> 新 key
    const firstSeenLine = new Map<string, number>(); // 原 key -> 首次出现的源 line（0-based）
    const seen = new Set<string>();
    let dupIndex = 0;

    const childItems = (pair.value as yaml.YAMLMap).items as yaml.Pair[];
    for (const childPair of childItems) {
      const childKey = childPair.key as { value?: unknown };
      const originalKey = String(childKey.value ?? '');
      if (!originalKey) continue;
      const line = (childKey as { range?: [number, number, number] }).range?.[0] ?? 0;
      if (seen.has(originalKey)) {
        dupIndex += 1;
        const newKey = `${originalKey}__dup${dupIndex}`;
        childKey.value = newKey;
        renameMap.set(originalKey, newKey);
      } else {
        seen.add(originalKey);
        firstSeenLine.set(originalKey, line);
      }
    }
    if (renameMap.size === 0) continue;

    // 第二步：递归扫描整个文档，根据 ref 出现的源行号决定是否需要改名：
    // - ref 出现在原 key 第一次定义行号之前 → 保持原 ref（指向第一次定义）
    // - ref 出现在原 key 第一次定义行号之后 → 重命名为 <key>__dup1（指向第二次定义）
    walkAndRewriteRefsByLine(doc, renameMap, firstSeenLine, containerKey);
  }
}

function walkAndRewriteRefsByLine(
  node: unknown,
  renameMap: Map<string, string>,
  firstSeenLine: Map<string, number>,
  containerKey: 'definitions' | 'paths',
): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) walkAndRewriteRefsByLine(item, renameMap, firstSeenLine, containerKey);
    return;
  }
  if (node instanceof yaml.YAMLMap) {
    const items = (node as yaml.YAMLMap).items as yaml.Pair[];
    for (const pair of items) {
      const pairKey = pair.key as { value?: unknown };
      const pairVal = pair.value as { value?: unknown };
      const keyStr = String(pairKey.value ?? '');
      if (keyStr === '$ref') {
        const refValue = String(pairVal.value ?? '');
        const prefix = `#/${containerKey}/`;
        if (refValue.startsWith(prefix)) {
          const originalName = refValue.slice(prefix.length);
          if (renameMap.has(originalName)) {
            // 仅当 ref 出现在原 key 第一次定义行号之后，才把 ref 改为指向重复定义
            const refLine = (pairVal as { range?: [number, number, number] }).range?.[0] ?? 0;
            const firstLine = firstSeenLine.get(originalName) ?? 0;
            if (refLine > firstLine) {
              pairVal.value = `${prefix}${renameMap.get(originalName)}`;
            }
          }
        }
      }
      if (pair.value && typeof pair.value === 'object') {
        walkAndRewriteRefsByLine(pair.value, renameMap, firstSeenLine, containerKey);
      }
    }
    return;
  }
  if (node instanceof yaml.YAMLSeq) {
    const seqItems = (node as yaml.YAMLSeq).items;
    for (const item of seqItems) {
      if (item && typeof item === 'object') {
        walkAndRewriteRefsByLine(item, renameMap, firstSeenLine, containerKey);
      }
    }
    return;
  }
  if (typeof node === 'object') {
    for (const v of Object.values(node as Record<string, unknown>)) {
      if (v && typeof v === 'object') {
        walkAndRewriteRefsByLine(v, renameMap, firstSeenLine, containerKey);
      }
    }
  }
}

export class SpecParseError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'SpecParseError';
  }
}

/**
 * 检测 OpenAPI/Swagger 版本
 */
export function detectVersion(raw: unknown): OpenApiVersion {
  if (!raw || typeof raw !== 'object') return 'unknown';
  const obj = raw as Record<string, unknown>;
  if (typeof obj.openapi === 'string') {
    if (obj.openapi.startsWith('3.0')) return '3.0';
    return 'unknown';
  }
  if (typeof obj.swagger === 'string') {
    if (obj.swagger.startsWith('2.0')) return '2.0';
    return 'unknown';
  }
  return 'unknown';
}

/**
 * 主入口：解析 spec 为归一化后的预览数据
 */
export function normalizeSpec(raw: unknown): ParseResult {
  if (!raw || typeof raw !== 'object') {
    throw new SpecParseError('Spec 内容必须是对象', 'INVALID_SPEC');
  }
  const root = raw as Record<string, unknown>;
  const version = detectVersion(root);
  if (version === 'unknown') {
    throw new SpecParseError(
      '无法识别 spec 版本，需要 swagger 2.0 或 openapi 3.0.x',
      'UNSUPPORTED_VERSION',
    );
  }

  const info = (root.info ?? {}) as Record<string, unknown>;
  const title = typeof info.title === 'string' ? info.title : '未命名 API';
  const apiVersion = typeof info.version === 'string' ? info.version : '';
  const baseUrl = extractBaseUrl(root, version);

  const paths = root.paths;
  if (!paths || typeof paths !== 'object') {
    throw new SpecParseError('Spec 缺少 paths 字段', 'INVALID_SPEC');
  }

  const components =
    version === '3.0'
      ? ((root.components ?? {}) as Record<string, unknown>)
      : ((root.definitions ?? {}) as Record<string, unknown>);

  const items: NormalizedImportItem[] = [];
  let index = 0;
  for (const [pathKey, pathItem] of Object.entries(paths as Record<string, unknown>)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    const pathObj = pathItem as Record<string, unknown>;

    // 路径级参数（会被 operations 继承）
    const pathLevelParams = Array.isArray(pathObj.parameters) ? pathObj.parameters : [];

    for (const method of Object.keys(pathObj)) {
      const lower = method.toLowerCase();
      if (!HTTP_METHOD_SET.has(lower)) continue;
      const upper = lower.toUpperCase() as HttpMethod;

      const operation = pathObj[method];
      if (!operation || typeof operation !== 'object') continue;

      // 合并路径级和 operation 级参数，operation 级优先
      const opParams = Array.isArray((operation as Record<string, unknown>).parameters)
        ? ((operation as Record<string, unknown>).parameters as unknown[])
        : [];
      const mergedParams = mergeParameters(pathLevelParams, opParams);

      const item =
        version === '3.0'
          ? normalizeOperation3(
              pathKey,
              upper,
              operation as Record<string, unknown>,
              mergedParams,
              root,
              baseUrl,
              index,
            )
          : normalizeOperation2(
              pathKey,
              upper,
              operation as Record<string, unknown>,
              mergedParams,
              root,
              baseUrl,
              index,
            );

      items.push(item);
      index += 1;
    }
  }

  return {
    specInfo: { title, version: apiVersion, openApiVersion: version, baseUrl },
    items,
  };
}

function extractBaseUrl(root: Record<string, unknown>, version: OpenApiVersion): string {
  if (version === '2.0') {
    const basePath = typeof root.basePath === 'string' ? root.basePath : '';
    return normalizePathPrefix(basePath);
  }
  // 3.0
  const servers = root.servers;
  if (Array.isArray(servers) && servers.length > 0) {
    const first = servers[0];
    if (
      first &&
      typeof first === 'object' &&
      typeof (first as Record<string, unknown>).url === 'string'
    ) {
      const url = ((first as Record<string, unknown>).url as string).trim();
      // 仅取 path 部分
      try {
        const u = new URL(url, 'http://placeholder.local');
        return normalizePathPrefix(u.pathname);
      } catch {
        return normalizePathPrefix(url);
      }
    }
  }
  return '';
}

function normalizePathPrefix(prefix: string): string {
  if (!prefix) return '';
  if (!prefix.startsWith('/')) return '/' + prefix.replace(/\/+$/, '');
  return prefix.replace(/\/+$/, '');
}

/**
 * Swagger 2.0 operation → NormalizedImportItem
 */
function normalizeOperation2(
  pathKey: string,
  method: HttpMethod,
  operation: Record<string, unknown>,
  parameters: unknown[],
  root: Record<string, unknown>,
  baseUrl: string,
  index: number,
): NormalizedImportItem {
  const summary = typeof operation.summary === 'string' ? operation.summary : '';
  const description = typeof operation.description === 'string' ? operation.description : '';
  const operationId = typeof operation.operationId === 'string' ? operation.operationId : '';

  const name = sanitizeName(operationId || summary || `${method} ${pathKey}`);
  const fullPath = joinPath(baseUrl, pathKey);

  // parameters: path/query/header/body/formData
  const pathRules: ParamRule[] = [];
  const queryRules: ParamRule[] = [];
  const headerRules: ParamRule[] = [];
  let bodyRules: ParamRule[] | null = null;

  for (const p of parameters) {
    if (!p || typeof p !== 'object') continue;
    const param = p as Record<string, unknown>;
    const inLoc = typeof param.in === 'string' ? param.in : '';
    const rule = swagger2ParamToRule(param);
    if (!rule) continue;

    if (inLoc === 'path') pathRules.push(rule);
    else if (inLoc === 'query') queryRules.push(rule);
    else if (inLoc === 'header') headerRules.push(rule);
    else if (inLoc === 'body' && param.schema) {
      bodyRules = schemaObjectToRules(param.schema as Record<string, unknown>, root, 'body');
    } else if (inLoc === 'formData') {
      // formData 也视作 body 字段
      if (!bodyRules) bodyRules = [];
      bodyRules.push(rule);
    }
  }

  const validationRules: ValidationRules = {
    ...(pathRules.length ? { path: pathRules } : {}),
    ...(queryRules.length ? { query: queryRules } : {}),
    ...(headerRules.length ? { header: headerRules } : {}),
    ...(bodyRules && bodyRules.length ? { body: bodyRules } : {}),
  };

  const { status, contentType, body } = pickFirstResponse(operation.responses, root);

  return {
    index,
    name,
    description,
    method,
    path: fullPath,
    isSupported: true,
    validationRules: Object.keys(validationRules).length > 0 ? validationRules : null,
    responseStatus: status,
    responseContentType: contentType,
    responseBody: body,
    isEnabled: true,
  };
}

/**
 * OpenAPI 3.0 operation → NormalizedImportItem
 */
function normalizeOperation3(
  pathKey: string,
  method: HttpMethod,
  operation: Record<string, unknown>,
  parameters: unknown[],
  components: Record<string, unknown>,
  baseUrl: string,
  index: number,
): NormalizedImportItem {
  const summary = typeof operation.summary === 'string' ? operation.summary : '';
  const description = typeof operation.description === 'string' ? operation.description : '';
  const operationId = typeof operation.operationId === 'string' ? operation.operationId : '';

  const name = sanitizeName(operationId || summary || `${method} ${pathKey}`);
  const fullPath = joinPath(baseUrl, pathKey);

  const pathRules: ParamRule[] = [];
  const queryRules: ParamRule[] = [];
  const headerRules: ParamRule[] = [];
  let bodyRules: ParamRule[] | null = null;

  for (const p of parameters) {
    if (!p || typeof p !== 'object') continue;
    const param = p as Record<string, unknown>;
    const inLoc = typeof param.in === 'string' ? param.in : '';
    const rule = openApi3ParamToRule(param);
    if (!rule) continue;

    if (inLoc === 'path') pathRules.push(rule);
    else if (inLoc === 'query') queryRules.push(rule);
    else if (inLoc === 'header') headerRules.push(rule);
  }

  // requestBody
  const requestBody = operation.requestBody;
  if (requestBody && typeof requestBody === 'object') {
    const rb = requestBody as Record<string, unknown>;
    const content = rb.content;
    if (content && typeof content === 'object') {
      // 优先取 application/json
      const ct = pickJsonContentType(content as Record<string, unknown>);
      if (ct) {
        const schema = ct.schema as Record<string, unknown> | undefined;
        if (schema) {
          bodyRules = schemaObjectToRules(schema, components, 'body');
        }
      }
    }
  }

  const validationRules: ValidationRules = {
    ...(pathRules.length ? { path: pathRules } : {}),
    ...(queryRules.length ? { query: queryRules } : {}),
    ...(headerRules.length ? { header: headerRules } : {}),
    ...(bodyRules && bodyRules.length ? { body: bodyRules } : {}),
  };

  const { status, contentType, body } = pickFirstResponse(operation.responses, components);

  return {
    index,
    name,
    description,
    method,
    path: fullPath,
    isSupported: true,
    validationRules: Object.keys(validationRules).length > 0 ? validationRules : null,
    responseStatus: status,
    responseContentType: contentType,
    responseBody: body,
    isEnabled: true,
  };
}

function pickJsonContentType(content: Record<string, unknown>): { schema?: unknown } | null {
  if (content['application/json']) {
    const v = content['application/json'];
    if (v && typeof v === 'object') return v as { schema?: unknown };
  }
  // 兜底：取第一个
  for (const key of Object.keys(content)) {
    const v = content[key];
    if (v && typeof v === 'object' && 'schema' in (v as Record<string, unknown>)) {
      return v as { schema?: unknown };
    }
  }
  return null;
}

function pickFirstResponse(
  responses: unknown,
  root: Record<string, unknown>,
): { status: number; contentType: string; body: unknown } {
  if (!responses || typeof responses !== 'object') {
    return {
      status: 200,
      contentType: 'application/json',
      body: { code: 0, message: 'success', data: null },
    };
  }
  const respObj = responses as Record<string, unknown>;
  // 优先取 2xx
  const successKey = Object.keys(respObj).find((k) => /^2\d\d$/.test(k));
  const defaultKey = !successKey && respObj.default ? 'default' : null;
  const key = successKey ?? defaultKey ?? Object.keys(respObj)[0];
  if (!key) {
    return {
      status: 200,
      contentType: 'application/json',
      body: { code: 0, message: 'success', data: null },
    };
  }
  const status = /^\d+$/.test(key) ? Number(key) : 200;

  const entry = respObj[key];
  if (!entry || typeof entry !== 'object') {
    return { status, contentType: 'application/json', body: null };
  }
  const entryObj = entry as Record<string, unknown>;

  // 3.0: content['application/json']
  const content = entryObj.content;
  if (content && typeof content === 'object') {
    const ct = pickJsonContentType(content as Record<string, unknown>);
    if (ct) {
      const contentType =
        Object.keys(content).find((k) => k === 'application/json') ?? Object.keys(content)[0];
      const schema = ct.schema as Record<string, unknown> | undefined;
      const example = (ct as Record<string, unknown>).example;
      let body: unknown = example;
      if (body === undefined && schema) {
        const merged = mergeAllOfSchema(schema, root);
        body = buildExampleFromSchema(merged, root, new Set());
      }
      if (body === undefined) body = null;
      return { status, contentType, body };
    }
    // content 存在但没有 application/json，尝试取第一个
    const firstKey = Object.keys(content)[0];
    if (firstKey) {
      return { status, contentType: firstKey, body: null };
    }
  }

  // 2.0: examples['application/json'] 或 schema（可能含 allOf 嵌套）
  let body: unknown = undefined;
  const examples = entryObj.examples;
  if (examples && typeof examples === 'object') {
    const exObj = examples as Record<string, unknown>;
    const jsonEx = exObj['application/json'];
    if (jsonEx !== undefined) {
      body = jsonEx;
    } else {
      const firstKey = Object.keys(exObj)[0];
      if (firstKey) body = exObj[firstKey];
    }
  }
  if (body === undefined && entryObj.schema) {
    const merged = mergeAllOfSchema(entryObj.schema as Record<string, unknown>, root);
    body = buildExampleFromSchema(merged, root, new Set());
  }
  if (body !== undefined) {
    return { status, contentType: 'application/json', body: body ?? null };
  }

  return { status, contentType: 'application/json', body: null };
}

/**
 * 把含 allOf / oneOf / anyOf 的 schema 合并为单一 object schema，
 * 供 buildExampleFromSchema 直接生成示例。
 *
 * 合并规则（按 JSON Schema 语义）：
 * - allOf：所有子项的 properties 合并（后者覆盖前者同名 key）
 * - oneOf / anyOf：取第一个 object 类型的子项（典型用例：和 allOf 混用时取具体分支）
 * - 当前 schema 自身的 properties 优先级最高（覆盖 allOf 子项）
 * - required 数组去重合并
 */
function mergeAllOfSchema(
  schema: Record<string, unknown>,
  root: Record<string, unknown>,
): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return schema;

  // 先递归处理嵌套的 allOf / oneOf / anyOf
  const resolve = (s: unknown): Record<string, unknown> | null => {
    if (!s || typeof s !== 'object') return null;
    const obj = s as Record<string, unknown>;
    // 解析 $ref
    const resolved = (() => {
      if (typeof obj.$ref === 'string') {
        // 简化：直接复用 lookupDefinition（保持深度限制由 buildExampleFromSchema 控制）
        const refParts = obj.$ref.split('/').filter(Boolean);
        if (refParts[0] !== '#') return null;
        refParts.shift();
        let cur: unknown = root;
        for (const seg of refParts) {
          if (!cur || typeof cur !== 'object') return null;
          cur = (cur as Record<string, unknown>)[seg];
        }
        return cur && typeof cur === 'object' ? (cur as Record<string, unknown>) : null;
      }
      return obj;
    })();
    if (!resolved) return null;
    // 嵌套处理
    return mergeAllOfSchema(resolved, root);
  };

  // 合并 properties 和 required
  const merged: Record<string, unknown> = {};
  const requiredSet = new Set<string>();

  // 1. 处理 allOf
  if (Array.isArray(schema.allOf)) {
    for (const item of schema.allOf) {
      const sub = resolve(item);
      if (!sub) continue;
      if (sub.properties && typeof sub.properties === 'object') {
        merged.properties = {
          ...((merged.properties as Record<string, unknown>) ?? {}),
          ...(sub.properties as Record<string, unknown>),
        };
      }
      if (Array.isArray(sub.required)) {
        for (const r of sub.required) {
          if (typeof r === 'string') requiredSet.add(r);
        }
      }
    }
  }

  // 2. 处理 oneOf / anyOf（取第一个 object 子项）
  for (const k of ['oneOf', 'anyOf'] as const) {
    if (Array.isArray(schema[k])) {
      for (const item of schema[k]) {
        const sub = resolve(item);
        if (sub && sub.properties && typeof sub.properties === 'object') {
          merged.properties = {
            ...((merged.properties as Record<string, unknown>) ?? {}),
            ...(sub.properties as Record<string, unknown>),
          };
          if (Array.isArray(sub.required)) {
            for (const r of sub.required) {
              if (typeof r === 'string') requiredSet.add(r);
            }
          }
          break; // 只取第一个
        }
      }
    }
  }

  // 3. 当前 schema 自身的 properties 优先级最高（覆盖）
  if (schema.properties && typeof schema.properties === 'object') {
    merged.properties = {
      ...((merged.properties as Record<string, unknown>) ?? {}),
      ...(schema.properties as Record<string, unknown>),
    };
  }
  if (Array.isArray(schema.required)) {
    for (const r of schema.required) {
      if (typeof r === 'string') requiredSet.add(r);
    }
  }

  // 4. 拷贝 type / description 等元信息
  // 如果合并出了 properties，强制 type=object（即使原 schema 没声明 type）
  if (merged.properties && Object.keys(merged.properties as Record<string, unknown>).length > 0) {
    merged.type = 'object';
  }
  if (schema.type) merged.type = schema.type;
  if (schema.description) merged.description = schema.description;
  if (schema.example !== undefined) merged.example = schema.example;
  if (Array.isArray(schema.enum)) merged.enum = schema.enum;

  // 5. 写入 required 数组
  if (requiredSet.size > 0) {
    merged.required = Array.from(requiredSet);
  }

  return merged;
}

/**
 * Swagger 2.0 单个 parameter → ParamRule
 */
function swagger2ParamToRule(param: Record<string, unknown>): ParamRule | null {
  const name = typeof param.name === 'string' ? param.name.trim() : '';
  if (!name) return null;
  const required = param.required === true;
  const type = swaggerTypeToInternal(param.type, param.format);
  const rule: ParamRule = {
    name,
    type,
    ...(required ? { required: true } : {}),
  };
  // default 优先；缺省时把 example 也作为兜底 default
  if ('default' in param) {
    rule.default = param.default;
  } else if ('example' in param) {
    rule.default = param.example;
  }
  if (typeof param.minimum === 'number') rule.min = param.minimum;
  if (typeof param.maximum === 'number') rule.max = param.maximum;
  if (typeof param.pattern === 'string') rule.pattern = param.pattern;
  if (Array.isArray(param.enum)) rule.enum = param.enum;
  return rule;
}

/**
 * OpenAPI 3.0 单个 parameter → ParamRule
 */
function openApi3ParamToRule(param: Record<string, unknown>): ParamRule | null {
  const name = typeof param.name === 'string' ? param.name.trim() : '';
  if (!name) return null;
  const required = param.required === true;
  const schema = (param.schema ?? {}) as Record<string, unknown>;
  const type = openApiTypeToInternal(schema);
  const rule: ParamRule = {
    name,
    type,
    ...(required ? { required: true } : {}),
  };
  // default 优先；缺省时把 example 也作为兜底 default
  if ('default' in schema) {
    rule.default = schema.default;
  } else if ('example' in schema) {
    rule.default = schema.example;
  }
  if (typeof schema.minimum === 'number') rule.min = schema.minimum;
  if (typeof schema.maximum === 'number') rule.max = schema.maximum;
  if (typeof schema.pattern === 'string') rule.pattern = schema.pattern;
  if (Array.isArray(schema.enum)) rule.enum = schema.enum;
  return rule;
}

/**
 * 将 Swagger/JSON-Schema 中的 type 映射到 ParamType
 */
function swaggerTypeToInternal(type: unknown, format: unknown): ParamRule['type'] {
  if (type === 'integer' || type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  if (type === 'array') return 'array';
  if (type === 'object') return 'object';
  // string 或缺失：file/binary 等都视作 string
  return 'string';
}

function openApiTypeToInternal(schema: Record<string, unknown>): ParamRule['type'] {
  const type = schema.type;
  if (type === 'integer' || type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  if (type === 'array') return 'array';
  if (type === 'object') return 'object';
  return 'string';
}

/**
 * 把 JSON Schema 对象转换为 ParamRule[]（body 字段递归展开）
 * 限制展开深度，$ref 仅展开一层
 */
function schemaObjectToRules(
  schema: Record<string, unknown>,
  root: Record<string, unknown>,
  location: string,
  seenRefs: Set<string> = new Set(),
): ParamRule[] {
  const rules: ParamRule[] = [];
  // 先解析顶层 $ref
  const resolved = resolveRef(schema, root, seenRefs);
  if (!resolved) return rules;
  const properties = resolved.properties;
  if (!properties || typeof properties !== 'object') return rules;

  const requiredList = Array.isArray(resolved.required) ? (resolved.required as string[]) : [];

  for (const [propName, propSchema] of Object.entries(properties as Record<string, unknown>)) {
    if (!propSchema || typeof propSchema !== 'object') continue;
    const propObj = resolveRef(propSchema as Record<string, unknown>, root, seenRefs);
    if (!propObj) continue;

    const type = openApiTypeToInternal(propObj);
    const rule: ParamRule = {
      name: propName,
      type,
      ...(requiredList.includes(propName) ? { required: true } : {}),
    };
    // default 优先；缺省时把 example 也作为兜底 default，
    // 这样 mock 引擎在请求缺这个字段时能用 example 兜底
    if ('default' in propObj) {
      rule.default = propObj.default;
    } else if ('example' in propObj) {
      rule.default = propObj.example;
    }
    if (typeof propObj.minimum === 'number') rule.min = propObj.minimum;
    if (typeof propObj.maximum === 'number') rule.max = propObj.maximum;
    if (typeof propObj.pattern === 'string') rule.pattern = propObj.pattern;
    if (Array.isArray(propObj.enum)) rule.enum = propObj.enum;
    if (location === 'body' && type === 'object') {
      // 嵌套 object 在 body 中保留为 object，不递归（避免 ParamRule 失去类型信息）
    }
    rules.push(rule);
  }
  return rules;
}

/**
 * 解析 $ref，展平一层。深度限制避免循环引用。
 */
function resolveRef(
  node: Record<string, unknown>,
  root: Record<string, unknown>,
  seenRefs: Set<string>,
): Record<string, unknown> | null {
  if (typeof node.$ref === 'string') {
    if (seenRefs.size >= REF_MAX_DEPTH) return node;
    seenRefs.add(node.$ref);
    const target = lookupDefinition(node.$ref, root);
    if (!target) return null;
    return resolveRef(target, root, seenRefs);
  }
  return node;
}

function lookupDefinition(
  ref: string,
  root: Record<string, unknown>,
): Record<string, unknown> | null {
  // 2.0: #/definitions/X
  // 3.0: #/components/schemas/X
  // 传入 root（spec 整体），按 ref 完整路径查找
  const parts = ref.split('/').filter(Boolean);
  if (parts[0] !== '#') return null;
  parts.shift();
  let cur: unknown = root;
  for (const seg of parts) {
    if (!cur || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[seg];
  }
  if (cur && typeof cur === 'object') return cur as Record<string, unknown>;
  return null;
}

/**
 * 从 schema 生成示例值（用于 responseBody 兜底）
 */
function buildExampleFromSchema(
  schema: unknown,
  root: Record<string, unknown>,
  seenRefs: Set<string>,
): unknown {
  if (!schema || typeof schema !== 'object') return null;
  const obj = schema as Record<string, unknown>;
  if (typeof obj.example !== 'undefined') return obj.example;
  if (Array.isArray(obj.examples) && obj.examples.length > 0) return obj.examples[0];
  if (Array.isArray(obj.enum) && obj.enum.length > 0) return obj.enum[0];

  // $ref
  if (typeof obj.$ref === 'string') {
    if (seenRefs.has(obj.$ref)) return null;
    seenRefs.add(obj.$ref);
    const target = lookupDefinition(obj.$ref, root);
    if (!target) return null;
    return buildExampleFromSchema(target, root, seenRefs);
  }

  const type = obj.type;
  if (type === 'string') {
    if (typeof obj.format === 'string') {
      if (obj.format === 'date-time') return new Date().toISOString();
      if (obj.format === 'date') return new Date().toISOString().slice(0, 10);
      if (obj.format === 'email') return 'user@example.com';
      if (obj.format === 'uri' || obj.format === 'url') return 'https://example.com';
      if (obj.format === 'uuid') return '00000000-0000-0000-0000-000000000000';
    }
    return '';
  }
  if (type === 'integer' || type === 'number') return 0;
  if (type === 'boolean') return false;
  if (type === 'array') {
    const items = obj.items as Record<string, unknown> | undefined;
    if (items) {
      return [buildExampleFromSchema(items, root, seenRefs)];
    }
    return [];
  }
  if (type === 'object') {
    const result: Record<string, unknown> = {};
    const properties = obj.properties;
    if (properties && typeof properties === 'object') {
      for (const [k, v] of Object.entries(properties as Record<string, unknown>)) {
        result[k] = buildExampleFromSchema(v, root, seenRefs);
      }
    }
    return result;
  }
  return null;
}

function sanitizeName(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5\- ]/g, '_').trim();
  if (!cleaned) return '未命名接口';
  return cleaned.slice(0, MAX_NAME_LEN);
}

/**
 * 拼接 baseUrl + path，把 Swagger 的 {param} 转成 MockHub 的 :param 形式
 */
export function joinPath(baseUrl: string, pathKey: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  let path = pathKey;
  if (!path.startsWith('/')) path = '/' + path;
  // {id} → :id
  path = path.replace(/\{([^}]+)\}/g, ':$1');
  // 合并多斜杠
  const merged = (base + path).replace(/\/{2,}/g, '/');
  return merged || '/';
}

function mergeParameters(pathLevel: unknown[], opLevel: unknown[]): unknown[] {
  // 简单合并：去重（按 name + in），operation 级优先
  const seen = new Set<string>();
  const result: unknown[] = [];
  for (const p of opLevel) {
    if (!p || typeof p !== 'object') continue;
    const param = p as Record<string, unknown>;
    const key = `${String(param.in ?? '')}:${String(param.name ?? '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(p);
  }
  for (const p of pathLevel) {
    if (!p || typeof p !== 'object') continue;
    const param = p as Record<string, unknown>;
    const key = `${String(param.in ?? '')}:${String(param.name ?? '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(p);
  }
  return result;
}
