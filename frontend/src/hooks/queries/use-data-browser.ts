import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { DataBrowserColumn, DataBrowserResponse, ID } from '@/types/api';

export type BusinessTableMeta = {
  name: string;
  columns: DataBrowserColumn[];
  rowCount: number;
};

export type TableQueryResult = {
  table: string;
  columns: DataBrowserColumn[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
};

const KEYS = {
  project: (id: ID) => ['data-browser', 'project', id] as const,
  tables: ['data-browser', 'tables'] as const,
  tableRows: (name: string, page: number, pageSize: number, q: string) =>
    ['data-browser', 'table', name, page, pageSize, q] as const,
};

export function useDataBrowser(projectId: ID | undefined) {
  return useQuery({
    queryKey: projectId ? KEYS.project(projectId) : ['data-browser', 'project', 'none'],
    queryFn: async () =>
      unwrap(await api.get<DataBrowserResponse>(`/projects/${projectId}/data-browser`)),
    enabled: !!projectId,
  });
}

export function useBusinessTables() {
  return useQuery({
    queryKey: KEYS.tables,
    queryFn: async () => unwrap(await api.get<BusinessTableMeta[]>('/data-browser/tables')),
  });
}

export function useBusinessTableRows(
  tableName: string | undefined,
  opts?: { page?: number; pageSize?: number; q?: string },
) {
  const page = opts?.page ?? 1;
  const pageSize = opts?.pageSize ?? 50;
  const q = opts?.q ?? '';
  return useQuery({
    queryKey: tableName
      ? KEYS.tableRows(tableName, page, pageSize, q)
      : ['data-browser', 'table', 'none'],
    queryFn: async () =>
      unwrap(
        await api.get<TableQueryResult>(`/data-browser/tables/${tableName}`, {
          params: { page, pageSize, ...(q ? { q } : {}) },
        }),
      ),
    enabled: !!tableName,
  });
}

export function useUpdateBusinessRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      table: string;
      rowId: number;
      patch: Record<string, string | number | boolean | null>;
    }) =>
      unwrap(
        await api.patch<{ table: string; id: number; row: Record<string, unknown> }>(
          `/data-browser/tables/${vars.table}/rows/${vars.rowId}`,
          vars.patch,
        ),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-browser'] });
    },
  });
}

export function useDeleteBusinessRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { table: string; rowId: number }) =>
      unwrap(
        await api.delete<{ table: string; id: number; deleted: true }>(
          `/data-browser/tables/${vars.table}/rows/${vars.rowId}`,
        ),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-browser'] });
    },
  });
}

export function useClearBusinessTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (table: string) =>
      unwrap(
        await api.post<{ table: string; cleared: true; affected: number }>(
          `/data-browser/tables/${table}/clear`,
        ),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-browser'] });
    },
  });
}

export function useDropBusinessTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (table: string) =>
      unwrap(await api.delete<{ table: string; deleted: true }>(`/data-browser/tables/${table}`)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-browser'] });
    },
  });
}

export type ColumnType = 'TEXT' | 'REAL' | 'INTEGER' | 'BLOB';

export type CreateTableColumn = { name: string; type?: ColumnType };

export function useCreateBusinessTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { name: string; columns?: CreateTableColumn[] }) =>
      unwrap(
        await api.post<BusinessTableMeta>('/data-browser/tables', {
          name: vars.name,
          columns: vars.columns ?? [],
        }),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-browser'] });
    },
  });
}

export function useInsertBusinessRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      table: string;
      row: Record<string, string | number | boolean | null>;
    }) =>
      unwrap(
        await api.post<{ table: string; id: number; row: Record<string, unknown> }>(
          `/data-browser/tables/${vars.table}/rows`,
          vars.row,
        ),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-browser'] });
    },
  });
}

export function useAddBusinessColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { table: string; name: string; type?: ColumnType }) =>
      unwrap(
        await api.post<{ table: string; columns: DataBrowserColumn[] }>(
          `/data-browser/tables/${vars.table}/columns`,
          { name: vars.name, type: vars.type ?? 'TEXT' },
        ),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-browser'] });
    },
  });
}

export function useRenameBusinessColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { table: string; columnName: string; newName: string }) =>
      unwrap(
        await api.patch<{ table: string; columns: DataBrowserColumn[] }>(
          `/data-browser/tables/${vars.table}/columns/${vars.columnName}`,
          { newName: vars.newName },
        ),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-browser'] });
    },
  });
}

export function useDropBusinessColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { table: string; columnName: string }) =>
      unwrap(
        await api.delete<{ table: string; columns: DataBrowserColumn[]; dropped: string }>(
          `/data-browser/tables/${vars.table}/columns/${vars.columnName}`,
        ),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-browser'] });
    },
  });
}

export function useInvalidateDataBrowser() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['data-browser'] });
}
