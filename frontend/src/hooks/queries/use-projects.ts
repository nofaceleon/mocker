import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { ID, Project } from '@/types/api';

const KEYS = {
  all: ['projects'] as const,
  list: () => [...KEYS.all, 'list'] as const,
  detail: (id: ID) => [...KEYS.all, 'detail', id] as const,
};

export type ProjectExportBundle = {
  version: 1;
  exportedAt: string;
  project: { name: string; description: string | null };
  featureGroups: unknown[];
};

export type ProjectImportResult = {
  projectId: ID;
  projectName: string;
  created: boolean;
  groups: number;
  apis: number;
  callbacks: number;
  mockDataRows: number;
};

export type ProjectImportMode = 'create' | 'skip' | 'overwrite';

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

export async function exportProjectBundle(
  id: ID,
  opts?: { includeData?: boolean; groups?: ID[] },
): Promise<ProjectExportBundle> {
  const params: Record<string, string> = {};
  if (opts?.includeData) params.includeData = '1';
  if (opts?.groups?.length) params.groups = opts.groups.join(',');
  return unwrap(await api.get<ProjectExportBundle>(`/projects/${id}/export`, { params }));
}

export function useImportProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      bundle: ProjectExportBundle;
      mode?: ProjectImportMode;
      name?: string;
    }) =>
      unwrap(
        await api.post<ProjectImportResult>('/projects/import', {
          bundle: vars.bundle,
          mode: vars.mode ?? 'create',
          name: vars.name,
        }),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ['mock-apis'] });
    },
  });
}