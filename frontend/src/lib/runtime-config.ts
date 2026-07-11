/**
 * 运行时配置 — 从后端 /api/admin/health/db 动态获取
 */

interface RuntimeConfig {
  dbPath: string;
  backupDir: string;
  backendPort: number;
  status: string;
}

const defaults: RuntimeConfig = {
  dbPath: '',
  backupDir: '',
  backendPort: 3000,
  status: 'ok',
};

let resolved: RuntimeConfig = { ...defaults };

export const config = {
  get apiBase() {
    return `http://${window.location.hostname}:${resolved.backendPort}`;
  },
  get backendPort() {
    return resolved.backendPort;
  },
  get frontendPort() {
    return Number(window.location.port) || 5173;
  },
  get apiBaseUrl() {
    return '/api';
  },
  get dbPath() {
    return resolved.dbPath;
  },
  get backupDir() {
    return resolved.backupDir;
  },
};

export async function loadRuntimeConfig(): Promise<void> {
  try {
    const res = await fetch('/api/admin/health/db');
    if (res.ok) {
      const data = await res.json();
      const payload = data?.data ?? data;
      if (payload) {
        resolved = { ...defaults, ...payload };
      }
    }
  } catch {
    // 使用默认值
  }
}
