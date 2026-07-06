import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { DataBrowserResponse, ID } from '@/types/api';

export function useDataBrowser(projectId: ID | undefined) {
  return useQuery({
    queryKey: projectId ? ['data-browser', projectId] : ['data-browser', 'none'],
    queryFn: async () =>
      unwrap(await api.get<DataBrowserResponse>(`/projects/${projectId}/data-browser`)),
    enabled: !!projectId,
  });
}

export function useBusinessTables() {
  return useQuery({
    queryKey: ['data-browser', 'tables'],
    queryFn: async () =>
      unwrap(await api.get<Array<{ name: string; columns: unknown[] }>>('/data-browser/tables')),
  });
}

export type TableQueryResult = {
  table: string;
  columns: unknown[];
  rows: unknown[];
  total: number;
  page: number;
  pageSize: number;
};

export function useBusinessTableRows(tableName: string | undefined, q?: string) {
  return useQuery({
    queryKey: ['data-browser', 'table', tableName, q ?? ''],
    queryFn: async () =>
      unwrap(await api.get<TableQueryResult>(`/data-browser/tables/${tableName}`, { params: { q } })),
    enabled: !!tableName,
  });
}

/** 触发任意业务表/数据失效 */
export function useInvalidateDataBrowser() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['data-browser'] });
}