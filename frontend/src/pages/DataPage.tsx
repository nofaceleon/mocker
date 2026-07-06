import { useMemo, useState } from 'react';
import {
  Database as DatabaseIcon,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Table as TableIcon,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  Button,
  Card,
  CodeBlock,
  Empty,
  IconBtn,
  PageHeader,
  StatCard,
} from '@/components/ui';
import { useBusinessTables, useDataBrowser } from '@/hooks/queries/use-data-browser';
import type { DataBrowserTable } from '@/types/api';

export function DataPage() {
  const { data } = useDataBrowser(1);
  const { data: tables } = useBusinessTables();
  const [search, setSearch] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const businessTables = data?.businessTables ?? [];

  const filteredTables = useMemo(() => {
    if (!search) return businessTables;
    const q = search.toLowerCase();
    return businessTables.filter((t) => t.name.toLowerCase().includes(q));
  }, [businessTables, search]);

  const activeTable: DataBrowserTable | null = useMemo(() => {
    if (!selectedTable) return filteredTables[0] ?? null;
    return filteredTables.find((t) => t.name === selectedTable) ?? null;
  }, [selectedTable, filteredTables]);

  const totalRows = businessTables.reduce((sum, t) => sum + (t.rowCount ?? 0), 0);
  const allTables = useMemo(() => {
    const set = new Set<string>();
    businessTables.forEach((t) => set.add(t.name));
    (tables ?? []).forEach((t) => set.add(t.name));
    return Array.from(set);
  }, [businessTables, tables]);

  return (
    <div className="page-container">
      <PageHeader
        title="数据管理"
        description="查看和管理所有数据联动产生的 Mock 数据"
        actions={
          <>
            <Button variant="secondary">
              <Download className="h-3.5 w-3.5" />
              导出全部
            </Button>
            <Button variant="secondary">
              <Upload className="h-3.5 w-3.5" />
              导入
            </Button>
            <Button variant="primary">
              <Plus className="h-3.5 w-3.5" />
              新建表
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="业务表" value={allTables.length} icon={<TableIcon />} />
        <StatCard label="总行数" value={totalRows} hint="所有业务表累计" icon={<DatabaseIcon />} />
        <StatCard
          label="占用空间"
          value={`${(totalRows * 0.3).toFixed(1)} KB`}
          hint="SQLite 估算"
          icon={<DatabaseIcon />}
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
            extra={
              <IconBtn title="新建表">
                <Plus className="h-3 w-3" />
              </IconBtn>
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
            <ul className="max-h-[480px] overflow-y-auto p-1.5 scrollbar-thin">
              {filteredTables.length === 0 ? (
                <li className="px-3 py-6 text-center text-[12px] text-ink-subtle">
                  {search ? '没有匹配的表' : '还没有业务表'}
                </li>
              ) : (
                filteredTables.map((t) => (
                  <li key={t.name}>
                    <button
                      onClick={() => setSelectedTable(t.name)}
                      className={`group flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                        activeTable?.name === t.name
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
                          activeTable?.name === t.name
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
          {activeTable ? (
            <TableDetail table={activeTable} />
          ) : (
            <Card>
              <Empty
                title="未选择数据表"
                description="在左侧选择一个业务表查看其行数据与列结构"
                icon={<DatabaseIcon className="h-10 w-10 text-ink-subtle" />}
              />
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

function TableDetail({ table }: { table: DataBrowserTable }) {
  const [search, setSearch] = useState('');

  return (
    <Card
      noBody
      title={
        <div className="flex items-center gap-2">
          <DatabaseIcon className="h-3.5 w-3.5 text-ink-tertiary" />
          <span className="font-mono text-ink-subtle">/</span>
          <span className="font-mono text-ink">{table.name}</span>
          <span className="tag tag-blue">业务表</span>
          {table.columns.find((c) => c.pk) && <span className="tag tag-orange">PK</span>}
        </div>
      }
      extra={
        <div className="flex items-center gap-3 text-[12px] text-ink-tertiary">
          <span>
            总记录数 <strong className="text-ink">{table.rowCount}</strong>
          </span>
          <span className="h-3 w-px bg-line" />
          <span>
            占用 <strong className="text-ink">{(table.rowCount * 0.3).toFixed(1)} KB</strong>
          </span>
          <span className="h-3 w-px bg-line" />
          <span>最后写入 <strong className="text-ink">3 分钟前</strong></span>
        </div>
      }
    >
      <div className="px-5 pb-2 pt-4">
        <CodeBlock
          className="!rounded-md"
          language="SQL"
          tabs={<code style={{ color: '#A1A1AA' }}>// 在线查询 · 支持标准 SQL · 仅当前表</code>}
        >
          <span className="kw">SELECT</span> * <span className="kw">FROM</span> <span className="str">{table.name}</span> <span className="kw">WHERE</span> requestId <span className="kw">LIKE</span> <span className="str">'req_%'</span> <span className="kw">ORDER BY</span> createdAt <span className="kw">DESC</span> <span className="kw">LIMIT</span> <span className="num">10</span>;
        </CodeBlock>
      </div>

      <div className="flex items-center justify-between border-y border-line-subtle bg-canvas px-5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索数据…"
              className="form-input h-7 w-[200px] pl-7 text-[12px]"
            />
          </div>
          <select className="form-select h-7 w-auto min-w-[120px] text-[12px]">
            <option>全部字段</option>
            {table.columns.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm">
            <Search className="h-3 w-3" />
            运行
          </Button>
          <Button variant="ghost" size="sm" className="!text-danger">
            <Trash2 className="h-3 w-3" />
            清空表
          </Button>
          <Button variant="primary" size="sm">
            <Plus className="h-3 w-3" />
            新增记录
          </Button>
        </div>
      </div>

      {table.rows.length === 0 ? (
        <Empty
          title="该表暂无数据"
          description="调用该表对应的 Mock 接口后，数据会自动写入"
        />
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="params-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input type="checkbox" className="h-3.5 w-3.5 cursor-pointer rounded accent-ink" />
                </th>
                {table.columns.map((c) => (
                  <th key={c.name}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-mono normal-case tracking-normal">{c.name}</span>
                      {c.pk && <span className="tag tag-orange">PK</span>}
                    </span>
                  </th>
                ))}
                <th style={{ width: 90 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-canvas">
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="h-3.5 w-3.5 cursor-pointer rounded accent-ink" />
                  </td>
                  {table.columns.map((c) => (
                    <td key={c.name} className="max-w-[280px]">
                      {renderCell((row as Record<string, unknown>)[c.name], c.pk)}
                    </td>
                  ))}
                  <td>
                    <div className="flex items-center gap-0.5">
                      <button
                        className="grid h-[26px] w-[26px] place-items-center rounded text-ink-subtle transition-colors hover:bg-canvas-subtle hover:text-ink"
                        title="编辑"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        className="grid h-[26px] w-[26px] place-items-center rounded text-ink-subtle transition-colors hover:bg-canvas-subtle hover:text-ink"
                        title="更多"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </button>
                      <button
                        className="grid h-[26px] w-[26px] place-items-center rounded text-ink-subtle transition-colors hover:bg-danger-soft hover:text-danger"
                        title="删除"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-line bg-canvas px-4 py-2.5 text-[12px] text-ink-tertiary">
        <span>
          显示 1 - {Math.min(table.rows.length, 10)} 条 / 共 {table.rowCount} 条
        </span>
        <div className="flex items-center gap-0.5">
          <button className="page-btn">‹</button>
          <button className="page-btn active">1</button>
          <button className="page-btn">2</button>
          <button className="page-btn">3</button>
          <button className="page-btn">4</button>
          <button className="page-btn">5</button>
          <button className="page-btn">›</button>
        </div>
      </div>
    </Card>
  );
}

function renderCell(v: unknown, isPk: boolean = false) {
  if (v === null || v === undefined) {
    return <span className="text-ink-subtle">NULL</span>;
  }
  if (typeof v === 'object') {
    const json = JSON.stringify(v);
    return (
      <span
        className="cursor-pointer truncate font-mono text-[11.5px] text-ink-secondary"
        title={json}
      >
        {`{ ${Object.keys(v as object).slice(0, 3).join(', ')}${Object.keys(v as object).length > 3 ? ', ...' : ''} }`}
      </span>
    );
  }
  if (isPk) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded border border-line bg-canvas-subtle px-1.5 py-0.5 font-mono text-[12px] text-ink">
          {String(v)}
        </span>
        <span className="tag tag-orange">PK</span>
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
