import { eq, inArray, asc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  projects,
  featureGroups,
  mockApis,
  mockData,
  callbackConfigs,
  type DataOp,
  type HttpMethod,
  type Protocol,
} from '../db/schema.js';
import { ApiError } from '../middleware/error-handler.js';
import { registry } from '../mock-engine/registry.js';

export const EXPORT_VERSION = 2 as const;

export type ExportedCallbackConfig = {
  name: string | null;
  isEnabled: boolean;
  callbackUrl: string | null;
  callbackMethod: string;
  callbackHeaders: Record<string, string> | null;
  callbackBody: string | null;
  delayType: string;
  delayValue: string;
  retryEnabled: boolean;
  maxRetries: number;
  retryInterval: number;
  retryStrategy: string;
  retryCondition: string | null;
};

export type ExportedMockData = {
  dataKey: string | null;
  dataValue: unknown;
};

export type ExportedApi = {
  name: string;
  description: string | null;
  protocol: Protocol;
  method: HttpMethod;
  path: string;
  isEnabled: boolean;
  sortOrder: number;
  responseStatus: number;
  responseDelay: number;
  responseDelayMax: number;
  responseContentType: string;
  responseHeaders: Record<string, string> | null;
  responseBody: unknown;
  validationRules: unknown;
  dataOp: DataOp;
  dataTable: string | null;
  dataWhere: Record<string, unknown> | null;
  dataPayload?: Record<string, unknown> | null;
  script: string | null;
  /** 多响应配置 */
  responses?: unknown;
  /** 兼容 v1 导出：单条 callback。v2 起改用 callbacks[] */
  callback?: ExportedCallbackConfig | null;
  callbacks?: ExportedCallbackConfig[];
  mockData?: ExportedMockData[];
};

export type ExportedFeatureGroup = {
  name: string;
  description: string | null;
  sortOrder: number;
  apis: ExportedApi[];
};

export type ProjectExportBundle = {
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  project: {
    name: string;
    description: string | null;
  };
  featureGroups: ExportedFeatureGroup[];
};

export type ExportOptions = {
  groupIds?: number[];
  includeData?: boolean;
};

export type ImportMode = 'create' | 'skip' | 'overwrite';

export type ImportResult = {
  projectId: number;
  projectName: string;
  created: boolean;
  groups: number;
  apis: number;
  callbacks: number;
  mockDataRows: number;
};

export function exportProject(projectId: number, options: ExportOptions = {}): ProjectExportBundle {
  const db = getDb();
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new ApiError('NOT_FOUND', `项目 ${projectId} 不存在`, 404);

  let groups = db
    .select()
    .from(featureGroups)
    .where(eq(featureGroups.projectId, projectId))
    .orderBy(asc(featureGroups.sortOrder), asc(featureGroups.id))
    .all();

  if (options.groupIds && options.groupIds.length > 0) {
    const set = new Set(options.groupIds);
    groups = groups.filter((g) => set.has(g.id));
  }

  const groupIds = groups.map((g) => g.id);
  const apis =
    groupIds.length === 0
      ? []
      : db
          .select()
          .from(mockApis)
          .where(inArray(mockApis.featureGroupId, groupIds))
          .orderBy(asc(mockApis.sortOrder), asc(mockApis.id))
          .all();

  const apiIds = apis.map((a) => a.id);
  const callbacks =
    apiIds.length === 0
      ? []
      : db
          .select()
          .from(callbackConfigs)
          .where(inArray(callbackConfigs.apiId, apiIds))
          .orderBy(asc(callbackConfigs.sortOrder), asc(callbackConfigs.id))
          .all();
  const callbacksByApi = new Map<number, typeof callbacks>();
  for (const c of callbacks) {
    const list = callbacksByApi.get(c.apiId) ?? [];
    list.push(c);
    callbacksByApi.set(c.apiId, list);
  }

  const dataRows =
    options.includeData && apiIds.length > 0
      ? db.select().from(mockData).where(inArray(mockData.apiId, apiIds)).all()
      : [];
  const dataByApi = new Map<number, typeof dataRows>();
  for (const row of dataRows) {
    const list = dataByApi.get(row.apiId) ?? [];
    list.push(row);
    dataByApi.set(row.apiId, list);
  }

  const apisByGroup = new Map<number, typeof apis>();
  for (const api of apis) {
    const list = apisByGroup.get(api.featureGroupId) ?? [];
    list.push(api);
    apisByGroup.set(api.featureGroupId, list);
  }

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    project: {
      name: project.name,
      description: project.description,
    },
    featureGroups: groups.map((g) => ({
      name: g.name,
      description: g.description,
      sortOrder: g.sortOrder,
      apis: (apisByGroup.get(g.id) ?? []).map((api) => {
        const cbs = callbacksByApi.get(api.id) ?? [];
        const md = dataByApi.get(api.id) ?? [];
        return {
          name: api.name,
          description: api.description,
          protocol: api.protocol,
          method: api.method,
          path: api.path,
          isEnabled: api.isEnabled,
          sortOrder: api.sortOrder,
          responseStatus: api.responseStatus,
          responseDelay: api.responseDelay,
          responseDelayMax: api.responseDelayMax,
          responseContentType: api.responseContentType,
          responseHeaders: api.responseHeaders,
          responseBody: api.responseBody,
          validationRules: api.validationRules,
          dataOp: api.dataOp,
          dataTable: api.dataTable,
          dataWhere: api.dataWhere,
          dataPayload: api.dataPayload ?? null,
          script: api.script,
          responses: api.responses ?? null,
          callbacks: cbs.map((cb) => ({
            name: cb.name ?? null,
            isEnabled: cb.isEnabled,
            callbackUrl: cb.callbackUrl,
            callbackMethod: cb.callbackMethod,
            callbackHeaders: cb.callbackHeaders,
            callbackBody: cb.callbackBody,
            delayType: cb.delayType,
            delayValue: cb.delayValue,
            retryEnabled: cb.retryEnabled,
            maxRetries: cb.maxRetries,
            retryInterval: cb.retryInterval,
            retryStrategy: cb.retryStrategy,
            retryCondition: cb.retryCondition,
          })),
          mockData: options.includeData
            ? md.map((d) => ({ dataKey: d.dataKey, dataValue: d.dataValue }))
            : undefined,
        };
      }),
    })),
  };
}

