import 'dotenv/config';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import {
  featureGroups,
  mockApis,
  projects,
  type NewFeatureGroup,
  type NewMockApi,
  type NewProject,
} from './schema.js';

const DEMO_PROJECT: NewProject = {
  name: '人脸识别演示',
  description: 'MockHub 内置演示项目：演示数据联动 + HTTP Mock',
};

const DEMO_FEATURE_GROUP: Omit<NewFeatureGroup, 'projectId'> = {
  name: '人脸管理',
  description: '人脸增删改查一组接口',
  sortOrder: 0,
};

const DEMO_APIS: Array<Omit<NewMockApi, 'featureGroupId'>> = [
  {
    name: '人脸增加',
    description: '添加一张人脸记录到数据库',
    method: 'POST',
    path: '/face/add',
    isEnabled: true,
    sortOrder: 0,
    responseStatus: 200,
    responseDelay: 0,
    responseDelayMax: 0,
    responseContentType: 'application/json',
    responseHeaders: {},
    responseBody: {
      code: 0,
      message: 'success',
      data: { id: '{{dbResult.id}}', name: '{{req.body.name}}' },
    },
    validationRules: {
      body: [
        { name: 'name', type: 'string', required: true },
        { name: 'imageUrl', type: 'string', required: true },
      ],
      failStatus: 400,
      failMessage: '参数错误',
    },
    dataOp: 'insert',
    dataTable: 'face_data',
    dataWhere: null,
  },
  {
    name: '人脸列表',
    description: '查询全部人脸记录',
    method: 'GET',
    path: '/face/list',
    isEnabled: true,
    sortOrder: 1,
    responseStatus: 200,
    responseDelay: 0,
    responseDelayMax: 0,
    responseContentType: 'application/json',
    responseHeaders: {},
    responseBody: {
      code: 0,
      message: 'success',
      data: '{{dbResult}}',
    },
    validationRules: {},
    dataOp: 'select',
    dataTable: 'face_data',
    dataWhere: {},
  },
  {
    name: '人脸详情',
    description: '按 ID 查询人脸记录',
    method: 'GET',
    path: '/face/:id',
    isEnabled: true,
    sortOrder: 2,
    responseStatus: 200,
    responseDelay: 0,
    responseDelayMax: 0,
    responseContentType: 'application/json',
    responseHeaders: {},
    responseBody: {
      code: 0,
      message: 'success',
      data: '{{dbResult}}',
    },
    validationRules: {
      path: [{ name: 'id', type: 'string', required: true }],
    },
    dataOp: 'select',
    dataTable: 'face_data',
    dataWhere: {},
  },
  {
    name: '人脸删除',
    description: '按 ID 删除人脸记录',
    method: 'DELETE',
    path: '/face/:id',
    isEnabled: true,
    sortOrder: 3,
    responseStatus: 200,
    responseDelay: 0,
    responseDelayMax: 0,
    responseContentType: 'application/json',
    responseHeaders: {},
    responseBody: { code: 0, message: 'deleted', affected: '{{dbResult.affected}}' },
    validationRules: {
      path: [{ name: 'id', type: 'string', required: true }],
    },
    dataOp: 'delete',
    dataTable: 'face_data',
    dataWhere: {},
  },
];

async function main() {
  const sqlite = new Database(config.db.path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite);

  try {
    // 检查是否已存在 demo 项目
    const existing = db.select().from(projects).all();
    if (existing.some((p) => p.name === DEMO_PROJECT.name)) {
      logger.info(`project "${DEMO_PROJECT.name}" already exists, skipping seed`);
      return;
    }

    // 插入项目
    const [project] = db.insert(projects).values(DEMO_PROJECT).returning().all();
    logger.info({ projectId: project.id, name: project.name }, 'created project');

    // 插入功能组
    const [fg] = db
      .insert(featureGroups)
      .values({ ...DEMO_FEATURE_GROUP, projectId: project.id })
      .returning()
      .all();
    logger.info({ groupId: fg.id, name: fg.name }, 'created feature group');

    // 批量插入接口
    const apiRows = db
      .insert(mockApis)
      .values(DEMO_APIS.map((a) => ({ ...a, featureGroupId: fg.id })))
      .returning()
      .all();
    logger.info({ count: apiRows.length }, 'created mock apis');

    logger.info('✓ seed completed');
  } catch (err) {
    logger.error({ err }, 'seed failed');
    process.exitCode = 1;
  } finally {
    sqlite.close();
  }
}

main();