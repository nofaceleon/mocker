import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Clock,
  Edit2,
  RefreshCw,
  Search,
  Send,
  Trash2,
  X,
  Eye,
} from 'lucide-react';
import {
  Button,
  Card,
  Drawer,
  Empty,
  LiveDot,
  MethodBadge,
  Modal,
  PageHeader,
  StatusBadge,
  Tabs,
} from '@/components/ui';
import {
  useBatchDeleteCallbackTasks,
  useCallbackTask,
  useCallbackTasks,
  useCancelCallbackTask,
  useRetryCallbackTask,
  type CallbackTaskTimeRange,
} from '@/hooks/queries/use-callback-tasks';
import { HeadersBlock, JsonField } from '@/lib/log-format';
import type { CallbackTaskStatus } from '@/types/api';

const STATUS_TABS: { value: CallbackTaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待发送' },
  { value: 'sent', label: '已发送' },
  { value: 'failed', label: '失败' },
];

const RANGE_TABS: { value: CallbackTaskTimeRange; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: '1h', label: '最近 1 小时' },
  { value: '24h', label: '最近 24 小时' },
  { value: '7d', label: '最近 7 天' },
  { value: 'custom', label: '自定义' },
];

const STATUS_MAP: Record<
  CallbackTaskStatus,
  { label: string; status: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  sent: { label: '已发送', status: 'success' },
  failed: { label: '失败', status: 'danger' },
  pending: { label: '待发送', status: 'neutral' },
};