type ImportRouteItem = {
  method: string;
  path: string;
  name: string;
  groupName: string;
  isEnabled: boolean;
};

function collectImportRoutes(bundle: ProjectExportBundle): ImportRouteItem[] {
  const routes: ImportRouteItem[] = [];
  for (const g of bundle.featureGroups ?? []) {
    for (const a of g.apis ?? []) {
      if (!a?.method || typeof a.path !== 'string' || !a.path) {
        throw new ApiError(
          'INVALID_EXPORT',
          `接口缺少 method/path：功能组「${g.name ?? '?'}」·「${a?.name ?? '?'}」`,
          400,
        );
      }
      routes.push({
        method: a.method,
        path: a.path,
        name: a.name || a.path,
        groupName: g.name ?? '',
        isEnabled: a.isEnabled ?? true,
      });
    }
  }
  return routes;
}

/**
 * 导入前校验 method+path：
 * 1. 包内启用接口不得出现完全相同的 method+path
 * 2. 不得与库中已启用接口冲突（overwrite 时排除将被删除的同名项目）
 */
function assertImportPathsOk(
  db: ReturnType<typeof getDb>,
  bundle: ProjectExportBundle,
  excludeProjectId?: number,
): void {
  const enabled = collectImportRoutes(bundle).filter((r) => r.isEnabled);

  const byKey = new Map<string, ImportRouteItem[]>();
  for (const r of enabled) {
    const key = `${r.method}\0${r.path}`;
    const list = byKey.get(key) ?? [];
    list.push(r);
    byKey.set(key, list);
  }

  const internal = [...byKey.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([, list]) => ({
      method: list[0]!.method,
      path: list[0]!.path,
      apis: list.map((a) => ({ name: a.name, group: a.groupName })),
    }));

  if (internal.length > 0) {
    const summary = internal
      .slice(0, 3)
      .map((d) => `${d.method} ${d.path}`)
      .join('、');
    throw new ApiError(
      'ROUTE_CONFLICT',
      `导入包内存在重复路由（method+path 完全相同）：${summary}${
        internal.length > 3 ? ` 等 ${internal.length} 处` : ''
      }。请修改后再导入。`,
      409,
      { kind: 'internal', conflicts: internal },
    );
  }

  let existingApis = db
    .select({
      id: mockApis.id,
      name: mockApis.name,
      method: mockApis.method,
      path: mockApis.path,
      featureGroupId: mockApis.featureGroupId,
    })
    .from(mockApis)
    .where(eq(mockApis.isEnabled, true))
    .all();

  if (excludeProjectId != null) {
    const groupIds = new Set(
      db
        .select({ id: featureGroups.id })
        .from(featureGroups)
        .where(eq(featureGroups.projectId, excludeProjectId))
        .all()
        .map((g) => g.id),
    );
    existingApis = existingApis.filter((a) => !groupIds.has(a.featureGroupId));
  }

  const existingByKey = new Map(existingApis.map((a) => [`${a.method}\0${a.path}`, a]));
  const external: Array<{
    method: string;
    path: string;
    importName: string;
    existingId: number;
    existingName: string;
  }> = [];

  for (const r of enabled) {
    const hit = existingByKey.get(`${r.method}\0${r.path}`);
    if (hit) {
      external.push({
        method: r.method,
        path: r.path,
        importName: r.name,
        existingId: hit.id,
        existingName: hit.name,
      });
    }
  }

  if (external.length > 0) {
    const summary = external
      .slice(0, 3)
      .map((d) => `${d.method} ${d.path}（与 #${d.existingId}「${d.existingName}」冲突）`)
      .join('；');
    throw new ApiError(
      'ROUTE_CONFLICT',
      `导入接口与现有启用路由冲突：${summary}${
        external.length > 3 ? ` 等 ${external.length} 处` : ''
      }。请修改 path、禁用冲突接口后再导入。`,
      409,
      { kind: 'external', conflicts: external },
    );
  }
}

