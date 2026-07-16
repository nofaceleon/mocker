import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { HttpMethod, Protocol, ID, MockApi, MockApiResponse, ValidationRules } from '@/types/api';

const KEYS = {
  byGroup: (gid: ID) => ['mock-apis', 'group', gid] as const,
  detail: (id: ID) => ['mock-apis', 'detail', id] as const,
};

export type MockApiPayload = {
  name: string;
  description?: string | null;
  protocol?: Protocol;
  method: HttpMethod;
  path: string;
  isEnabled?: boolean;
  sortOrder?: number;
  responseStatus?: number;
  responseDelay?: number;
  responseDelayMax?: number;
  responseContentType?: string;
  responseHeaders?: Record<string, string> | null;
  responseBody?: unknown;
  validationRules?: ValidationRules | null;
  dataOp?: MockApi['dataOp'];
  dataTable?: string | null;
  dataWhere?: Record<string, unknown> | null;
  dataPayload?: Record<string, unknown> | null;
  script?: string | null;
  responses?: MockApiResponse[] | null;
};

export function useMockApis(featureGroupId: ID | undefined) {
  return useQuery({
    queryKey: featureGroupId ? KEYS.byGroup(featureGroupId) : ['mock-apis', 'group', 'none'],
    queryFn: async () => unwrap(await api.get<MockApi[]>(`/feature-groups/${featureGroupId}/mock-apis`)),
    enabled: !!featureGroupId,
  });
}

export function useMockApi(id: ID | undefined) {
  return useQuery({
    queryKey: id ? KEYS.detail(id) : ['mock-apis', 'detail', 'none'],
    queryFn: async () => unwrap(await api.get<MockApi>(`/mock-apis/${id}`)),
    enabled: !!id,
  });
}

export function useCreateMockApi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { featureGroupId: ID; body: MockApiPayload }) =>
      unwrap(await api.post<MockApi>(`/feature-groups/${vars.featureGroupId}/mock-apis`, vars.body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mock-apis'] });
      qc.invalidateQueries({ queryKey: ['projects', 'list'] });
    },
  });
}

export function useUpdateMockApi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: ID; data: Partial<MockApiPayload> }) =>
      unwrap(await api.put<MockApi>(`/mock-apis/${vars.id}`, vars.data)),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['mock-apis'] });
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.id) });
      qc.invalidateQueries({ queryKey: ['projects', 'list'] });
    },
  });
}

export function useDeleteMockApi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: ID) =>
      unwrap(await api.delete<{ id: ID; deleted: true }>(`/mock-apis/${id}`)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mock-apis'] });
      qc.invalidateQueries({ queryKey: ['projects', 'list'] });
    },
  });
}

export function useToggleMockApi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: ID; isEnabled: boolean }) =>
      unwrap(await api.patch<{ id: ID; isEnabled: boolean }>(`/mock-apis/${vars.id}/toggle`, vars)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mock-apis'] });
      qc.invalidateQueries({ queryKey: ['projects', 'list'] });
    },
  });
}

export type TestApiInput = {
  path?: string;
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
};

export type RouteConflictApi = {
  id: ID;
  name: string;
  method: string;
  path: string;
};

export type RouteConflict = {
  message: string;
  apis: RouteConflictApi[];
  winnerId: ID;
};

export type TestApiOutput = {
  apiId: ID;
  method: HttpMethod;
  path: string;
  responseStatus: number;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  /** method+path 与其它启用接口完全相同时返回 */
  routeConflict?: RouteConflict | null;
};

export function useTestMockApi() {
  return useMutation({
    mutationFn: async (vars: { id: ID; input: TestApiInput }) =>
      unwrap(await api.post<TestApiOutput>(`/mock-apis/${vars.id}/test`, vars.input)),
  });
}