export function CallbackTasksPage() {
  const [params, setParams] = useSearchParams();
  const initialApiId = params.get('apiId') ? Number(params.get('apiId')) : undefined;
  const [apiId, setApiId] = useState<number | undefined>(initialApiId);
  const [status, setStatus] = useState<CallbackTaskStatus | 'all'>('all');
  const [keyword, setKeyword] = useState('');
  const [range, setRange] = useState<CallbackTaskTimeRange>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // 写入 url 参数保持可分享
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (apiId !== undefined) next.set('apiId', String(apiId));
    else next.delete('apiId');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiId]);

  useEffect(() => {
    setPage(1);
  }, [range, customStart, customEnd]);

  const {
    data: page1,
    isLoading,
    refetch,
  } = useCallbackTasks({
    apiId,
    status: status === 'all' ? undefined : status,
    keyword: keyword || undefined,
    range,
    start: range === 'custom' && customStart ? new Date(customStart).getTime() : undefined,
    end: range === 'custom' && customEnd ? new Date(customEnd + 'T23:59:59').getTime() : undefined,
    page,
    pageSize,
  });

  const [progress, setProgress] = useState(0);
  // 进度条驱动的定时刷新（50ms × 100 步 = 5s）
  useEffect(() => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          refetch();
          return 0;
        }
        return prev + 1;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [apiId, status, keyword, range, customStart, customEnd, page, refetch]);
  const retryMut = useRetryCallbackTask();
  const cancelMut = useCancelCallbackTask();
  const batchDeleteMut = useBatchDeleteCallbackTasks();

  const [selected, setSelected] = useState<number | null>(null);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);

  const total = page1?.total ?? 0;
  const items = page1?.items ?? [];

  const allChecked = items.length > 0 && items.every((t) => checkedIds.includes(t.id));
  const someChecked = checkedIds.length > 0;

  function toggleCheckAll() {
    if (allChecked) {
      setCheckedIds((prev) => prev.filter((id) => !items.some((t) => t.id === id)));
    } else {
      setCheckedIds((prev) => Array.from(new Set([...prev, ...items.map((t) => t.id)])));
    }
  }

  function toggleCheckOne(id: number) {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleBatchDelete() {
    try {
      const res = await batchDeleteMut.mutateAsync(checkedIds);
      toast.success(`已删除 ${res.deleted} 条任务`);
      setConfirmBatchDelete(false);
      setCheckedIds([]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '删除失败';
      toast.error(msg);
    }
  }

  return (
    <div className="page-container">
      <PageHeader title="回调任务管理" description="查看、管理所有 Mock 接口产生的异步回调任务" />

      <Card
        noBody
        extra={
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value);
                    setPage(1);
                  }}
                  placeholder="搜索 URL / 接口 / body"
                  className="h-8 w-[220px] rounded-md border border-line bg-white pl-8 pr-3 text-[13px] outline-none focus:border-ink"
                />
              </div>
              {apiId !== undefined && (
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas-subtle px-2 py-px text-[11px] text-ink-secondary">
                  API #{apiId}
                  <button
                    type="button"
                    className="ml-1 text-ink-tertiary hover:text-ink"
                    onClick={() => {
                      setApiId(undefined);
                      setPage(1);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <LiveDot />
              <span className="text-[12px] text-ink-tertiary">实时刷新</span>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-ink transition-[width] duration-100 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="w-8 text-right font-mono text-[11px] text-ink-tertiary">
                {Math.ceil(((100 - progress) * 50) / 1000)}s
              </span>
            </div>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-line-subtle px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-ink-tertiary">状态：</span>
            <Tabs<'all' | CallbackTaskStatus>
              variant="pill"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              items={STATUS_TABS.map((t) => ({
                value: t.value === 'all' ? ('all' as const) : (t.value as CallbackTaskStatus),
                label: t.label,
              }))}
            />
          </div>
          <span className="h-4 w-px bg-line" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-ink-tertiary">时间：</span>
            <Tabs<CallbackTaskTimeRange>
              variant="pill"
              value={range}
              onChange={setRange}
              items={RANGE_TABS.map((t) => ({ value: t.value, label: t.label }))}
            />
          </div>
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
        </div>
        {someChecked && (
          <div className="flex items-center justify-between border-b border-line bg-canvas-subtle px-4 py-2 text-[12px]">
            <span className="text-ink-secondary">已选 {checkedIds.length} 条</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCheckedIds([])}>
                取消选择
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmBatchDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                批量删除 ({checkedIds.length})
              </Button>
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="py-12 text-center text-[13px] text-ink-tertiary">加载中…</div>
        ) : items.length === 0 ? (
          <Empty
            icon={<Send className="h-10 w-10 text-ink-subtle" />}
            title="暂无回调任务"
            description={
              total === 0
                ? '启用接口的「延迟回调」后，调用会生成回调任务'
                : '当前筛选条件下没有任务'
            }
          />
        ) : (
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
                <th>任务</th>
                <th>接口</th>
                <th>回调 URL · 方法</th>
                <th>状态</th>
                <th>计划发送时间</th>
                <th>实际响应</th>
                <th>重试</th>
                <th className="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => {
                const sm = STATUS_MAP[t.status];
                return (
                  <tr key={t.id}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 cursor-pointer rounded accent-ink"
                        checked={checkedIds.includes(t.id)}
                        onChange={() => toggleCheckOne(t.id)}
                      />
                    </td>
                    <td>
                      <div className="text-[12.5px] font-medium text-ink">#{t.id}</div>
                      {t.requestId && (
                        <div
                          className="mt-0.5 truncate text-[10.5px] text-ink-subtle"
                          title={`req: ${t.requestId}`}
                        >
                          req: {t.requestId}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="text-[12.5px]">
                        <div className="font-medium text-ink">{t.apiName ?? `API #${t.apiId}`}</div>
                        <div className="mono text-[10.5px] text-ink-tertiary">
                          {t.apiMethod} {t.apiPath}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className="block max-w-[280px] truncate text-[12.5px] text-ink-secondary"
                        title={t.callbackUrl}
                      >
                        {t.callbackUrl}
                      </span>
                      <div className="mt-0.5">
                        <MethodBadge method={t.callbackMethod as any} />
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={sm.status}>{sm.label}</StatusBadge>
                    </td>
                    <td className="text-[12px] text-ink-secondary">
                      <div>{formatTime(t.scheduledAt)}</div>
                      {t.status === 'pending' && (
                        <div className="mt-0.5">
                          <PendingCountdown target={t.scheduledAt} />
                        </div>
                      )}
                    </td>
                    <td className="text-[12px]">
                      {t.responseStatus != null ? (
                        <span
                          className={
                            t.responseStatus >= 200 && t.responseStatus < 300
                              ? 'text-success-text'
                              : 'text-danger-text'
                          }
                        >
                          {t.responseStatus}
                        </span>
                      ) : (
                        <span className="text-ink-subtle">—</span>
                      )}
                      {t.sentAt && (
                        <div className="text-[10.5px] text-ink-subtle">
                          → {formatTime(t.sentAt)}
                        </div>
                      )}
                    </td>
                    <td className="text-[12px] text-ink-secondary">
                      {t.retryCount} / {t.maxRetries}
                    </td>
                    <td className="text-left">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="查看详情"
                          onClick={() => setSelected(t.id)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {t.projectId && (
                          <Link to={`/projects/${t.projectId}/apis/${t.apiId}`}>
                            <Button variant="ghost" size="sm" title="编辑接口">
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        )}
                        {t.status === 'failed' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            title="手动重发"
                            onClick={() => retryMut.mutate(t.id)}
                            disabled={retryMut.isPending}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {t.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="取消任务"
                            onClick={() => cancelMut.mutate(t.id)}
                            disabled={cancelMut.isPending}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {total > pageSize && (
          <div className="mt-3 flex items-center justify-between border-t border-line-subtle pt-3 text-[12px] text-ink-tertiary">
            <span>
              共 {total} 条 · 第 {page} / {Math.ceil(total / pageSize)} 页
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                上一页
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => (p * pageSize < total ? p + 1 : p))}
                disabled={page * pageSize >= total}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </Card>

      <TaskDetailDrawer taskId={selected} onClose={() => setSelected(null)} />

      <Modal
        open={confirmBatchDelete}
        onClose={() => setConfirmBatchDelete(false)}
        title={`删除选中的 ${checkedIds.length} 条任务？`}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmBatchDelete(false)}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={handleBatchDelete}
              disabled={batchDeleteMut.isPending}
            >
              {batchDeleteMut.isPending ? '删除中…' : '确认删除'}
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink-secondary">
          删除后无法恢复。pending 状态的待发送任务会被一并取消。
        </p>
      </Modal>
    </div>
  );
}

function TaskDetailDrawer({ taskId, onClose }: { taskId: number | null; onClose: () => void }) {
  const { data: task, isLoading } = useCallbackTask(taskId ?? undefined);
  const open = taskId !== null;
  const attempts = task?.attemptLogs?.length
    ? task.attemptLogs
    : task
      ? buildFallbackAttempts(task)
      : [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={task ? `任务 #${task.id} 详情` : '任务详情'}
      width="lg"
    >
      {isLoading || !task ? (
        <div className="py-8 text-center text-[13px] text-ink-tertiary">加载中…</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-[12.5px]">
            <Field label="状态">
              <StatusBadge status={STATUS_MAP[task.status].status}>
                {STATUS_MAP[task.status].label}
              </StatusBadge>
            </Field>
            <Field label="接口">
              <span className="font-medium">{task.apiName}</span>
              <div className="mono text-[11px] text-ink-tertiary">
                {task.apiMethod} {task.apiPath}
              </div>
            </Field>
            <Field label="回调 URL">
              <code className="mono break-all text-[11.5px]">{task.callbackUrl}</code>
            </Field>
            <Field label="方法">{task.callbackMethod}</Field>
            <Field label="计划发送">{formatTime(task.scheduledAt)}</Field>
            <Field label="实际发送">{task.sentAt ? formatTime(task.sentAt) : '—'}</Field>
            <Field label="重试次数">
              {task.retryCount} / {task.maxRetries}
            </Field>
            <Field label="尝试次数">{attempts.length || '—'}</Field>
          </div>

          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">
              发送记录 · 每次请求与响应
            </div>
            {attempts.length === 0 ? (
              <div className="rounded-md border border-line bg-canvas-subtle px-3 py-4 text-center text-[12px] text-ink-subtle">
                {task.status === 'pending' ? '尚未发送，等待调度…' : '暂无发送记录'}
              </div>
            ) : (
              <div className="space-y-3">
                {[...attempts].reverse().map((a) => (
                  <AttemptCard key={`${a.attempt}-${a.at}`} attempt={a} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function AttemptCard({ attempt }: { attempt: import('@/types/api').CallbackAttemptLog }) {
  const outcomeLabel =
    attempt.outcome === 'success'
      ? '成功'
      : attempt.outcome === 'will_retry'
        ? '失败 · 将重试'
        : '失败';
  const outcomeClass =
    attempt.outcome === 'success'
      ? 'border-success-border bg-success-soft text-success-text'
      : attempt.outcome === 'will_retry'
        ? 'border-warning-border bg-warning-soft text-warning'
        : 'border-danger-border bg-danger-soft text-danger-text';

  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-ink">第 {attempt.attempt} 次</span>
        <span
          className={`rounded-full border px-1.5 py-px text-[10.5px] font-medium ${outcomeClass}`}
        >
          {outcomeLabel}
        </span>
        <span className="ml-auto font-mono text-[11px] text-ink-subtle">
          {formatTime(attempt.at)}
        </span>
      </div>

      <div className="mb-2 space-y-1 text-[12px]">
        <div className="flex gap-2">
          <span className="shrink-0 text-ink-tertiary">请求</span>
          <span className="mono break-all text-ink-secondary">
            {attempt.request.method} {attempt.request.url}
          </span>
        </div>
        {attempt.responseStatus != null && (
          <div className="flex gap-2">
            <span className="shrink-0 text-ink-tertiary">状态</span>
            <span
              className={
                attempt.responseStatus >= 200 && attempt.responseStatus < 300
                  ? 'font-medium text-success-text'
                  : 'font-medium text-danger-text'
              }
            >
              {attempt.responseStatus}
            </span>
          </div>
        )}
      </div>

      <div className="mb-2">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">
          请求头
        </div>
        <HeadersBlock headers={attempt.request.headers} emptyHint="无请求头" />
      </div>

      <JsonField label="请求体" value={attempt.request.body} placeholder="空请求体" />

      {attempt.errorMessage ? (
        <div className="mt-2">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-danger-text">
            错误 / 网络异常
          </div>
          <pre className="mono overflow-auto whitespace-pre-wrap rounded-md border border-danger-border bg-danger-soft p-2.5 text-[11.5px] text-danger-text">
            {attempt.errorMessage}
          </pre>
        </div>
      ) : null}

      <div className="mt-2">
        <JsonField
          label="响应体"
          value={attempt.responseBody}
          placeholder={attempt.errorMessage ? '无 HTTP 响应体' : '空响应体'}
        />
      </div>
    </div>
  );
}

/** 兼容旧任务：无 attemptLogs 时用最后一次响应拼一条 */
function buildFallbackAttempts(task: {
  callbackUrl: string;
  callbackMethod: string;
  callbackHeaders: Record<string, string> | null;
  callbackBody: string | null;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  status: string;
  sentAt: string | null;
  createdAt: string;
}): import('@/types/api').CallbackAttemptLog[] {
  if (task.status === 'pending' && task.responseStatus == null && !task.errorMessage) {
    return [];
  }
  if (task.responseStatus == null && !task.errorMessage && !task.responseBody) {
    return [];
  }
  const success =
    task.status === 'sent' ||
    (task.responseStatus != null &&
      task.responseStatus >= 200 &&
      task.responseStatus < 300 &&
      !task.errorMessage);
  return [
    {
      attempt: 1,
      at: task.sentAt || task.createdAt,
      request: {
        url: task.callbackUrl,
        method: task.callbackMethod,
        headers: task.callbackHeaders,
        body: task.callbackBody,
      },
      responseStatus: task.responseStatus,
      responseBody: task.responseBody,
      errorMessage: task.errorMessage,
      outcome: success ? 'success' : 'failed',
    },
  ];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">
        {label}
      </div>
      <div className="text-[12.5px] text-ink">{children}</div>
    </div>
  );
}

function formatTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 待发送任务倒计时：距 scheduledAt 的剩余时间，每秒刷新 */
function PendingCountdown({ target }: { target: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const ts = new Date(target).getTime();
  if (Number.isNaN(ts)) return null;

  const remainMs = ts - now;

  if (remainMs <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-warning-border bg-warning-soft px-1.5 py-px font-mono text-[10.5px] font-medium text-warning">
        已到期 · 即将发送
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas-subtle px-1.5 py-px font-mono text-[10.5px] font-medium text-ink-secondary">
      <Clock className="h-2.5 w-2.5" />
      剩余 {formatCountdown(remainMs)}
    </span>
  );
}

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}
