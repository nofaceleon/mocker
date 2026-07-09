import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  Clock,
  Inbox,
  RotateCw,
  Search,
  Send,
  X,
  XCircle,
  Eye,
} from 'lucide-react';
import {
  Button,
  Card,
  Drawer,
  Empty,
  MethodBadge,
  PageHeader,
  StatCard,
  StatusBadge,
  Tabs,
} from '@/components/ui';
import {
  useCallbackStats,
  useCallbackTask,
  useCallbackTasks,
  useCancelCallbackTask,
  useRetryCallbackTask,
} from '@/hooks/queries/use-callback-tasks';
import type { CallbackTaskStatus } from '@/types/api';

const STATUS_TABS: { value: CallbackTaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待发送' },
  { value: 'sent', label: '已发送' },
  { value: 'failed', label: '失败' },
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
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // 写入 url 参数保持可分享
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (apiId !== undefined) next.set('apiId', String(apiId));
    else next.delete('apiId');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiId]);

  const { data: page1, isLoading } = useCallbackTasks({
    apiId,
    status: status === 'all' ? undefined : status,
    keyword: keyword || undefined,
    page,
    pageSize,
  });
  const { data: stats } = useCallbackStats();
  const retryMut = useRetryCallbackTask();
  const cancelMut = useCancelCallbackTask();

  const [selected, setSelected] = useState<number | null>(null);

  const total = page1?.total ?? 0;
  const items = page1?.items ?? [];

  const successRate = useMemo(() => {
    if (!stats || stats.total === 0) return '—';
    const rate = (stats.sent / stats.total) * 100;
    return `${rate.toFixed(0)}%`;
  }, [stats]);

  return (
    <div className="page-container">
      <PageHeader
        title="回调任务管理"
        description="查看、管理所有 Mock 接口产生的异步回调任务"
      />

      <div className="mb-4 grid grid-cols-5 gap-3">
        <StatCard label="待发送" value={stats?.pending ?? 0} icon={<Clock />} />
        <StatCard label="今日已发送" value={stats?.sent ?? 0} icon={<CheckCircle2 />} />
        <StatCard label="失败任务" value={stats?.failed ?? 0} icon={<XCircle />} />
        <StatCard label="累计" value={stats?.total ?? 0} icon={<Inbox />} />
        <StatCard label="成功率" value={successRate} icon={<Activity />} />
      </div>

      <Card
        title="回调任务"
        extra={
          <div className="flex items-center gap-2">
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
            <span className="text-[11px] text-ink-subtle">每 3s 自动刷新</span>
          </div>
        }
      >
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
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
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
                      <td>
                        <div className="flex items-center gap-1">
                          <span className="text-[12.5px] font-medium text-ink">#{t.id}</span>
                          <button
                            type="button"
                            onClick={() => setSelected(t.id)}
                            className="rounded p-1 text-ink-tertiary hover:bg-canvas-subtle hover:text-ink"
                            title="查看详情"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {t.requestId && (
                          <div className="mt-0.5 text-[10.5px] text-ink-subtle">req: {t.requestId}</div>
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
                        <span className="max-w-[260px] truncate text-[12.5px] text-ink-secondary" title={t.callbackUrl}>
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
                        {formatTime(t.scheduledAt)}
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
                          <div className="text-[10.5px] text-ink-subtle">→ {formatTime(t.sentAt)}</div>
                        )}
                      </td>
                      <td className="text-[12px] text-ink-secondary">
                        {t.retryCount} / {t.maxRetries}
                      </td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="查看详情"
                            onClick={() => setSelected(t.id)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {t.status === 'failed' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              title="手动重发"
                              onClick={() => retryMut.mutate(t.id)}
                              disabled={retryMut.isPending}
                            >
                              <RotateCw className="h-3.5 w-3.5" />
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
          </div>
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

      <TaskDetailDrawer
        taskId={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function TaskDetailDrawer({ taskId, onClose }: { taskId: number | null; onClose: () => void }) {
  const { data: task, isLoading } = useCallbackTask(taskId ?? undefined);
  const open = taskId !== null;
  return (
    <Drawer open={open} onClose={onClose} title={task ? `任务 #${task.id} 详情` : '任务详情'} width="md">
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
            <Field label="响应状态">
              {task.responseStatus != null ? (
                <span
                  className={
                    task.responseStatus >= 200 && task.responseStatus < 300
                      ? 'text-success-text'
                      : 'text-danger-text'
                  }
                >
                  {task.responseStatus}
                </span>
              ) : (
                '—'
              )}
            </Field>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">请求头</div>
            <pre className="mono rounded-md bg-canvas-deep p-3 text-[11.5px] text-ink-secondary">
              {task.callbackHeaders ? JSON.stringify(task.callbackHeaders, null, 2) : '—'}
            </pre>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">请求体</div>
            <pre className="mono rounded-md bg-canvas-deep p-3 text-[11.5px] text-ink-secondary">
              {task.callbackBody ?? '—'}
            </pre>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">响应体</div>
            <pre className="mono rounded-md bg-canvas-deep p-3 text-[11.5px] text-ink-secondary">
              {task.responseBody ?? '—'}
            </pre>
          </div>

          {task.errorMessage && (
            <div>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-danger-text">错误信息</div>
              <pre className="mono rounded-md border border-danger-border bg-danger-soft p-3 text-[11.5px] text-danger-text">
                {task.errorMessage}
              </pre>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">{label}</div>
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
