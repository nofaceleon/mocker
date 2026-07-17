import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { ID } from '@/types/api';
import type { CallbackConfig } from '@/types/api';

const KEYS = {
  root: ['callback-config'] as const,
  byApi: (apiId: ID) => ['callback-config', 'api', apiId] as const,
};

export function useCallbackConfig(apiId: ID | undefined) {
  return useQuery({
    queryKey: apiId ? KEYS.byApi(apiId) : (['callback-config', 'api', 'none'] as const),
    queryFn: async () => unwrap(await api.get<CallbackConfig[]>(`/mock-apis/${apiId}/callbacks`)),
    enabled: !!apiId,
  });
}

/** 整组保存（diff：新增 / 更新 / 删除） */
export function useSaveCallbackConfig(apiId: ID) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: CallbackConfig[]) =>
      unwrap(await api.put<CallbackConfig[]>(`/mock-apis/${apiId}/callbacks`, { items })),
    onSuccess: (data) => {
      qc.setQueryData(KEYS.byApi(apiId), data);
      qc.invalidateQueries({ queryKey: KEYS.root });
      qc.invalidateQueries({ queryKey: ['mock-apis'] });
      qc.invalidateQueries({ queryKey: ['mock-apis', 'detail', apiId] });
    },
  });
}

/** 单条删除 */
export function useDeleteSingleCallback(apiId: ID) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (callbackId: ID) =>
      unwrap(
        await api.delete<{ apiId: ID; callbackId: ID; deleted: boolean }>(
          `/mock-apis/${apiId}/callbacks/${callbackId}`,
        ),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.byApi(apiId) });
      qc.invalidateQueries({ queryKey: ['mock-apis'] });
      qc.invalidateQueries({ queryKey: ['mock-apis', 'detail', apiId] });
    },
  });
}

/** 删除整组（兼容旧用法：直接清空当前 api 所有回调） */
export function useDeleteCallbackConfig(apiId: ID) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap(await api.put<CallbackConfig[]>(`/mock-apis/${apiId}/callbacks`, { items: [] })),
    onSuccess: () => {
      qc.setQueryData(KEYS.byApi(apiId), []);
      qc.invalidateQueries({ queryKey: KEYS.root });
      qc.invalidateQueries({ queryKey: ['mock-apis'] });
      qc.invalidateQueries({ queryKey: ['mock-apis', 'detail', apiId] });
    },
  });
}
