import { and, asc, eq, gt, lte } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import {
  callbackConfigs,
  callbackTasks,
  type CallbackConfig,
  type CallbackTask,
} from '../../db/schema.js';
import { logger } from '../../utils/logger.js';
import {
  callbackEvents,
  enqueueCallbackTask,
  executeTask,
  renderCallbackEnqueueInput,
} from './callback-engine.js';

/** 兜底扫描间隔：30 秒一次，把机器崩溃期间漏掉的任务捞回来 */
const RECOVERY_INTERVAL_MS = 30_000;

export type TaskFinishedPayload = {
  taskId: number;
  apiId: number;
  callbackConfigId: number;
};

class CallbackScheduler {
  private timers = new Map<number, NodeJS.Timeout>();
  private recoveryTimer: NodeJS.Timeout | null = null;
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    callbackEvents.on('retry:scheduled', this.onRetryScheduled);
    callbackEvents.on('task:finished', this.onTaskFinished);
    this.requeueDueTasks();
    this.recoveryTimer = setInterval(() => this.requeueDueTasks(), RECOVERY_INTERVAL_MS);
    logger.info('callback scheduler started');
  }

  stop(): void {
    if (!this.started) return;
    callbackEvents.off('retry:scheduled', this.onRetryScheduled);
    callbackEvents.off('task:finished', this.onTaskFinished);
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    if (this.recoveryTimer) clearInterval(this.recoveryTimer);
    this.recoveryTimer = null;
    this.started = false;
    logger.info('callback scheduler stopped');
  }

  private onRetryScheduled = (taskId: number): void => {
    this.scheduleExisting(taskId);
  };

  /**
   * 任务终态推进：查同 api 下 sortOrder > 当前 cfg 的下一条启用回调，
   * 沿用上一条任务的 templateContext 渲染并入队。失败也不影响主链路。
   */
  private onTaskFinished = (payload: TaskFinishedPayload): void => {
    try {
      const db = getDb();
      const current = db
        .select({ sortOrder: callbackConfigs.sortOrder })
        .from(callbackConfigs)
        .where(eq(callbackConfigs.id, payload.callbackConfigId))
        .get();
      if (!current) return;
      const next = db
        .select()
        .from(callbackConfigs)
        .where(
          and(
            eq(callbackConfigs.apiId, payload.apiId),
            eq(callbackConfigs.isEnabled, true),
            gt(callbackConfigs.sortOrder, current.sortOrder),
          ),
        )
        .orderBy(asc(callbackConfigs.sortOrder), asc(callbackConfigs.id))
        .get();
      if (!next) return;

      const original = db
        .select()
        .from(callbackTasks)
        .where(eq(callbackTasks.id, payload.taskId))
        .get();
      const ctx = (original?.templateContext ?? {}) as Record<string, unknown>;
      const req = (ctx.req ?? {}) as Record<string, unknown>;
      const response = ctx.response ?? null;
      const input = renderCallbackEnqueueInput(next, { req, response });
      if (!input) {
        logger.warn(
          { apiId: payload.apiId, nextConfigId: next.id },
          'chain: next config url rendered empty, skip',
        );
        return;
      }
      const task = enqueueCallbackTask({
        ...input,
        apiId: payload.apiId,
        callbackConfigId: next.id,
        requestId: original?.requestId ?? null,
      });
      if (task) this.scheduleExisting(task.id);
    } catch (err) {
      logger.warn({ err, payload }, 'onTaskFinished failed');
    }
  };

  /** 把该 db 中所有"已到期但未在内存"的 pending 任务挂上定时器 */
  requeueDueTasks(): void {
    try {
      const db = getDb();
      const now = new Date();
      const due = db
        .select()
        .from(callbackTasks)
        .where(and(eq(callbackTasks.status, 'pending'), lte(callbackTasks.scheduledAt, now)))
        .all();

      for (const t of due) {
        if (!this.timers.has(t.id)) this.scheduleExisting(t.id);
      }
    } catch (err) {
      logger.warn({ err }, 'requeueDueTasks failed (db may not be ready)');
    }
  }

  /** 把指定 id 的任务挂上定时器执行（若已挂则忽略） */
  scheduleExisting(taskId: number): void {
    if (this.timers.has(taskId)) return;
    const db = getDb();
    const task = db.select().from(callbackTasks).where(eq(callbackTasks.id, taskId)).get();
    if (!task || task.status !== 'pending') return;
    const cfg =
      db
        .select()
        .from(callbackConfigs)
        .where(eq(callbackConfigs.id, task.callbackConfigId))
        .get() ?? null;
    const ms = task.scheduledAt.getTime() - Date.now();
    this.arm(task, cfg, ms);
  }

  /** 立即挂上定时器（仅内部使用，已知 task 行存在） */
  private arm(task: CallbackTask, cfg: CallbackConfig | null, delayMs: number): void {
    const safeDelay = Math.max(0, delayMs);
    const t = setTimeout(() => {
      this.timers.delete(task.id);
      executeTask(task, cfg).catch((err) => {
        logger.error({ err, taskId: task.id }, 'executeTask rejected');
      });
    }, safeDelay);
    // 不阻止进程退出
    t.unref?.();
    this.timers.set(task.id, t);
    if (safeDelay === 0) {
      logger.info({ taskId: task.id }, 'callback task armed with 0ms delay (immediate)');
    } else {
      logger.debug({ taskId: task.id, delayMs: safeDelay }, 'callback task armed');
    }
  }

  /** 取消已在排队的任务（删除定时器） */
  cancel(taskId: number): void {
    const t = this.timers.get(taskId);
    if (t) {
      clearTimeout(t);
      this.timers.delete(taskId);
    }
  }

  /** 调试：当前在排队的任务数 */
  size(): number {
    return this.timers.size;
  }
}

export const callbackScheduler = new CallbackScheduler();
