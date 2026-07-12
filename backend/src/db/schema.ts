import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * MockHub 数据模型 (对齐 PRD 9.1)
 *
 * 设计约定：
 * - 时间字段统一用 integer + mode 'timestamp_ms' 存毫秒时间戳
 * - 布尔字段用 integer + mode 'boolean'
 * - JSON 字段用 text + mode 'json'，Drizzle 自动序列化/反序列化
 * - 列名用 snake_case，TS 字段用 camelCase
 * - 所有表带 created_at / updated_at（除日志类表只带 created_at）
 * - callback_* 表 P0 不写 CRUD 但保留 schema，便于 P1 扩展
 */

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
};

// ---------------- 1. projects ----------------
export const projects = sqliteTable(
  'projects',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    description: text('description'),
    ...timestamps,
  },
  (t) => [uniqueIndex('uniq_projects_name').on(t.name)],
);

// ---------------- 2. feature_groups ----------------
export const featureGroups = sqliteTable(
  'feature_groups',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('uniq_fg_project_name').on(t.projectId, t.name),
    index('idx_fg_project').on(t.projectId),
  ],
);

// ---------------- 3. mock_apis ----------------
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const PROTOCOLS = ['HTTP', 'WebSocket', 'SSE'] as const;
export type Protocol = (typeof PROTOCOLS)[number];

export const DATA_OPS = ['none', 'insert', 'select', 'update', 'delete'] as const;
export type DataOp = (typeof DATA_OPS)[number];

export const mockApis = sqliteTable(
  'mock_apis',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    featureGroupId: integer('feature_group_id')
      .notNull()
      .references(() => featureGroups.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    protocol: text('protocol', { enum: PROTOCOLS }).notNull().default('HTTP'),
    method: text('method', { enum: HTTP_METHODS }).notNull(),
    path: text('path').notNull(),
    isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),

    // 响应配置
    responseStatus: integer('response_status').notNull().default(200),
    responseDelay: integer('response_delay').notNull().default(0), // 固定延迟 ms
    responseDelayMax: integer('response_delay_max').notNull().default(0), // 随机上限（>0 时启用随机延迟）
    responseContentType: text('response_content_type').notNull().default('application/json'),
    responseHeaders: text('response_headers', { mode: 'json' }).$type<Record<string, string>>(),
    responseBody: text('response_body', { mode: 'json' }).$type<unknown>(),

    // 参数校验规则
    validationRules: text('validation_rules', { mode: 'json' }).$type<ValidationRules>(),

    // 数据联动配置 (P3-10)
    dataOp: text('data_op', { enum: DATA_OPS }).notNull().default('none'),
    dataTable: text('data_table'),
    dataWhere: text('data_where', { mode: 'json' }).$type<Record<string, unknown>>(),
    /** insert/update 写入字段模板，支持 {{req.body.x}}；为空则 insert/update 使用整包 body */
    dataPayload: text('data_payload', { mode: 'json' }).$type<Record<string, unknown> | null>(),

    // 自定义脚本
    script: text('script'),

    ...timestamps,
  },
  (t) => [
    index('idx_apis_fg').on(t.featureGroupId),
    index('idx_apis_method_path').on(t.method, t.path),
  ],
);

// ---------------- 4. mock_data ----------------
export const mockData = sqliteTable(
  'mock_data',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    apiId: integer('api_id')
      .notNull()
      .references(() => mockApis.id, { onDelete: 'cascade' }),
    dataKey: text('data_key'),
    dataValue: text('data_value', { mode: 'json' }).$type<unknown>(),
    ...timestamps,
  },
  (t) => [index('idx_md_api').on(t.apiId)],
);

// ---------------- 5. request_logs ----------------
export const requestLogs = sqliteTable(
  'request_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    apiId: integer('api_id').references(() => mockApis.id, { onDelete: 'set null' }),
    requestMethod: text('request_method'),
    requestPath: text('request_path'),
    requestParams: text('request_params', { mode: 'json' }).$type<unknown>(),
    requestBody: text('request_body', { mode: 'json' }).$type<unknown>(),
    requestHeaders: text('request_headers', { mode: 'json' }).$type<Record<string, string>>(),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    responseTime: integer('response_time'), // ms
    clientIp: text('client_ip'),
    requestId: text('request_id'),
    format: text('format'), // 'http' | 'sse'
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index('idx_rl_api_created').on(t.apiId, t.createdAt),
    index('idx_rl_created').on(t.createdAt),
  ],
);

// ---------------- 6. callback_configs (P0 schema only) ----------------
export const DELAY_TYPES = ['fixed', 'random'] as const;
export const RETRY_STRATEGIES = ['fixed', 'exponential'] as const;

