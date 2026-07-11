import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Inbox,
  RotateCcw,
  Search,
  Server,
  TrendingDown,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  Empty,
  LiveDot,
  MethodBadge,
  Modal,
  PageHeader,
  StatCard,
  Tabs,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { HeadersBlock, JsonField } from '@/lib/log-format';
import {
  buildRequestLogExportUrl,
  useClearRequestLogs,
  useRequestLog,
  useRequestLogFilters,
  useRequestLogStats,
  useRequestLogs,
  type RequestLogQuery,
  type RequestLogRange,
  type RequestLogStatusClass,
  type RequestLogHttpMethod,
} from '@/hooks/queries/use-request-logs';
import type { RequestLog, RequestLogStatusKind } from '@/types/api';

const METHOD_OPTIONS: Array<RequestLogHttpMethod | 'all'> = ['all', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const STATUS_OPTIONS: Array<RequestLogStatusClass | 'all'> = ['all', '2xx', '4xx', '5xx'];
const PAGE_SIZE = 20;

export function LogsPage() {
  const [searchParams] = useSearchParams();
  const initialProject = searchParams.get('projectId') ?? 'all';
  const initialApi = searchParams.get('apiId') ?? 'all';

  const [range, setRange] = useState<RequestLogRange>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>(initialProject);
  const [apiFilter, setApiFilter] = useState<string>(initialApi);
  const [methodFilter, setMethodFilter] = useState<RequestLogHttpMethod | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<RequestLogStatusClass | 'all'>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmClearSelected, setConfirmClearSelected] = useState(false);
  const todayStr = new Date().toISOString().split('T')[0];

  // 项目切换时清空接口筛选
  useEffect(() => {
    setApiFilter('all');
    setPage(1);
  }, [projectFilter]);

  // 搜索词变化时重置页码
  useEffect(() => {
    setPage(1);
  }, [search, methodFilter, statusFilter, range, customStart, customEnd]);

  const filtersQuery = useMemo(() => ({ projectId: projectFilter === 'all' ? undefined : Number(projectFilter) }), [projectFilter]);
  const filters = useRequestLogFilters(filtersQuery);
  const projectOptions = useMemo(() => filters.data?.projects ?? [], [filters.data]);
  const apiOptions = useMemo(() => {
    const all = filters.data?.apis ?? [];
    if (projectFilter === 'all') return all;
    return all.filter((a) => String(a.projectId ?? '') === projectFilter);
  }, [filters.data, projectFilter]);

  const listQuery = useMemo<RequestLogQuery>(
    () => ({
      projectId: projectFilter === 'all' ? undefined : Number(projectFilter),
      apiId: apiFilter === 'all' ? undefined : Number(apiFilter),
      method: methodFilter === 'all' ? undefined : methodFilter,
      statusClass: statusFilter === 'all' ? undefined : statusFilter,
      keyword: search.trim() || undefined,
      range,
      start: range === 'custom' && customStart ? new Date(customStart).getTime() : undefined,
      end: range === 'custom' && customEnd ? new Date(customEnd + 'T23:59:59').getTime() : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [projectFilter, apiFilter, methodFilter, statusFilter, search, range, customStart, customEnd, page],
  );

  const stats = useRequestLogStats(range);
  const logs = useRequestLogs(listQuery);
  const detail = useRequestLog(selected ?? undefined);
  const clearMut = useClearRequestLogs();

  const total = logs.data?.total ?? 0;
  const items = logs.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const allChecked = items.length > 0 && items.every((it) => checkedIds.includes(it.id));
  const someChecked = checkedIds.length > 0;

  function toggleCheckAll() {
    if (allChecked) {
      setCheckedIds((prev) => prev.filter((id) => !items.some((it) => it.id === id)));
    } else {
      setCheckedIds((prev) => Array.from(new Set([...prev, ...items.map((it) => it.id)])));
    }
  }

  function toggleCheckOne(id: number) {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleReset() {
    setSearch('');
    setProjectFilter('all');
    setApiFilter('all');
    setMethodFilter('all');
    setStatusFilter('all');
    setRange('all');
    setCustomStart('');
    setCustomEnd('');
    setPage(1);
    setCheckedIds([]);
  }

  async function handleClearAll() {
    try {
      const res = await clearMut.mutateAsync({ all: true });
      toast.success(`已清除 ${res.deleted} 条日志`);
      setConfirmClearAll(false);
      setCheckedIds([]);
      setSelected(null);
    } catch (e) {
      toast.error(`清除失败: ${(e as Error).message}`);
    }
  }

  async function handleClearSelected() {
    try {
      const res = await clearMut.mutateAsync({ ids: checkedIds });
      toast.success(`已删除 ${res.deleted} 条日志`);
      setConfirmClearSelected(false);
      setCheckedIds([]);
    } catch (e) {
      toast.error(`删除失败: ${(e as Error).message}`);
    }
  }

  function handleExport() {
    const url = buildRequestLogExportUrl(listQuery);
    window.open(url, '_blank');
  }

  // ---------- 渲染 ----------
  return (
    <div className="page-container">
      <PageHeader
        title="调用日志"
        description="所有 Mock 接口的请求记录，便于调试和回溯问题"
        actions={
          <>
            <Button variant="secondary" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" />
              导出日志
            </Button>
            <Button variant="danger" onClick={() => setConfirmClearAll(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              清除全部
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="总调用次数"
          value={stats.data ? formatNumber(stats.data.total) : '—'}
          icon={<Activity />}
        />
        <StatCard
          label="今日调用"
          value={stats.data ? formatNumber(stats.data.today) : '—'}
          icon={<Calendar />}
        />
        <StatCard
          label="平均响应时间"
          value={stats.data ? `${stats.data.avgMs}ms` : '—'}
          hint={
            <span className="inline-flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> 实时计算
            </span>
          }
          icon={<Clock />}
        />
        <StatCard
          label="成功率"
          value={stats.data ? `${stats.data.successRate}%` : '—'}
          icon={<Server />}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title={
            <div className="flex items-center gap-2">
              近 7 天调用趋势
              <span className="ml-2 inline-flex items-center gap-3 text-[11px] text-ink-tertiary">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-ink" /> HTTP
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-success" /> WebSocket
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-warning" /> SSE
                </span>
              </span>
            </div>
          }
        >
          <TrendChart data={stats.data?.trendPoints ?? null} />
        </Card>
        <Card title="状态码分布">
          <StatusPieChart
            distribution={stats.data?.statusDistribution ?? null}
            total={stats.data?.total ?? 0}
          />
        </Card>
      </div>

      <div className="mb-3.5 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="按路径、接口名、IP、Request ID 搜索…"
              className="form-input h-8 pl-8"
            />
          </div>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="form-select w-auto min-w-[120px] text-[12px]"
          >
            <option value="all">全部项目</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={apiFilter}
            onChange={(e) => setApiFilter(e.target.value)}
            className="form-select w-auto min-w-[140px] text-[12px]"
          >
            <option value="all">全部接口</option>
            {apiOptions.map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.name} · {a.method} {a.path}
              </option>
            ))}
          </select>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as RequestLogHttpMethod | 'all')}
            className="form-select w-auto min-w-[110px] text-[12px]"
          >
            {METHOD_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m === 'all' ? '全部方法' : m}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RequestLogStatusClass | 'all')}
            className="form-select w-auto min-w-[110px] text-[12px]"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? '全部状态' : s}
              </option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            重置
          </Button>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[12px] text-ink-tertiary">时间：</span>
          <Tabs<RequestLogRange>
            variant="pill"
            value={range}
            onChange={(v) => setRange(v)}
            items={[
              { value: 'all', label: '全部' },
              { value: '1h', label: '最近 1 小时' },
              { value: '24h', label: '最近 24 小时' },
              { value: '7d', label: '最近 7 天' },
              { value: 'custom', label: '自定义' },
            ]}
          />
          {range === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStart}
                max={customEnd || todayStr}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  if (customEnd && e.target.value > customEnd) setCustomEnd(e.target.value);
                }}
                className="form-input h-7 w-auto min-w-[130px] text-[12px]"
              />
              <span className="text-[12px] text-ink-tertiary">至</span>
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                max={todayStr}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  if (customStart && e.target.value < customStart) setCustomStart(e.target.value);
                }}
                className="form-input h-7 w-auto min-w-[130px] text-[12px]"
              />
            </div>
          )}
          <div className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-ink-tertiary">
            <LiveDot />
            实时刷新中
          </div>
        </div>
      </div>

      <Card title={`调用日志 · ${formatNumber(total)} 条`} noBody>
        {someChecked && (
          <div className="flex items-center justify-between border-b border-line bg-canvas-subtle px-4 py-2 text-[12px]">
            <span className="text-ink-secondary">已选 {checkedIds.length} 条</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCheckedIds([])}>
                取消选择
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmClearSelected(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                批量删除
              </Button>
            </div>
          </div>
        )}

        {logs.isLoading && items.length === 0 ? (
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
                      onChange={toggleCheckAll}
                    />
                  </th>
                  <th>调用时间</th>
                  <th>方法</th>
                  <th>路径</th>
                  <th>所属接口</th>
                  <th>Request ID</th>
                  <th>客户端</th>
                  <th>状态</th>
                  <th>响应时间</th>
                  <th className="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <LogRowView
                    key={l.id}
                    log={l}
                    checked={checkedIds.includes(l.id)}
                    onToggleCheck={() => toggleCheckOne(l.id)}
                    expanded={selected === l.id}
                    onToggleExpand={() => setSelected(selected === l.id ? null : l.id)}
                  />
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between border-t border-line bg-canvas px-4 py-2.5 text-[12px] text-ink-tertiary">
              <span>
                显示 {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, total)} 条 / 共 {formatNumber(total)} 条
                {someChecked ? ` · 已选 ${checkedIds.length} 条` : ''}
              </span>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>
          </>
        )}
      </Card>

      {/* 详情弹框 */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        width="xl"
        title={
          detail.data ? (
            <div className="flex items-center gap-2">
              <MethodBadge method={detail.data.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'} />
              <span className="font-mono text-ink-secondary">{detail.data.path}</span>
              {detail.data.format === 'sse' && (
                <span className="rounded bg-warning-soft px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-warning">
                  SSE
                </span>
              )}
            </div>
          ) : (
            '调用日志详情'
          )
        }
      >
        {detail.isLoading ? (
          <div className="py-10 text-center text-[12px] text-ink-tertiary">加载中…</div>
        ) : detail.data ? (
          <LogDetail log={detail.data} />
        ) : (
          <div className="py-10 text-center text-[12px] text-ink-tertiary">未找到日志详情</div>
        )}
      </Modal>

      {/* 二次确认：清除全部 */}
      <Modal
        open={confirmClearAll}
        onClose={() => setConfirmClearAll(false)}
        title="清除全部调用日志？"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClearAll(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleClearAll} disabled={clearMut.isPending}>
              {clearMut.isPending ? '清除中…' : '确认清除'}
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink-secondary">
          此操作不可恢复，将删除所有 Mock 接口的请求记录。当前共 <strong className="text-ink">{formatNumber(total)}</strong> 条。
        </p>
      </Modal>

      {/* 二次确认：批量删除 */}
      <Modal
        open={confirmClearSelected}
        onClose={() => setConfirmClearSelected(false)}
        title={`删除选中的 ${checkedIds.length} 条日志？`}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClearSelected(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleClearSelected} disabled={clearMut.isPending}>
              {clearMut.isPending ? '删除中…' : '确认删除'}
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink-secondary">删除后无法恢复。</p>
      </Modal>
    </div>
  );
}

