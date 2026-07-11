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
    queryFn: async () =>
      unwrap(
        await api.get<CallbackConfig | null>(`/mock-apis/${apiId}/callback`),
      ),
    enabled: !!apiId,
  });
}

export function useSaveCallbackConfig(apiId: ID) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CallbackConfig) =>
      unwrap(await api.put<CallbackConfig>(`/mock-apis/${apiId}/callback`, body)),
    onSuccess: (data) => {
      qc.setQueryData(KEYS.byApi(apiId), data);
      qc.invalidateQueries({ queryKey: KEYS.root });
      qc.invalidateQueries({ queryKey: ['mock-apis'] });
      qc.invalidateQueries({ queryKey: ['mock-apis', 'detail', apiId] });
    },
  });
}

export function useDeleteCallbackConfig(apiId: ID) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap(await api.delete<{ apiId: ID; deleted: boolean }>(`/mock-apis/${apiId}/callback`)),
    onSuccess: () => {
      qc.setQueryData(KEYS.byApi(apiId), null);
      qc.invalidateQueries({ queryKey: KEYS.root });
      qc.invalidateQueries({ queryKey: ['mock-apis'] });
      qc.invalidateQueries({ queryKey: ['mock-apis', 'detail', apiId] });
    },
  });
}
