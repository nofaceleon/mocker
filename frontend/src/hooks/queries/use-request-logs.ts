import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type {
  ID,
  RequestLog,
  RequestLogFilters,
  RequestLogPage,
  RequestLogStats,
} from '@/types/api';

export type RequestLogRange = 'all' | '1h' | '24h' | '7d' | 'custom';
export type RequestLogStatusClass = '2xx' | '3xx' | '4xx' | '5xx';
export type RequestLogHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type RequestLogQuery = {
  projectId?: ID;
  apiId?: ID;
  method?: RequestLogHttpMethod;
  statusClass?: RequestLogStatusClass;
  keyword?: string;
  range?: RequestLogRange;
  start?: number;
  end?: number;
  page?: number;
  pageSize?: number;
};

type FiltersQuery = {
  projectId?: ID;
};

const KEYS = {
  list: (q: RequestLogQuery) => ['request-logs', 'list', q] as const,
  detail: (id: ID | undefined) => ['request-logs', 'detail', id] as const,
  stats: (range: RequestLogRange) => ['request-logs', 'stats', range] as const,
  filters: (q: FiltersQuery) => ['request-logs', 'filters', q] as const,
};

function buildQuery(q: RequestLogQuery): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (q.projectId) out.projectId = q.projectId;
  if (q.apiId) out.apiId = q.apiId;
  if (q.method) out.method = q.method;
  if (q.statusClass) out.statusClass = q.statusClass;
  if (q.keyword) out.keyword = q.keyword;
  if (q.range) out.range = q.range;
  if (q.start) out.start = q.start;
  if (q.end) out.end = q.end;
  if (q.page) out.page = q.page;
  if (q.pageSize) out.pageSize = q.pageSize;
  return out;
}

function buildExportQuery(q: RequestLogQuery): Record<string, string | number> {
  const out = buildQuery(q);
  delete out.page;
  delete out.pageSize;
  return out;
}

export function useRequestLogs(query: RequestLogQuery = {}) {
  return useQuery({
    queryKey: KEYS.list(query),
    queryFn: async () =>
      unwrap(
        await api.get<RequestLogPage>('/request-logs', {
          params: buildQuery(query),
        }),
      ),
    refetchInterval: false,
  });
}

export function useRequestLog(id: ID | undefined) {
  return useQuery({
    queryKey: id ? KEYS.detail(id) : (['request-logs', 'detail', 'none'] as const),
    queryFn: async () => unwrap(await api.get<RequestLog>(`/request-logs/${id}`)),
    enabled: !!id,
  });
}

export function useRequestLogStats(range: RequestLogRange = '24h') {
  return useQuery({
    queryKey: KEYS.stats(range),
    queryFn: async () =>
      unwrap(await api.get<RequestLogStats>('/request-logs/stats', { params: { range } })),
    refetchInterval: false,
  });
}

export function useRequestLogFilters(query: FiltersQuery = {}) {
  return useQuery({
    queryKey: KEYS.filters(query),
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (query.projectId) params.projectId = query.projectId;
      return unwrap(await api.get<RequestLogFilters>('/request-logs-filters', { params }));
    },
  });
}

export function useClearRequestLogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ids?: ID[]; projectId?: ID; all?: boolean }) =>
      unwrap(await api.delete<{ deleted: number }>('/request-logs', { data: payload })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request-logs'] });
    },
  });
}

/** 浏览器侧直接打开下载链接（CSV 流式导出） */
export function buildRequestLogExportUrl(query: RequestLogQuery = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(buildExportQuery(query))) {
    if (v !== undefined && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return `/api/request-logs/export${qs ? `?${qs}` : ''}`;
}
