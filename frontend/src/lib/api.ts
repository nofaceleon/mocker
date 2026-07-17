import axios, { type AxiosError, type AxiosInstance, type AxiosResponse } from 'axios';
import { toast } from 'sonner';

export type ApiSuccess<T> = {
  code: 'OK';
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiErrorBody = {
  code: string;
  message: string;
  details?: unknown;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: '/api',
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.response.use(
    (response: AxiosResponse<ApiSuccess<unknown>>) => response,
    (err: AxiosError<ApiErrorBody>) => {
      const status = err.response?.status ?? 0;
      const body = err.response?.data;
      const message = body?.message ?? err.message ?? '请求失败';

      // 业务错误透传给调用方（让 useMutation 自己处理）
      // 系统级错误（500/网络）弹 toast
      if (status === 0 || status >= 500) {
        toast.error(`服务异常: ${message}`);
      } else if (status === 401 || status === 403) {
        toast.error('没有权限');
      } else if (status >= 400 && status < 500) {
        // 业务错误（4xx）不弹 toast，由调用方决定如何展示
      }
      return Promise.reject(new ApiError(status, body?.code ?? 'UNKNOWN', message, body?.details));
    },
  );

  return client;
}

export const api = createApiClient();

/** 通用列表 hook 帮手：解析 ApiSuccess 包装 */
export function unwrap<T>(resp: AxiosResponse<T>): T {
  // 服务端实际返回 {code, data, meta} 包装；这里直接信任 data 字段
  // 因为 axios.get<T>(...) 的 T 表示 data 字段的类型
  // 类型适配：实际 resp.data 是 ApiSuccess<T>，但 axios 把 T 当作 data 的类型
  // 所以这里走一个内部转换
  const raw = resp.data as unknown;
  if (raw && typeof raw === 'object' && 'data' in (raw as Record<string, unknown>)) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

/** 直接拿到完整 ApiSuccess 响应 */
export function unwrapFull<T>(resp: AxiosResponse<unknown>): ApiSuccess<T> {
  return resp.data as ApiSuccess<T>;
}
