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

export const EXPORT_VERSION = 1 as const;

export type ExportedCallbackConfig = {
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
  callback?: ExportedCallbackConfig | null;
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
      : db.select().from(callbackConfigs).where(inArray(callbackConfigs.apiId, apiIds)).all();
  const callbackByApi = new Map(callbacks.map((c) => [c.apiId, c]));

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
        const cb = callbackByApi.get(api.id);
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
          callback: cb
            ? {
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
              }
            : null,
          mockData: options.includeData
            ? md.map((d) => ({ dataKey: d.dataKey, dataValue: d.dataValue }))
            : undefined,
        };
      }),
    })),
  };
}

export function importProject(
  bundle: ProjectExportBundle,
  options: { mode?: ImportMode; name?: string } = {},
): ImportResult {
  if (!bundle || bundle.version !== EXPORT_VERSION) {
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
        })
        .returning()
        .all();
      apiCount++;

      if (a.callback) {
        const cb = a.callback;
        db.insert(callbackConfigs)
          .values({
            apiId: api.id,
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
      }

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
