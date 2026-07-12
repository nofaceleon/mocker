import { createApp } from './app.js';
import { config } from './config/index.js';
import { getDb } from './db/index.js';
import { logger } from './utils/logger.js';
import { callbackScheduler } from './mock-engine/callback/callback-scheduler.js';
import { attachWebSocketServer } from './mock-engine/websocket.js';

// 预热数据库：建库 + 应用迁移，失败则快速退出
getDb();

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(
    {
      env: config.env,
      port: config.port,
      dbPath: config.db.path,
    },
    'MockHub backend started',
  );
});

// WebSocket Mock（与 HTTP 同端口 upgrade）
attachWebSocketServer(server);

// 启动回调调度器（持久化扫描 + 兜底重排）
callbackScheduler.start();

function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down');
  callbackScheduler.stop();
  server.close((err) => {
    if (err) {
      logger.error({ err }, 'error during shutdown');
      process.exit(1);
    }
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn('forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandled rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception');
  process.exit(1);
});