// ---------- 单行 ----------
function LogRowView({
  log,
  checked,
  onToggleCheck,
  expanded,
  onToggleExpand,
}: {
  log: RequestLog;
  checked: boolean;
  onToggleCheck: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const { dateStr, timeStr, msStr } = formatDateParts(log.createdAt);
  return (
    <tr
      onClick={onToggleExpand}
      className="cursor-pointer hover:bg-canvas"
    >
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
        <span className="param-code max-w-[260px] truncate" title={log.path}>
          {log.path}
        </span>
      </td>
      <td>
        <div className="flex flex-col leading-tight">
          <span className="text-ink">{log.apiName ?? '—'}</span>
          {log.projectName && (
            <span className="text-[11px] text-ink-subtle">（{log.projectName}）</span>
          )}
        </div>
      </td>
      <td>
        <span
          className="max-w-[160px] truncate font-mono text-[11.5px] text-ink-tertiary"
          title={log.requestId ?? ''}
        >
          {log.requestId ? log.requestId.slice(0, 8) + '…' : '—'}
        </span>
      </td>
      <td>
        <span className="font-mono text-[11.5px] text-ink-tertiary">{log.clientIp ?? '—'}</span>
      </td>
      <td>
        <span className={cn(statusKindClass(log.statusKind))}>{log.status}</span>
      </td>
      <td>
        <span className={cn(responseTimeClass(log.responseTime))}>{log.responseTime} ms</span>
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
        >
          {expanded ? '收起' : '查看'}
          <ChevronRight
            className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')}
          />
        </Button>
      </td>
    </tr>
  );
}

// ---------- 详情面板 ----------
function LogDetail({ log }: { log: RequestLog }) {
  const [tab, setTab] = useState<'request' | 'response' | 'headers' | 'server'>('request');
  const timeMs = log.createdAt ? new Date(log.createdAt).getTime() : Date.now();

  return (
    <div>
      <Tabs<'request' | 'response' | 'headers' | 'server'>
        value={tab}
        onChange={setTab}
        className="mb-3"
        items={[
          { value: 'request', label: 'Request' },
          { value: 'response', label: 'Response' },
          { value: 'headers', label: 'Headers' },
          { value: 'server', label: '服务端日志' },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            {tab === 'request' && '请求参数 / Body'}
            {tab === 'response' && '响应内容'}
            {tab === 'headers' && '请求 / 响应头'}
            {tab === 'server' && '服务端处理时间线'}
          </h4>
          {tab === 'request' && (
            <div className="space-y-3">
              <JsonField label="Query" value={log.requestParams} />
              <JsonField label="Body" value={log.requestBody} />
            </div>
          )}
          {tab === 'response' && (
            <JsonField
              label="响应内容"
              value={log.responseBody}
              placeholder="空响应"
            />
          )}
          {tab === 'headers' && (
            <div className="space-y-4">
              <div>
                <h5 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-disabled">
                  请求头
                </h5>
                <HeadersBlock headers={log.requestHeaders} />
              </div>
              <div>
                <h5 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-disabled">
                  响应头
                </h5>
                <HeadersBlock headers={null} emptyHint="后端尚未记录响应头" />
              </div>
            </div>
          )}
          {tab === 'server' && (
            <pre className="code-content !rounded-md !p-3 !text-[12px]">
              {renderServerTimeline(log, timeMs)}
            </pre>
          )}
        </div>
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">请求摘要</h4>
          <div className="rounded-md border border-line bg-elevated p-3">
            <KV k="Method" v={log.method} />
            <KV k="URL" v={log.path} mono />
            <KV k="Client IP" v={log.clientIp ?? '—'} mono />
            <KV k="Request ID" v={log.requestId ?? '—'} mono />
            <KV k="格式" v={log.format === 'sse' ? 'SSE' : 'HTTP'} />
            <KV k="状态" v={`${log.status} ${statusText(log.status)}`} valueClass={log.statusKind === 'success' ? 'text-success' : log.statusKind === 'warning' || log.statusKind === 'danger' ? 'text-warning' : ''} />
            <KV k="响应时间" v={`${log.responseTime} ms`} mono />
            <KV k="响应大小" v={`${log.responseSize} B`} mono />
            <KV k="所属接口" v={log.apiName ?? '—'} />
            <KV k="所属项目" v={log.projectName ?? '—'} />
            <KV k="调用时间" v={new Date(log.createdAt).toLocaleString()} mono />
          </div>
        </div>
      </div>
    </div>
  );
}

function KV({ k, v, mono, valueClass }: { k: string; v: string; mono?: boolean; valueClass?: string }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-2 py-1 text-[12px]">
      <span className="text-ink-tertiary">{k}</span>
      <span className={cn('text-ink', mono && 'font-mono', valueClass)}>{v}</span>
    </div>
  );
}

// ---------- 服务端时间线 ----------
function renderServerTimeline(log: RequestLog, startedAt: number): string {
  const fmt = (delta: number) => {
    const d = new Date(startedAt + delta);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
  };
  const lines: string[] = [];
  lines.push(`[${fmt(0)}] [INFO]    接收请求 ${log.method} ${log.path}`);
  lines.push(`[${fmt(0)}] [INFO]    客户端 IP: ${log.clientIp ?? 'unknown'}`);
  if (log.requestId) lines.push(`[${fmt(0)}] [INFO]    Request ID: ${log.requestId}`);
  if (log.format === 'sse') {
    lines.push(`[${fmt(1)}] [INFO]    检测到 SSE 协议，准备事件流`);
  } else {
    lines.push(`[${fmt(1)}] [INFO]    校验请求参数`);
  }
  lines.push(`[${fmt(log.responseTime)}] [${log.statusKind === 'success' ? 'SUCCESS' : log.statusKind === 'danger' ? 'ERROR' : 'WARN'}] 响应已返回 ${log.status} (${log.responseTime}ms)`);
  if (log.format === 'sse') {
    lines.push(`[${fmt(log.responseTime)}] [INFO]    SSE 流已结束`);
  }
  return lines.join('\n');
}

function statusText(status: number): string {
  const map: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return map[status] ?? '';
}

function statusKindClass(kind: RequestLogStatusKind): string {
  const base = 'rounded px-1.5 py-0.5 font-mono text-[11.5px] font-semibold';
  if (kind === 'success') return cn(base, 'bg-success-soft text-success');
  if (kind === 'warning') return cn(base, 'bg-warning-soft text-warning');
  if (kind === 'danger') return cn(base, 'bg-danger-soft text-danger');
  return cn(base, 'bg-info-soft text-info');
}

function responseTimeClass(ms: number): string {
  const base = 'rounded px-1.5 py-0.5 font-mono text-[11.5px] font-medium';
  if (ms < 100) return cn(base, 'bg-success-soft text-success');
  if (ms < 500) return cn(base, 'bg-canvas-subtle text-ink-secondary');
  if (ms < 1500) return cn(base, 'bg-warning-soft text-warning');
  return cn(base, 'bg-danger-soft text-danger');
}

function formatDateParts(iso: string): { dateStr: string; timeStr: string; msStr: string } {
  const d = new Date(iso);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const ms = `.${String(d.getMilliseconds()).padStart(3, '0')}`;
  return { dateStr: date, timeStr: time, msStr: ms };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatNumber(n: number): string {
  return n.toLocaleString('zh-CN');
}

// ---------- 图表 ----------
type TrendPoint = { date: string; http: number; ws: number; sse: number };

function TrendChart({ data }: { data: TrendPoint[] | null }) {
  if (!data || data.length === 0) {
    return <div className="px-1 py-8 text-center text-[12px] text-ink-subtle">暂无趋势数据</div>;
  }
  const W = 720, H = 180, pad = 24;
  const max = Math.max(1, ...data.map((d) => d.http + d.ws + d.sse));
  const xStep = (W - pad * 2) / Math.max(1, data.length - 1);
  const points = (key: 'http' | 'ws' | 'sse') =>
    data
      .map((d, i) => {
        const x = pad + i * xStep;
        const y = H - pad - (d[key] / max) * (H - pad * 2);
        return `${x},${y}`;
      })
      .join(' ');
  return (
    <div className="px-1 pt-2">
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="h-[200px] w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
          <line
            key={i}
            x1={pad}
            y1={H - pad - p * (H - pad * 2)}
            x2={W - pad}
            y2={H - pad - p * (H - pad * 2)}
            stroke="#F4F4F5"
            strokeWidth="1"
          />
        ))}
        <defs>
          <linearGradient id="httpGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#09090B" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#09090B" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={points('http')} fill="none" stroke="#09090B" strokeWidth="1.5" />
        <polygon
          points={`${pad},${H - pad} ${points('http')} ${W - pad},${H - pad}`}
          fill="url(#httpGrad)"
        />
        <polyline points={points('ws')} fill="none" stroke="#22C55E" strokeWidth="1.5" />
        <polyline points={points('sse')} fill="none" stroke="#F59E0B" strokeWidth="1.5" />
        {data.map((d, i) => (
          <circle
            key={i}
            cx={pad + i * xStep}
            cy={H - pad - (d.http / max) * (H - pad * 2)}
            r={2}
            fill="#09090B"
          />
        ))}
        {data.map((d, i) => (
          <text
            key={i}
            x={pad + i * xStep}
            y={H + 8}
            textAnchor="middle"
            fontSize="10.5"
            fontFamily="JetBrains Mono, monospace"
            fill="#A1A1AA"
          >
            {d.date}
          </text>
        ))}
      </svg>
    </div>
  );
}

