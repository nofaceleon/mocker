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

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'WS' | 'SSE';
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
  script: string | null;
  createdAt: string;
  updatedAt: string;
  mockDataCount?: number;
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