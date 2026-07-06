import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { ID, MockDataRow } from '@/types/api';

const KEYS = {
  byApi: (id: ID) => ['mock-data', 'api', id] as const,
};

export function useMockData(apiId: ID | undefined) {
  return useQuery({
    queryKey: apiId ? KEYS.byApi(apiId) : ['mock-data', 'api', 'none'],
    queryFn: async () => unwrap(await api.get<MockDataRow[]>(`/mock-apis/${apiId}/data`)),
    enabled: !!apiId,
  });
}

export function useCreateMockData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      apiId: ID;
      body: { dataKey?: string | null; dataValue: unknown };
    }) => unwrap(await api.post<MockDataRow>(`/mock-apis/${vars.apiId}/data`, vars.body)),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.byApi(vars.apiId) });
    },
  });
}

export function useUpdateMockData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: ID; apiId: ID; data: { dataKey?: string | null; dataValue?: unknown } }) =>
      unwrap(await api.put<MockDataRow>(`/mock-data/${vars.id}`, vars.data)),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.byApi(vars.apiId) });
    },
  });
}

export function useDeleteMockData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: ID; apiId: ID }) =>
      unwrap(await api.delete<{ id: ID; deleted: true }>(`/mock-data/${vars.id}`)),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.byApi(vars.apiId) });
    },
  });
}