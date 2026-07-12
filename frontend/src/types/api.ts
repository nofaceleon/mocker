// 后端共享类型（与 backend/src/db/schema.ts 对齐）
// P0 阶段先在前端手维护，P1 再抽 packages/shared 包。

export type ID = number;

export type Project = {
  id: ID;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  featureGroupCount?: number;
  apiCount?: number;
  callCount?: number;
};

export type FeatureGroup = {
  id: ID;
  projectId: ID;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
export type Protocol = 'HTTP' | 'WebSocket' | 'SSE';
export type DataOp = 'none' | 'insert' | 'select' | 'update' | 'delete';

export type ParamType = 'string' | 'number' | 'boolean' | 'array' | 'object';
export type ParamLocation = 'query' | 'body' | 'path' | 'header';

export type ValidationParamRule = {
  name: string;
  type: ParamType;
  required?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: unknown[];
  refine?: string;
};

export type ValidationRules = {
  isEnabled?: boolean;
  query?: ValidationParamRule[];
  body?: ValidationParamRule[];
  path?: ValidationParamRule[];
  header?: ValidationParamRule[];
  failStatus?: number;
  failMessage?: string;
};

export type MockApi = {
  id: ID;
  featureGroupId: ID;
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
  validationRules: ValidationRules | null;
  dataOp: DataOp;
  dataTable: string | null;
  dataWhere: Record<string, unknown> | null;
  /** insert/update 写入模板，支持 {{req.body.x}}；null 则用整包 body */
  dataPayload: Record<string, unknown> | null;
  script: string | null;
  createdAt: string;
  updatedAt: string;
  mockDataCount?: number;
  fullPath?: string;
  fullUrl?: string;
  hasCallback?: boolean;
};

export type MockDataRow = {
  id: ID;
  apiId: ID;
  dataKey: string | null;
  dataValue: unknown;
  createdAt: string;
  updatedAt: string;
};

export type DataBrowserColumn = {
  name: string;
  type: string;
  notnull: boolean;
  pk: boolean;
};

export type DataBrowserTable = {
  name: string;
  columns: DataBrowserColumn[];
  rows: unknown[];
  rowCount: number;
};

export type DataBrowserResponse = {
  businessTables: DataBrowserTable[];
  mockData: MockDataRow[];
  apis: Array<{
    id: ID;
    name: string;
    method: HttpMethod;
    path: string;
    dataOp: DataOp;
    dataTable: string | null;
    featureGroupId: ID;
  }>;
};

export type BackupFile = {
  name: string;
  path: string;
  size: number;
  mtime: string;
};

// ---------- Swagger 导入相关 ----------
export type SwaggerImportOpenApiVersion = '2.0' | '3.0' | 'unknown';

export type SwaggerImportConflict = {
  kind: 'route' | 'name';
  existingId: ID;
  existingName: string;
  existingMethod: HttpMethod;
  existingPath: string;
};

export type SwaggerImportItem = {
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
  conflict: SwaggerImportConflict | null;
};

export type SwaggerImportSpecInfo = {
  title: string;
  version: string;
  openApiVersion: SwaggerImportOpenApiVersion;
  baseUrl: string;
};

export type SwaggerImportParseResponse = {
  specInfo: SwaggerImportSpecInfo;
  items: SwaggerImportItem[];
  summary: {
    total: number;
    supported: number;
    conflicts: number;
  };
};

export type SwaggerImportDecisionAction = 'create' | 'overwrite' | 'skip';

export type SwaggerImportDecision = {
  index: number;
  action: SwaggerImportDecisionAction;
  name?: string;
  path?: string;
};

export type SwaggerImportCommitResponse = {
  created: number;
  overwritten: number;
  skipped: number;
  errors: Array<{ index: number; reason: string }>;
};

// ---------- 延迟回调 ----------

export type CallbackConditionPreset = 'always' | 'server_error' | 'success_only' | 'custom';

export type CallbackConfig = {
  isEnabled: boolean;
  callbackUrl: string;
  callbackMethod: HttpMethod;
  callbackHeaders: Record<string, string>;
  callbackBody: string;
  delayType: 'fixed' | 'random';
  delayValue: string; // "5000" 或 "3000-8000"
  retryEnabled: boolean;
  maxRetries: number;
  retryInterval: number;
  retryStrategy: 'fixed' | 'exponential';
  retryCondition: CallbackConditionPreset;
  /** 当 retryCondition === 'custom' 时生效；如 "statusCode != 200" */
  retryConditionExpr?: string;
};

export type CallbackTaskStatus = 'pending' | 'sent' | 'failed';

export type CallbackAttemptLog = {
  attempt: number;
  at: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string> | null;
    body: string | null;
  };
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  outcome: 'success' | 'failed' | 'will_retry';
};

export type CallbackTask = {
  id: number;
  apiId: number;
  projectId: number | null;
  apiName: string | null;
  apiMethod: string | null;
  apiPath: string | null;
  callbackUrl: string;
  callbackMethod: string;
  callbackHeaders: Record<string, string> | null;
  callbackBody: string | null;
  status: CallbackTaskStatus;
  retryCount: number;
  maxRetries: number;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  attemptLogs?: CallbackAttemptLog[] | null;
  scheduledAt: string;
  sentAt: string | null;
  createdAt: string;
  requestId: string | null;
};

export type CallbackTaskPage = {
  items: CallbackTask[];
  total: number;
  page: number;
  pageSize: number;
};

export type CallbackStats = {
  pending: number;
  sent: number;
  failed: number;
  total: number;
};

// ---------- 调用日志 ----------
export type RequestLogStatusKind = 'success' | 'warning' | 'danger' | 'info';

export type RequestLog = {
  id: ID;
  apiId: ID | null;
  apiName: string | null;
  apiMethod: string | null;
  apiPath: string | null;
  featureGroupId: ID | null;
  projectId: ID | null;
  projectName: string | null;
  method: string;
  path: string;
  status: number;
  statusKind: RequestLogStatusKind;
  responseTime: number;
  responseSize: number;
  clientIp: string | null;
  requestId: string | null;
  format: 'http' | 'sse' | null;
  createdAt: string;
  requestParams: unknown;
  requestBody: unknown;
  requestHeaders: Record<string, string> | null;
  responseBody: string | null;
};

export type RequestLogPage = {
  items: RequestLog[];
  total: number;
  page: number;
  pageSize: number;
};

export type RequestLogStatusDistribution = {
  '2xx': number;
  '3xx': number;
  '4xx': number;
  '5xx': number;
  other: number;
};

export type RequestLogTrendPoint = {
  date: string; // MM-DD
  http: number;
  ws: number;
  sse: number;
};

export type RequestLogStats = {
  total: number;
  today: number;
  avgMs: number;
  successRate: number;
  statusDistribution: RequestLogStatusDistribution;
  trendPoints: RequestLogTrendPoint[];
};

export type RequestLogFilters = {
  projects: Array<{ id: ID; name: string }>;
  apis: Array<{ id: ID; name: string; method: string; path: string; projectId: ID | null }>;
};