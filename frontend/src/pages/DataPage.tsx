import { useEffect, useMemo, useState } from 'react';
import {
  Columns3,
  Database as DatabaseIcon,
  Link2,
  Pencil,
  Plus,
  Search,
  Table as TableIcon,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  Empty,
  FormField,
  Input,
  Modal,
  PageHeader,
  Select,
  StatCard,
  confirm,
} from '@/components/ui';
import {
  useAddBusinessColumn,
  useBusinessTableRows,
  useBusinessTables,
  useClearBusinessTable,
  useCreateBusinessTable,
  useDataBrowser,
  useDeleteBusinessRow,
  useDropBusinessColumn,
  useDropBusinessTable,
  useInsertBusinessRow,
  useRenameBusinessColumn,
  useUpdateBusinessRow,
  type BusinessTableMeta,
  type ColumnType,
  type CreateTableColumn,
} from '@/hooks/queries/use-data-browser';
import { useProjects } from '@/hooks/queries/use-projects';
import type { DataBrowserColumn, ID } from '@/types/api';

const RESERVED_COLS = new Set(['id', 'created_at', 'updated_at']);

const PAGE_SIZE = 50;

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function DataPage() {
  const { data: projects } = useProjects();
  const [projectId, setProjectId] = useState<ID | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // 默认选中第一个项目（若有）
  useEffect(() => {
    if (projectId === 'all' && projects && projects.length === 1) {
      setProjectId(projects[0].id);
    }
  }, [projects, projectId]);

  const { data: allTables, isLoading: loadingAll } = useBusinessTables();
  const numericProjectId = projectId === 'all' ? undefined : projectId;
  const { data: projectData, isLoading: loadingProject } = useDataBrowser(numericProjectId);

  const tableList: BusinessTableMeta[] = useMemo(() => {
    if (projectId === 'all') {
      return (allTables ?? []).map((t) => ({
        name: t.name,
        columns: t.columns,
        rowCount: t.rowCount ?? 0,
      }));
    }
    return (projectData?.businessTables ?? []).map((t) => ({
      name: t.name,
      columns: t.columns,
      rowCount: t.rowCount ?? 0,
    }));
  }, [projectId, allTables, projectData]);

  const filteredTables = useMemo(() => {
    if (!search) return tableList;
    const q = search.toLowerCase();
    return tableList.filter((t) => t.name.toLowerCase().includes(q));
  }, [tableList, search]);

  // 切换项目/列表变化时校正选中表
  useEffect(() => {
    if (filteredTables.length === 0) {
      setSelectedTable(null);
      return;
    }
    if (!selectedTable || !filteredTables.some((t) => t.name === selectedTable)) {
      setSelectedTable(filteredTables[0].name);
    }
  }, [filteredTables, selectedTable]);

  const activeMeta = filteredTables.find((t) => t.name === selectedTable) ?? null;
  const totalRows = tableList.reduce((sum, t) => sum + (t.rowCount ?? 0), 0);
  const linkedApis = useMemo(() => {
    if (!selectedTable || !projectData?.apis) return [];
    return projectData.apis.filter((a) => a.dataTable === selectedTable);
  }, [selectedTable, projectData?.apis]);

  const isLoading = projectId === 'all' ? loadingAll : loadingProject;

  return (
    <div className="page-container">
      <PageHeader
        title="数据管理"
        description="查看、编辑与清理数据联动产生的业务表数据"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-ink-tertiary">项目</span>
            <Select
              className="min-w-[180px]"
              value={projectId === 'all' ? 'all' : String(projectId)}
              onChange={(e) => {
                const v = e.target.value;
                setProjectId(v === 'all' ? 'all' : Number(v));
                setSelectedTable(null);
              }}
            >
              <option value="all">全部业务表</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              新建表
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="业务表" value={tableList.length} icon={<TableIcon />} />
        <StatCard label="总行数" value={totalRows} hint="当前范围内累计" icon={<DatabaseIcon />} />
        <StatCard
          label="关联接口"
          value={
            projectId === 'all' ? '—' : (projectData?.apis.filter((a) => a.dataTable).length ?? 0)
          }
          hint={projectId === 'all' ? '选择项目后显示' : '配置了 dataTable 的接口'}
          icon={<Link2 />}
        />
      </div>

      <div className="grid min-h-[500px] grid-cols-12 gap-4">
        <aside className="col-span-12 md:col-span-3">
          <Card
            title={
              <span className="inline-flex items-center gap-2">
                数据表 <span className="text-ink-subtle">· {filteredTables.length}</span>
              </span>
            }
            noBody
          >
            <div className="border-b border-line-subtle p-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-subtle" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索表…"
                  className="form-input h-7 pl-7 text-[12px]"
                />
              </div>
            </div>
            <ul className="max-h-[480px] overflow-y-auto p-1.5 scrollbar-modern">
              {isLoading ? (
                <li className="px-3 py-6 text-center text-[12px] text-ink-subtle">加载中…</li>
              ) : filteredTables.length === 0 ? (
                <li className="px-3 py-6 text-center text-[12px] text-ink-subtle">
                  {search
                    ? '没有匹配的表'
                    : projectId === 'all'
                      ? '还没有业务表，点击右上角「新建表」创建'
                      : '该项目下接口未引用业务表'}
                </li>
              ) : (
                filteredTables.map((t) => (
                  <li key={t.name}>
                    <button
                      type="button"
                      onClick={() => setSelectedTable(t.name)}
                      className={`group flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                        activeMeta?.name === t.name
                          ? 'bg-canvas-deep font-medium text-ink-inverse'
                          : 'text-ink-secondary hover:bg-canvas-subtle hover:text-ink'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <TableIcon className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate font-mono">{t.name}</span>
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-px text-[10px] font-medium ${
                          activeMeta?.name === t.name
                            ? 'bg-white/15 text-ink-inverse'
                            : 'bg-canvas-subtle text-ink-tertiary'
                        }`}
                      >
                        {t.rowCount}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </aside>

        <section className="col-span-12 md:col-span-9">
          {selectedTable ? (
            <TableDetail
              tableName={selectedTable}
              columnsHint={activeMeta?.columns}
              linkedApis={linkedApis}
              onTableDropped={() => setSelectedTable(null)}
            />
          ) : (
            <Card>
              <Empty
                title="未选择数据表"
                description="在左侧选择一个业务表查看其行数据与列结构，或点击右上角新建表"
                icon={<DatabaseIcon className="h-10 w-10 text-ink-subtle" />}
              />
            </Card>
          )}
        </section>
      </div>

      {createOpen && (
        <CreateTableModal
          onClose={() => setCreateOpen(false)}
          onCreated={(name) => {
            setProjectId('all');
            setSelectedTable(name);
            setCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CreateTableModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const createMut = useCreateBusinessTable();
  const [name, setName] = useState('');
  const [columns, setColumns] = useState<Array<{ name: string; type: ColumnType }>>([
    { name: '', type: 'TEXT' },
  ]);

  const addColumnRow = () => {
    setColumns((cols) => [...cols, { name: '', type: 'TEXT' }]);
  };

  const updateColumn = (index: number, patch: Partial<{ name: string; type: ColumnType }>) => {
    setColumns((cols) => cols.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const removeColumn = (index: number) => {
    setColumns((cols) => (cols.length <= 1 ? cols : cols.filter((_, i) => i !== index)));
  };

  const handleSubmit = async () => {
    const tableName = name.trim();
    if (!IDENT_RE.test(tableName)) {
      toast.error('表名仅允许字母/数字/下划线，且不能以数字开头');
      return;
    }

    const prepared: CreateTableColumn[] = [];
    const seen = new Set<string>();
    for (const c of columns) {
      const colName = c.name.trim();
      if (!colName) continue;
      if (!IDENT_RE.test(colName)) {
        toast.error(`列名「${colName}」格式不正确`);
        return;
      }
      if (RESERVED_COLS.has(colName)) {
        toast.error(`列名「${colName}」为系统保留字段，会自动创建`);
        return;
      }
      if (seen.has(colName)) {
        toast.error(`列名「${colName}」重复`);
        return;
      }
      seen.add(colName);
      prepared.push({ name: colName, type: c.type });
    }

    try {
      const result = await createMut.mutateAsync({ name: tableName, columns: prepared });
      toast.success(`表 ${result.name} 已创建`);
      onCreated(result.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建表失败');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="新建业务表"
      width="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" loading={createMut.isPending} onClick={handleSubmit}>
            创建
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-[12px] text-ink-tertiary">
          系统会自动附加 <code className="param-code">id</code> /{' '}
          <code className="param-code">created_at</code> /{' '}
          <code className="param-code">updated_at</code> 列。业务列可稍后在「修改字段」中继续调整。
        </p>

        <FormField label="表名" required>
          <Input
            className="mono"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如 users / face_records"
            autoFocus
          />
        </FormField>

        <div className="rounded-md border border-line">
          <div className="flex items-center justify-between border-b border-line-subtle bg-canvas-subtle/40 px-3 py-2">
            <span className="text-[12.5px] font-medium text-ink">业务列（可选）</span>
            <Button variant="ghost" size="sm" onClick={addColumnRow}>
              <Plus className="h-3 w-3" />
              添加列
            </Button>
          </div>
          <div className="space-y-2 p-3">
            {columns.map((col, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <FormField
                  label={index === 0 ? '列名' : undefined}
                  className="min-w-[160px] flex-1"
                >
                  <Input
                    className="mono"
                    value={col.name}
                    onChange={(e) => updateColumn(index, { name: e.target.value })}
                    placeholder="例如 name"
                  />
                </FormField>
                <FormField label={index === 0 ? '类型' : undefined} className="w-[140px]">
                  <Select
                    value={col.type}
                    onChange={(e) => updateColumn(index, { type: e.target.value as ColumnType })}
                  >
                    <option value="TEXT">TEXT</option>
                    <option value="REAL">REAL</option>
                    <option value="INTEGER">INTEGER</option>
                    <option value="BLOB">BLOB</option>
                  </Select>
                </FormField>
                <Button
                  variant="ghost"
                  size="sm"
                  className="!text-danger"
                  disabled={columns.length <= 1}
                  onClick={() => removeColumn(index)}
                  title="移除"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function TableDetail({
  tableName,
  columnsHint,
  linkedApis,
  onTableDropped,
}: {
  tableName: string;
  columnsHint?: DataBrowserColumn[];
  linkedApis: Array<{ id: number; name: string; method: string; path: string }>;
  onTableDropped?: () => void;
}) {
  const [q, setQ] = useState('');
  const [qApplied, setQApplied] = useState('');
  const [page, setPage] = useState(1);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);

  useEffect(() => {
    setQ('');
    setQApplied('');
    setPage(1);
    setSchemaOpen(false);
    setInsertOpen(false);
  }, [tableName]);

  const { data, isLoading, isFetching } = useBusinessTableRows(tableName, {
    page,
    pageSize: PAGE_SIZE,
    q: qApplied,
  });
  const deleteMut = useDeleteBusinessRow();
  const updateMut = useUpdateBusinessRow();
  const clearMut = useClearBusinessTable();
  const dropTableMut = useDropBusinessTable();

  const columns = data?.columns ?? columnsHint ?? [];
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const handleSearch = () => {
    setQApplied(q.trim());
    setPage(1);
  };

  const handleClear = async () => {
    const ok = await confirm({
      title: '清空表',
      message: (
        <span>
          确定清空业务表 <b className="font-mono">{tableName}</b> 的全部 {total}{' '}
          行数据吗？表结构将保留。
        </span>
      ),
      confirmText: '清空',
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await clearMut.mutateAsync(tableName);
      toast.success(`已清空 ${r.affected} 行`);
      setPage(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '清空失败');
    }
  };

  const handleDeleteRow = async (rowId: number) => {
    const ok = await confirm({
      title: '删除记录',
      message: (
        <span>
          确定删除 <b className="font-mono">{tableName}</b> 中 id={rowId} 的行吗？
        </span>
      ),
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync({ table: tableName, rowId });
      toast.success('已删除');
      if (rows.length === 1 && page > 1) setPage((p) => p - 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleUpdateCell = async (rowId: number, column: string, raw: string, colType: string) => {
    try {
      const value = parseCellInput(raw, colType);
      await updateMut.mutateAsync({
        table: tableName,
        rowId,
        patch: { [column]: value },
      });
      toast.success('已保存');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
      throw err;
    }
  };

  const handleDropTable = async () => {
    const ok = await confirm({
      title: '删除表',
      message: (
        <span>
          确定<strong className="text-danger">永久删除</strong>业务表{' '}
          <b className="font-mono">{tableName}</b> 及其全部数据吗？此操作不可恢复。
        </span>
      ),
      confirmText: '删除表',
      danger: true,
    });
    if (!ok) return;
    try {
      await dropTableMut.mutateAsync(tableName);
      toast.success(`表 ${tableName} 已删除`);
      onTableDropped?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除表失败');
    }
  };

  return (
    <Card
      noBody
      title={
        <div className="flex flex-wrap items-center gap-2">
          <DatabaseIcon className="h-3.5 w-3.5 text-ink-tertiary" />
          <span className="font-mono text-ink-subtle">/</span>
          <span className="font-mono text-ink">{tableName}</span>
          <span className="tag tag-blue">业务表</span>
          {columns.some((c) => c.pk) && <span className="tag tag-orange">PK</span>}
        </div>
      }
      extra={
        <div className="flex items-center gap-3 text-[12px] text-ink-tertiary">
          <span>
            总记录数 <strong className="text-ink">{total}</strong>
          </span>
          {isFetching && <span className="text-ink-subtle">刷新中…</span>}
        </div>
      }
    >
      {linkedApis.length > 0 && (
        <div className="border-b border-line-subtle px-5 py-2.5 text-[12px] text-ink-tertiary">
          <span className="mr-2 font-medium text-ink-secondary">关联接口</span>
          {linkedApis.map((a) => (
            <span
              key={a.id}
              className="mr-2 inline-flex items-center gap-1 rounded-full border border-line bg-canvas-subtle px-2 py-0.5 font-mono text-[11px] text-ink-secondary"
              title={a.name}
            >
              {a.method} {a.path}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle bg-canvas px-5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-subtle" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
              placeholder="搜索任意字段…"
              className="form-input h-7 w-[220px] pl-7 text-[12px]"
            />
          </div>
          <Button variant="secondary" size="sm" onClick={handleSearch}>
            <Search className="h-3 w-3" />
            搜索
          </Button>
          {qApplied && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ('');
                setQApplied('');
                setPage(1);
              }}
            >
              清除
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => setInsertOpen(true)}>
            <Plus className="h-3 w-3" />
            插入行
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setSchemaOpen(true)}>
            <Columns3 className="h-3 w-3" />
            修改字段
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="!text-danger"
            onClick={handleClear}
            disabled={clearMut.isPending || total === 0}
          >
            <Trash2 className="h-3 w-3" />
            清空表
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="!text-danger"
            onClick={handleDropTable}
            disabled={dropTableMut.isPending}
          >
            <Trash2 className="h-3 w-3" />
            删除表
          </Button>
        </div>
      </div>

      {columns.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-line-subtle px-5 py-2">
          <span className="mr-1 text-[11px] text-ink-subtle">列</span>
          {columns.map((c) => (
            <span
              key={c.name}
              className="inline-flex items-center gap-1 rounded border border-line bg-white px-1.5 py-0.5 font-mono text-[10.5px] text-ink-secondary"
            >
              {c.name}
              <span className="text-ink-subtle">{c.type || '?'}</span>
              {c.pk && <span className="tag tag-orange !text-[9px]">PK</span>}
              {RESERVED_COLS.has(c.name) && (
                <span className="text-[9px] text-ink-subtle">系统</span>
              )}
            </span>
          ))}
        </div>
      )}

      {schemaOpen && (
        <SchemaEditorModal
          tableName={tableName}
          columns={columns}
          onClose={() => setSchemaOpen(false)}
        />
      )}

      {insertOpen && (
        <InsertRowModal
          tableName={tableName}
          columns={columns}
          onClose={() => setInsertOpen(false)}
          onInserted={() => {
            setInsertOpen(false);
            setPage(1);
          }}
        />
      )}

      {isLoading ? (
        <div className="py-12 text-center text-[13px] text-ink-tertiary">加载中…</div>
      ) : rows.length === 0 ? (
        <Empty
          title={qApplied ? '没有匹配的数据' : '该表暂无数据'}
          description={
            qApplied
              ? '试试其他关键字'
              : '点击「插入行」手动添加，或通过配置了 insert 的 Mock 接口写入'
          }
        />
      ) : (
        <div className="overflow-x-auto scrollbar-modern">
          <table className="params-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.name}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-mono normal-case tracking-normal">{c.name}</span>
                      {c.pk && <span className="tag tag-orange">PK</span>}
                    </span>
                  </th>
                ))}
                <th style={{ width: 56 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const rowId = Number(row.id);
                return (
                  <tr key={Number.isFinite(rowId) ? rowId : idx} className="hover:bg-canvas">
                    {columns.map((c) => {
                      const editable =
                        Number.isFinite(rowId) && !c.pk && !RESERVED_COLS.has(c.name);
                      return (
                        <td key={c.name} className="max-w-[280px]">
                          {editable ? (
                            <EditableCell
                              value={row[c.name]}
                              isPk={!!c.pk}
                              disabled={updateMut.isPending}
                              onSave={(raw) =>
                                handleUpdateCell(rowId, c.name, raw, c.type || 'TEXT')
                              }
                            />
                          ) : (
                            renderCell(row[c.name], c.pk)
                          )}
                        </td>
                      );
                    })}
                    <td>
                      <button
                        type="button"
                        className="grid h-[26px] w-[26px] place-items-center rounded text-ink-subtle transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-40"
                        title="删除"
                        disabled={!Number.isFinite(rowId) || deleteMut.isPending}
                        onClick={() => handleDeleteRow(rowId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-line bg-canvas px-4 py-2.5 text-[12px] text-ink-tertiary">
        <span>
          显示 {from} - {to} 条 / 共 {total} 条{qApplied ? ` · 筛选 “${qApplied}”` : ''}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="page-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ‹
          </button>
          <span className="px-2 text-ink-secondary">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="page-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
          >
            ›
          </button>
        </div>
      </div>
    </Card>
  );
}

function InsertRowModal({
  tableName,
  columns,
  onClose,
  onInserted,
}: {
  tableName: string;
  columns: DataBrowserColumn[];
  onClose: () => void;
  onInserted: () => void;
}) {
  const insertMut = useInsertBusinessRow();
  const editableCols = columns.filter((c) => !RESERVED_COLS.has(c.name) && !c.pk);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(editableCols.map((c) => [c.name, ''])),
  );

  const handleSubmit = async () => {
    const row: Record<string, string | number | boolean | null> = {};
    try {
      for (const c of editableCols) {
        const raw = values[c.name] ?? '';
        if (raw.trim() === '') continue;
        row[c.name] = parseCellInput(raw, c.type || 'TEXT');
      }
      await insertMut.mutateAsync({ table: tableName, row });
      toast.success('已插入一行');
      onInserted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '插入失败');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`插入行 · ${tableName}`}
      width="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" loading={insertMut.isPending} onClick={handleSubmit}>
            插入
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-[12px] text-ink-tertiary">
          系统列 <code className="param-code">id</code> /{' '}
          <code className="param-code">created_at</code> /{' '}
          <code className="param-code">updated_at</code> 自动生成。留空表示 NULL。
        </p>
        {editableCols.length === 0 ? (
          <div className="rounded-md border border-line bg-canvas-subtle/40 px-3 py-6 text-center text-[12.5px] text-ink-tertiary">
            当前仅有系统列，将插入空行。可先在「修改字段」中新增业务列。
          </div>
        ) : (
          editableCols.map((c) => (
            <FormField key={c.name} label={`${c.name} (${c.type || 'TEXT'})`}>
              <Input
                className="mono"
                value={values[c.name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [c.name]: e.target.value }))}
                placeholder="留空为 NULL"
              />
            </FormField>
          ))
        )}
      </div>
    </Modal>
  );
}

function SchemaEditorModal({
  tableName,
  columns,
  onClose,
}: {
  tableName: string;
  columns: DataBrowserColumn[];
  onClose: () => void;
}) {
  const addMut = useAddBusinessColumn();
  const renameMut = useRenameBusinessColumn();
  const dropColMut = useDropBusinessColumn();
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ColumnType>('TEXT');
  const [renameMap, setRenameMap] = useState<Record<string, string>>({});

  const handleAdd = async () => {
    const name = newName.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      toast.error('列名仅允许字母/数字/下划线，且不能以数字开头');
      return;
    }
    if (RESERVED_COLS.has(name)) {
      toast.error('不能使用系统保留列名');
      return;
    }
    try {
      await addMut.mutateAsync({ table: tableName, name, type: newType });
      toast.success(`已新增列 ${name}`);
      setNewName('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '新增列失败');
    }
  };

  const handleRename = async (oldName: string) => {
    const next = (renameMap[oldName] ?? oldName).trim();
    if (next === oldName) return;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(next)) {
      toast.error('新列名格式不正确');
      return;
    }
    try {
      await renameMut.mutateAsync({ table: tableName, columnName: oldName, newName: next });
      toast.success(`已重命名 ${oldName} → ${next}`);
      setRenameMap((m) => {
        const copy = { ...m };
        delete copy[oldName];
        return copy;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '重命名失败');
    }
  };

  const handleDropCol = async (columnName: string) => {
    const ok = await confirm({
      title: '删除列',
      message: (
        <span>
          确定删除列 <b className="font-mono">{columnName}</b>？该列数据将丢失。
        </span>
      ),
      confirmText: '删除列',
      danger: true,
    });
    if (!ok) return;
    try {
      await dropColMut.mutateAsync({ table: tableName, columnName });
      toast.success(`已删除列 ${columnName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除列失败');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`修改字段 · ${tableName}`}
      width="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          关闭
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-[12px] text-ink-tertiary">
          系统列 <code className="param-code">id</code> /{' '}
          <code className="param-code">created_at</code> /{' '}
          <code className="param-code">updated_at</code> 不可修改或删除。
        </p>

        <div className="overflow-x-auto rounded-md border border-line">
          <table className="params-table !mb-0">
            <thead>
              <tr>
                <th>列名</th>
                <th>类型</th>
                <th>重命名</th>
                <th style={{ width: 100 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((c) => {
                const reserved = RESERVED_COLS.has(c.name);
                return (
                  <tr key={c.name}>
                    <td className="font-mono text-[12.5px]">
                      {c.name}
                      {c.pk && <span className="tag tag-orange ml-1">PK</span>}
                      {reserved && <span className="ml-1 text-[10px] text-ink-subtle">系统</span>}
                    </td>
                    <td className="font-mono text-[12px] text-ink-secondary">{c.type || 'TEXT'}</td>
                    <td>
                      {reserved ? (
                        <span className="text-[12px] text-ink-subtle">—</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Input
                            className="mono h-7 !text-[12px]"
                            value={renameMap[c.name] ?? c.name}
                            onChange={(e) =>
                              setRenameMap((m) => ({ ...m, [c.name]: e.target.value }))
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            title="应用重命名"
                            disabled={
                              renameMut.isPending || (renameMap[c.name] ?? c.name) === c.name
                            }
                            onClick={() => handleRename(c.name)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </td>
                    <td>
                      {reserved ? (
                        <span className="text-[12px] text-ink-subtle">—</span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="!text-danger"
                          disabled={dropColMut.isPending}
                          onClick={() => handleDropCol(c.name)}
                        >
                          <Trash2 className="h-3 w-3" />
                          删除
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-md border border-line bg-canvas-subtle/40 p-3">
          <div className="mb-2 text-[12.5px] font-medium text-ink">新增列</div>
          <div className="flex flex-wrap items-end gap-2">
            <FormField label="列名" className="min-w-[160px] flex-1">
              <Input
                className="mono"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例如 remark"
              />
            </FormField>
            <FormField label="类型" className="w-[140px]">
              <Select value={newType} onChange={(e) => setNewType(e.target.value as ColumnType)}>
                <option value="TEXT">TEXT</option>
                <option value="REAL">REAL</option>
                <option value="INTEGER">INTEGER</option>
                <option value="BLOB">BLOB</option>
              </Select>
            </FormField>
            <Button variant="primary" loading={addMut.isPending} onClick={handleAdd}>
              添加
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function cellToEditText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function parseCellInput(raw: string, colType: string): string | number | boolean | null {
  const t = raw.trim();
  if (t === '' || t.toUpperCase() === 'NULL') return null;
  const upper = colType.toUpperCase();
  if (upper.includes('INT')) {
    const n = Number(t);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      throw new Error('请输入整数');
    }
    return n;
  }
  if (upper.includes('REAL') || upper.includes('FLOAT') || upper.includes('DOUBLE')) {
    const n = Number(t);
    if (!Number.isFinite(n)) {
      throw new Error('请输入数字');
    }
    return n;
  }
  if (t === 'true') return true;
  if (t === 'false') return false;
  return raw;
}

function EditableCell({
  value,
  isPk,
  disabled,
  onSave,
}: {
  value: unknown;
  isPk: boolean;
  disabled?: boolean;
  onSave: (raw: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    if (disabled || saving) return;
    setDraft(cellToEditText(value));
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDraft('');
  };

  const commit = async () => {
    const original = cellToEditText(value);
    if (draft === original) {
      cancel();
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      /* toast already shown */
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          void commit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        className="form-input mono h-7 w-full min-w-[80px] !text-[12px]"
        title="Enter 保存 · Esc 取消 · 空或 NULL 置空"
      />
    );
  }

  return (
    <button
      type="button"
      onDoubleClick={startEdit}
      disabled={disabled}
      className="group flex w-full max-w-full items-center gap-1 rounded px-0.5 py-0.5 text-left transition-colors hover:bg-canvas-subtle disabled:opacity-50"
      title="双击编辑"
    >
      <span className="min-w-0 flex-1 truncate">{renderCell(value, isPk)}</span>
      <Pencil className="h-2.5 w-2.5 flex-shrink-0 text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function renderCell(v: unknown, isPk: boolean = false) {
  if (v === null || v === undefined) {
    return <span className="text-ink-subtle">NULL</span>;
  }
  if (typeof v === 'object') {
    const json = JSON.stringify(v);
    return (
      <span className="truncate font-mono text-[11.5px] text-ink-secondary" title={json}>
        {`{ ${Object.keys(v as object)
          .slice(0, 3)
          .join(', ')}${Object.keys(v as object).length > 3 ? ', ...' : ''} }`}
      </span>
    );
  }
  // JSON 字符串尝试展示
  if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
    try {
      JSON.parse(v);
      return (
        <span className="truncate font-mono text-[11.5px] text-ink-secondary" title={v}>
          {v.length > 80 ? `${v.slice(0, 80)}…` : v}
        </span>
      );
    } catch {
      /* plain string */
    }
  }
  if (isPk) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded border border-line bg-canvas-subtle px-1.5 py-0.5 font-mono text-[12px] text-ink">
          {String(v)}
        </span>
      </span>
    );
  }
  if (typeof v === 'number' && v > 1e12) {
    try {
      return <span className="text-ink-secondary">{new Date(v).toLocaleString()}</span>;
    } catch {
      return String(v);
    }
  }
  return <span className="text-ink-secondary">{String(v)}</span>;
}
