import { eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { getDb } from '../db/index.js';
import { mockApis, type MockApi } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { compileRoute, type CompiledRoute } from './router.js';

export type Candidate = {
  api: MockApi;
  compiled: CompiledRoute;
};

export class RouteRegistry {
  private byId: Map<number, Candidate> = new Map();
  private initialized = false;

  /** 加载所有启用的接口到内存 */
  reload(): void {
    const db = getDb();
    const rows = db.select().from(mockApis).where(eq(mockApis.isEnabled, true)).all();
    this.byId.clear();
    for (const r of rows) {
      this.byId.set(r.id, { api: r, compiled: compileRoute(r.path) });
    }
    this.initialized = true;
    logger.info({ count: rows.length }, 'route registry reloaded');
  }

  /** 重新加载指定功能组下的所有接口（用于 CRUD 后增量更新） */
  reloadFeatureGroup(featureGroupId: number): void {
    const db = getDb();
    const rows = db
      .select()
      .from(mockApis)
      .where(eq(mockApis.featureGroupId, featureGroupId))
      .all();
    // 先删除该 group 旧的所有 candidates
    for (const [id, c] of this.byId) {
      if (c.api.featureGroupId === featureGroupId) this.byId.delete(id);
    }
    // 加回启用项
    for (const r of rows) {
      if (r.isEnabled) this.byId.set(r.id, { api: r, compiled: compileRoute(r.path) });
    }
  }

  /** 单条 upsert：API 创建/更新/启用状态变化时调用 */
  upsert(api: MockApi): void {
    if (api.isEnabled) {
      this.byId.set(api.id, { api, compiled: compileRoute(api.path) });
    } else {
      this.byId.delete(api.id);
    }
  }

  remove(id: number): void {
    this.byId.delete(id);
  }

  /** 返回所有启用 API（按 sortOrder, id 排序） */
  list(): Candidate[] {
    return Array.from(this.byId.values()).sort((a, b) => {
      if (a.api.sortOrder !== b.api.sortOrder) return a.api.sortOrder - b.api.sortOrder;
      return a.api.id - b.api.id;
    });
  }

  /** 第一次访问时若未初始化则自动加载 */
  ensureLoaded(): void {
    if (!this.initialized) this.reload();
  }

  /** 测试用：获取所有候选（包含禁用的，便于调试） */
  size(): number {
    return this.byId.size;
  }
}

export const registry = new RouteRegistry();
