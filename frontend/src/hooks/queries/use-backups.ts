import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { BackupFile } from '@/types/api';

const KEYS = ['backups'] as const;

export function useBackups() {
  return useQuery({
    queryKey: KEYS,
    queryFn: async () => unwrap(await api.get<BackupFile[]>('/admin/backups')),
  });
}

export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.post<{ path: string; name: string }>('/admin/backup')),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS }),
  });
}

export function useRestoreBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      unwrap(await api.post<{ restoredFrom: string; dbPath: string }>('/admin/restore', { name })),
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}

export function useDeleteBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      unwrap(await api.delete<{ name: string; deleted: true }>(`/admin/backups/${name}`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS }),
  });
}
