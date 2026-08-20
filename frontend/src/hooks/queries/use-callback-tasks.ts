import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type {
  CallbackStats,
  CallbackTask,
  CallbackTaskPage,
  CallbackTaskStatus,
  ID,
} from '@/types/api';

export type CallbackTaskTimeRange = 'all' | '1h' | '24h' | '7d' | 'custom';

type QueryParams = {
  apiId?: ID;
  status?: CallbackTaskStatus | 'all';
  keyword?: string;
  range?: CallbackTaskTimeRange;
  start?: number;
  end?: number;
  page?: number;
  pageSize?: number;
};

const KEYS = {
  list: (q: QueryParams) => ['callback-tasks', 'list', q] as const,
  detail: (id: ID) => ['callback-tasks', 'detail', id] as const,
  stats: ['callback-tasks', 'stats'] as const,
};

function buildQuery(q: QueryParams): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (q.apiId) out.apiId = q.apiId;
  if (q.status && q.status !== 'all') out.status = q.status;
  if (q.keyword) out.keyword = q.keyword;
  if (q.range && q.range !== 'all') out.range = q.range;
  if (q.start != null) out.start = q.start;
  if (q.end != null) out.end = q.end;
  if (q.page) out.page = q.page;
  if (q.pageSize) out.pageSize = q.pageSize;
  return out;
}

export function useCallbackTasks(query: QueryParams = {}) {
  return useQuery({
    queryKey: KEYS.list(query),
    queryFn: async () =>
      unwrap(
        await api.get<CallbackTaskPage>('/callback-tasks', {
          params: buildQuery(query),
        }),
      ),
  });
}

export function useCallbackTask(taskId: ID | undefined) {
  return useQuery({
    queryKey: taskId ? KEYS.detail(taskId) : (['callback-tasks', 'detail', 'none'] as const),
    queryFn: async () => unwrap(await api.get<CallbackTask>(`/callback-tasks/${taskId}`)),
    enabled: !!taskId,
  });
}

export function useCallbackStats() {
  return useQuery({
    queryKey: KEYS.stats,
    queryFn: async () => unwrap(await api.get<CallbackStats>('/callback-tasks/stats')),
    refetchInterval: 5_000,
  });
}

export function useRetryCallbackTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: ID) =>
      unwrap(await api.post<{ taskId: ID; retrying: true }>(`/callback-tasks/${taskId}/retry`)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['callback-tasks'] });
    },
  });
}

export function useCancelCallbackTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: ID) =>
      unwrap(
        await api.post<{ taskId: ID; cancelled: boolean }>(`/callback-tasks/${taskId}/cancel`),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['callback-tasks'] });
    },
  });
}

export function useBatchDeleteCallbackTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: ID[]) =>
      unwrap(await api.post<{ deleted: number }>('/callback-tasks/batch-delete', { ids })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['callback-tasks'] });
    },
  });
}

export type ClearAllPayload = {
  confirm: true;
  apiId?: ID;
  status?: CallbackTaskStatus;
  keyword?: string;
  range?: CallbackTaskTimeRange;
  start?: number;
  end?: number;
};

/** 按当前筛选条件清除全部任务。confirm 必须为 true 才能执行。 */
export function useClearAllCallbackTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ClearAllPayload) => {
      const body: Record<string, unknown> = { confirm: true };
      if (payload.apiId != null) body.apiId = payload.apiId;
      if (payload.status) body.status = payload.status;
      if (payload.keyword) body.keyword = payload.keyword;
      if (payload.range && payload.range !== 'all') body.range = payload.range;
      if (payload.start != null) body.start = payload.start;
      if (payload.end != null) body.end = payload.end;
      return unwrap(await api.post<{ deleted: number }>('/callback-tasks/clear-all', body));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['callback-tasks'] });
    },
  });
}
