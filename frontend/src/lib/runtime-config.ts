/**
 * 运行时配置（来自 .env 或后端 /admin/health/db）
 * P0 阶段：硬编码默认值 + 显示给用户
 */

export const config = {
  dbPath: '/Users/songjiansheng/Desktop/mocker/data/mock.db',
  backupDir: '/Users/songjiansheng/Desktop/mocker/data/backups',
  apiBase: 'http://localhost:3001',
  frontendPort: 5173,
  backendPort: 3001,
  apiBaseUrl: '/api',
};
