import { ChevronRight, Inbox, Trash2 } from 'lucide-react';
import { Button, Card, Empty, MethodBadge } from '@/components/ui';
import { formatNumber, formatDateParts, statusKindClass, responseTimeClass } from './log-shared';
import type { RequestLog } from '@/types/api';

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return <div className="flex items-center gap-0.5" />;
  const items: Array<number | 'gap'> = [];
  const push = (v: number | 'gap') => items.push(v);
  const addRange = (s: number, e: number) => {
    for (let i = s; i <= e; i++) push(i);
  };
  if (totalPages <= 7) {
    addRange(1, totalPages);
  } else {
    addRange(1, 2);
    if (page > 4) push('gap');
    const start = Math.max(3, page - 1);
    const end = Math.min(totalPages - 2, page + 1);
    addRange(start, end);
    if (page < totalPages - 3) push('gap');
    addRange(totalPages - 1, totalPages);
  }
  return (
    <div className="flex items-center gap-0.5">
      <button className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronRight className="h-3 w-3 rotate-180" />
      </button>
      {items.map((it, i) =>
        it === 'gap' ? (
          <span key={`g-${i}`} className="px-1 text-ink-disabled">
            …
          </span>
        ) : (
          <button
            key={it}
            className={`page-btn${it === page ? ' active' : ''}`}
            onClick={() => onChange(it)}
          >
            {it}
          </button>
        ),
      )}
      <button
        className="page-btn"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}

function LogRowView({
  log,
  checked,
  onToggleCheck,
  selected,
  onSelect,
}: {
  log: RequestLog;
  checked: boolean;
  onToggleCheck: () => void;
  selected: boolean;
  onSelect: () => void;
}) {
  const { dateStr, timeStr, msStr } = formatDateParts(log.createdAt);
  return (
    <tr onClick={onSelect} className={selected ? '' : 'cursor-pointer hover:bg-canvas-subtle'} style={selected ? { backgroundColor: '#f5f3ff' } : undefined}>
      <td onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className="h-3.5 w-3.5 cursor-pointer rounded accent-ink"
          checked={checked}
          onChange={onToggleCheck}
        />
      </td>
      <td>
        <div className="flex flex-col leading-tight">
          <span className="text-ink">{dateStr}</span>
          <span className="font-mono text-[11px] text-ink-subtle">
            {timeStr}
            <span className="text-ink-disabled">{msStr}</span>
          </span>
        </div>
      </td>
      <td>
        <MethodBadge method={log.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'} />
      </td>
      <td>
        <div className="flex flex-col leading-tight">
          <span className="param-code max-w-[260px] truncate" title={log.path}>
            {log.path}
          </span>
          <span className="text-[11px] text-ink-subtle">
            {log.apiName ?? '—'}
            {log.projectName && <span className="text-ink-disabled">（{log.projectName}）</span>}
          </span>
        </div>
      </td>
      <td>
        <span className={statusKindClass(log.statusKind)}>{log.status}</span>
      </td>
      <td>
        <span className={responseTimeClass(log.responseTime)}>{log.responseTime} ms</span>
      </td>
    </tr>
  );
}

export function LogsTable({
  items,
  total,
  page,
  pageSize,
  selectedId,
  onSelect,
  onPageChange,
  checkedIds,
  onToggleCheck,
  onToggleCheckAll,
  onClearSelection,
  onBatchDelete,
  isLoading,
}: {
  items: RequestLog[];
  total: number;
  page: number;
  pageSize: number;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onPageChange: (page: number) => void;
  checkedIds: number[];
  onToggleCheck: (id: number) => void;
  onToggleCheckAll: () => void;
  onClearSelection: () => void;
  onBatchDelete: () => void;
  isLoading: boolean;
}) {
  const allChecked = items.length > 0 && items.every((it) => checkedIds.includes(it.id));
  const someChecked = checkedIds.length > 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card title={`调用日志 · ${formatNumber(total)} 条`} noBody>
      {someChecked && (
        <div className="flex items-center justify-between border-b border-line bg-canvas-subtle px-4 py-2 text-[12px]">
          <span className="text-ink-secondary">已选 {checkedIds.length} 条</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              取消选择
            </Button>
            <Button variant="danger" size="sm" onClick={onBatchDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              批量删除
            </Button>
          </div>
        </div>
      )}

      {isLoading && items.length === 0 ? (
        <div className="px-4 py-10 text-center text-[12px] text-ink-tertiary">加载中…</div>
      ) : items.length === 0 ? (
        <Empty
          icon={<Inbox className="h-10 w-10 text-ink-subtle" />}
          title="暂无调用日志"
          description="启用接口被调用后会显示在这里"
        />
      ) : (
        <>
          <table className="params-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 cursor-pointer rounded accent-ink"
                    checked={allChecked}
                    onChange={onToggleCheckAll}
                  />
                </th>
                <th>调用时间</th>
                <th>方法</th>
                <th>路径 / 所属接口</th>
                <th>状态</th>
                <th>响应时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <LogRowView
                  key={l.id}
                  log={l}
                  checked={checkedIds.includes(l.id)}
                  onToggleCheck={() => onToggleCheck(l.id)}
                  selected={selectedId === l.id}
                  onSelect={() => onSelect(selectedId === l.id ? null : l.id)}
                />
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-line bg-canvas px-4 py-2.5 text-[12px] text-ink-tertiary">
            <span>
              显示 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} 条 / 共{' '}
              {formatNumber(total)} 条
              {someChecked ? ` · 已选 ${checkedIds.length} 条` : ''}
            </span>
            <Pagination page={page} totalPages={totalPages} onChange={onPageChange} />
          </div>
        </>
      )}
    </Card>
  );
}