export const callbackConfigs = sqliteTable(
  'callback_configs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    apiId: integer('api_id')
      .notNull()
      .references(() => mockApis.id, { onDelete: 'cascade' }),
    isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(false),
  callbackUrl: text('callback_url'),
  callbackMethod: text('callback_method').notNull().default('POST'),
  callbackHeaders: text('callback_headers', { mode: 'json' }).$type<Record<string, string>>(),
  callbackBody: text('callback_body'),
  delayType: text('delay_type', { enum: DELAY_TYPES }).notNull().default('fixed'),
  delayValue: text('delay_value').notNull().default('0'),
  retryEnabled: integer('retry_enabled', { mode: 'boolean' }).notNull().default(false),
  maxRetries: integer('max_retries').notNull().default(3),
  retryInterval: integer('retry_interval').notNull().default(5000),
  retryStrategy: text('retry_strategy', { enum: RETRY_STRATEGIES }).notNull().default('fixed'),
  retryCondition: text('retry_condition'),
  ...timestamps,
  },
  (t) => [uniqueIndex('uniq_callback_api').on(t.apiId)],
);

// ---------------- 7. callback_tasks (P0 schema only) ----------------
export const CALLBACK_STATUS = ['pending', 'sent', 'failed'] as const;

/** 单次回调尝试记录（请求 + 响应/错误） */
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

export const callbackTasks = sqliteTable(
  'callback_tasks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    callbackConfigId: integer('callback_config_id')
      .notNull()
      .references(() => callbackConfigs.id, { onDelete: 'cascade' }),
    apiId: integer('api_id')
      .notNull()
      .references(() => mockApis.id, { onDelete: 'cascade' }),
    requestId: text('request_id'),
    callbackUrl: text('callback_url').notNull(),
    callbackMethod: text('callback_method').notNull(),
    callbackHeaders: text('callback_headers', { mode: 'json' }).$type<Record<string, string>>(),
    callbackBody: text('callback_body'),
    status: text('status', { enum: CALLBACK_STATUS }).notNull().default('pending'),
    retryCount: integer('retry_count').notNull().default(0),
    maxRetries: integer('max_retries').notNull().default(3),
    nextRetryAt: integer('next_retry_at', { mode: 'timestamp_ms' }),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    errorMessage: text('error_message'),
    /** 每次发送尝试的完整记录（含失败响应） */
    attemptLogs: text('attempt_logs', { mode: 'json' }).$type<CallbackAttemptLog[]>().default([]),
    scheduledAt: integer('scheduled_at', { mode: 'timestamp_ms' }).notNull(),
    sentAt: integer('sent_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (t) => [
    index('idx_ct_status_scheduled').on(t.status, t.scheduledAt),
    index('idx_ct_api_created').on(t.apiId, t.createdAt),
  ],
);

// ---------------- relations ----------------
export const projectsRelations = relations(projects, ({ many }) => ({
  featureGroups: many(featureGroups),
}));

export const featureGroupsRelations = relations(featureGroups, ({ one, many }) => ({
  project: one(projects, { fields: [featureGroups.projectId], references: [projects.id] }),
  apis: many(mockApis),
}));

export const mockApisRelations = relations(mockApis, ({ one, many }) => ({
  featureGroup: one(featureGroups, {
    fields: [mockApis.featureGroupId],
    references: [featureGroups.id],
  }),
  mockData: many(mockData),
  callbackConfigs: many(callbackConfigs),
}));

export const mockDataRelations = relations(mockData, ({ one }) => ({
  api: one(mockApis, { fields: [mockData.apiId], references: [mockApis.id] }),
}));

// ---------------- 类型导出 ----------------
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type FeatureGroup = typeof featureGroups.$inferSelect;
export type NewFeatureGroup = typeof featureGroups.$inferInsert;
export type MockApi = typeof mockApis.$inferSelect;
export type NewMockApi = typeof mockApis.$inferInsert;
export type MockDataRow = typeof mockData.$inferSelect;
export type NewMockDataRow = typeof mockData.$inferInsert;
export type RequestLog = typeof requestLogs.$inferSelect;
export type NewRequestLog = typeof requestLogs.$inferInsert;
export type CallbackConfig = typeof callbackConfigs.$inferSelect;
export type NewCallbackConfig = typeof callbackConfigs.$inferInsert;
export type CallbackTask = typeof callbackTasks.$inferSelect;
export type NewCallbackTask = typeof callbackTasks.$inferInsert;

// ---------------- 参数校验规则 TS 类型 ----------------
export type ValidationRules = {
  isEnabled?: boolean;
  query?: ParamRule[];
  body?: ParamRule[];
  path?: ParamRule[];
  header?: ParamRule[];
  failStatus?: number;
  failMessage?: string;
};

export type ParamRule = {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  pattern?: string; // 正则
  enum?: unknown[]; // 枚举
  refine?: string; // 自定义校验函数（字符串表达式，P0 暂不解析）
};

export const SCHEMA_VERSION = 1;

// 让 TS 推断 sql 模块被使用（防止 tree-shaking 警告）
void sql;