export function importProject(
  bundle: ProjectExportBundle,
  options: { mode?: ImportMode; name?: string } = {},
): ImportResult {
  if (!bundle || (bundle.version !== EXPORT_VERSION && bundle.version !== 1)) {
    throw new ApiError('INVALID_EXPORT', `不支持的导出版本（需要 version=${EXPORT_VERSION}）`, 400);
  }
  if (!bundle.project?.name) {
    throw new ApiError('INVALID_EXPORT', '导出包缺少 project.name', 400);
  }

  const mode = options.mode ?? 'create';
  const db = getDb();
  const targetName = (options.name?.trim() || bundle.project.name).slice(0, 100);
  const existing = db.select().from(projects).where(eq(projects.name, targetName)).get();

  let projectId: number;
  let created = false;

  if (existing) {
    if (mode === 'skip') {
      return {
        projectId: existing.id,
        projectName: existing.name,
        created: false,
        groups: 0,
        apis: 0,
        callbacks: 0,
        mockDataRows: 0,
      };
    }
    if (mode === 'create') {
      throw new ApiError('CONFLICT', `项目名 "${targetName}" 已存在，请改名或选择覆盖/跳过`, 409);
    }
  }

  // 写入前校验 method+path；覆盖同名项目时排除其现有路由
  assertImportPathsOk(db, bundle, mode === 'overwrite' && existing ? existing.id : undefined);

  if (existing && mode === 'overwrite') {
    // overwrite: 删除后重建（级联）
    db.delete(projects).where(eq(projects.id, existing.id)).run();
  }

  const [project] = db
    .insert(projects)
    .values({
      name: targetName,
      description: bundle.project.description ?? null,
    })
    .returning()
    .all();
  projectId = project.id;
  created = true;

  let groupCount = 0;
  let apiCount = 0;
  let callbackCount = 0;
  let mockDataCount = 0;

  for (const g of bundle.featureGroups ?? []) {
    const [group] = db
      .insert(featureGroups)
      .values({
        projectId,
        name: g.name,
        description: g.description ?? null,
        sortOrder: g.sortOrder ?? 0,
      })
      .returning()
      .all();
    groupCount++;

    for (const a of g.apis ?? []) {
      const [api] = db
        .insert(mockApis)
        .values({
          featureGroupId: group.id,
          name: a.name,
          description: a.description ?? null,
          protocol: a.protocol ?? 'HTTP',
          method: a.method,
          path: a.path,
          isEnabled: a.isEnabled ?? true,
          sortOrder: a.sortOrder ?? 0,
          responseStatus: a.responseStatus ?? 200,
          responseDelay: a.responseDelay ?? 0,
          responseDelayMax: a.responseDelayMax ?? 0,
          responseContentType: a.responseContentType ?? 'application/json',
          responseHeaders: a.responseHeaders ?? null,
          responseBody: a.responseBody ?? null,
          validationRules: (a.validationRules as never) ?? null,
          dataOp: a.dataOp ?? 'none',
          dataTable: a.dataTable ?? null,
          dataWhere: a.dataWhere ?? null,
          dataPayload: a.dataPayload ?? null,
          script: a.script ?? null,
          responses: (a.responses as never) ?? null,
        })
        .returning()
        .all();
      apiCount++;

      // v2 用 callbacks[]；v1 兼容 callback 单条字段
      const cbList: ExportedCallbackConfig[] = Array.isArray(a.callbacks)
        ? a.callbacks
        : a.callback
          ? [a.callback]
          : [];
      cbList.forEach((cb, idx) => {
        db.insert(callbackConfigs)
          .values({
            apiId: api.id,
            name: cb.name ?? null,
            sortOrder: idx,
            isEnabled: cb.isEnabled ?? false,
            callbackUrl: cb.callbackUrl ?? null,
            callbackMethod: cb.callbackMethod ?? 'POST',
            callbackHeaders: cb.callbackHeaders ?? null,
            callbackBody: cb.callbackBody ?? null,
            delayType: (cb.delayType as 'fixed' | 'random') ?? 'fixed',
            delayValue: cb.delayValue ?? '0',
            retryEnabled: cb.retryEnabled ?? false,
            maxRetries: cb.maxRetries ?? 3,
            retryInterval: cb.retryInterval ?? 5000,
            retryStrategy: (cb.retryStrategy as 'fixed' | 'exponential') ?? 'fixed',
            retryCondition: cb.retryCondition ?? null,
          })
          .run();
        callbackCount++;
      });

      for (const d of a.mockData ?? []) {
        db.insert(mockData)
          .values({
            apiId: api.id,
            dataKey: d.dataKey ?? null,
            dataValue: d.dataValue as never,
          })
          .run();
        mockDataCount++;
      }
    }
  }

  registry.reload();

  return {
    projectId,
    projectName: targetName,
    created,
    groups: groupCount,
    apis: apiCount,
    callbacks: callbackCount,
    mockDataRows: mockDataCount,
  };
}