function StatusPieChart({
  distribution,
  total,
}: {
  distribution: { '2xx': number; '3xx': number; '4xx': number; '5xx': number; other: number } | null;
  total: number;
}) {
  const segs = [
    { label: '2xx', value: distribution?.['2xx'] ?? 0, color: '#22C55E' },
    { label: '3xx', value: distribution?.['3xx'] ?? 0, color: '#3B82F6' },
    { label: '4xx', value: distribution?.['4xx'] ?? 0, color: '#F59E0B' },
    { label: '5xx', value: distribution?.['5xx'] ?? 0, color: '#EF4444' },
  ];
  const safeTotal = total > 0 ? total : 1;
  const R = 32;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex items-center gap-4 py-2">
      <svg viewBox="0 0 80 80" className="h-20 w-20 flex-shrink-0">
        <g transform="rotate(-90 40 40)">
          {segs.map((s, i) => {
            const pct = (s.value / safeTotal) * 100;
            const len = (pct / 100) * C;
            const dashArray = `${len} ${C - len}`;
            const dashOffset = -acc;
            acc += len;
            return (
              <circle
                key={i}
                cx="40"
                cy="40"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="9"
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
              />
            );
          })}
        </g>
        <text x="40" y="44" textAnchor="middle" fontSize="13" fontWeight="600" fill="#09090B">
          {formatNumber(total)}
        </text>
      </svg>
      <ul className="space-y-1.5 text-[12px]">
        {segs.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-ink">{s.label}</span>
            <span className="text-ink-tertiary">{formatNumber(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
        <ChevronLeft className="h-3 w-3" />
      </button>
      {items.map((it, i) =>
        it === 'gap' ? (
          <span key={`g-${i}`} className="px-1 text-ink-disabled">
            …
          </span>
        ) : (
          <button
            key={it}
            className={cn('page-btn', it === page && 'active')}
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