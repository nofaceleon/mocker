import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { ID, Project } from '@/types/api';

const KEYS = {
  all: ['projects'] as const,
  list: () => [...KEYS.all, 'list'] as const,
  detail: (id: ID) => [...KEYS.all, 'detail', id] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: async () => unwrap(await api.get<Project[]>('/projects')),
  });
}

export function useProject(id: ID | undefined) {
  return useQuery({
    queryKey: id ? KEYS.detail(id) : ['projects', 'detail', 'none'],
    queryFn: async () => unwrap(await api.get<Project & { featureGroups: unknown[] }>(`/projects/${id}`)),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; description?: string | null }) =>
      unwrap(await api.post<Project>('/projects', body)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: ID; data: Partial<{ name: string; description: string | null }> }) =>
      unwrap(await api.put<Project>(`/projects/${vars.id}`, vars.data)),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.id) });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: ID) => unwrap(await api.delete<{ id: ID; deleted: true }>(`/projects/${id}`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}