import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { FeatureGroup, ID } from '@/types/api';

const KEYS = {
  byProject: (pid: ID) => ['feature-groups', 'project', pid] as const,
};

export function useFeatureGroups(projectId: ID | undefined) {
  return useQuery({
    queryKey: projectId ? KEYS.byProject(projectId) : ['feature-groups', 'project', 'none'],
    queryFn: async () =>
      unwrap(await api.get<FeatureGroup[]>(`/projects/${projectId}/feature-groups`)),
    enabled: !!projectId,
  });
}

export function useCreateFeatureGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      projectId: ID;
      body: { name: string; description?: string | null; sortOrder?: number };
    }) =>
      unwrap(await api.post<FeatureGroup>(`/projects/${vars.projectId}/feature-groups`, vars.body)),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['feature-groups'] });
      qc.invalidateQueries({ queryKey: ['projects', 'detail', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['projects', 'list'] });
    },
  });
}

export function useUpdateFeatureGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: ID;
      data: Partial<{ name: string; description: string | null; sortOrder: number }>;
    }) => unwrap(await api.put<FeatureGroup>(`/feature-groups/${vars.id}`, vars.data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feature-groups'] });
      qc.invalidateQueries({ queryKey: ['projects', 'list'] });
    },
  });
}

export function useDeleteFeatureGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: ID) =>
      unwrap(
        await api.delete<{ id: ID; deleted: true; removedApis: number }>(`/feature-groups/${id}`),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feature-groups'] });
      qc.invalidateQueries({ queryKey: ['projects', 'list'] });
      qc.invalidateQueries({ queryKey: ['mock-apis'] });
    },
  });
}

export function useReorderFeatureGroups() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { projectId: ID; orderedIds: ID[] }) =>
      unwrap(
        await api.patch<{ updated: number }>(
          `/projects/${vars.projectId}/feature-groups/reorder`,
          vars,
        ),
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.byProject(vars.projectId) });
    },
  });
}
