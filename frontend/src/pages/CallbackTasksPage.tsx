import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  Inbox,
  RotateCw,
  Search,
  Send,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import {
  Button,
  Card,
  Empty,
  MethodBadge,
  PageHeader,
  StatCard,
  StatusBadge,
  Tabs,
} from '@/components/ui';

type TaskStatus = 'sent' | 'pending' | 'retry' | 'failed' | 'cancelled';

type CallbackTask = {
  id: string;
  apiName: string;
  apiPath: string;
  method: string;
  callbackUrl: string;
  callbackMethod: string;
  requestId: string;
  status: TaskStatus;
  retries: number;
  maxRetries: number;
  scheduledAt: string;
  sentAt?: string;
  lastError?: string;
  timeline?: Array<{ time: string; label: string; detail: string; status: 'success' | 'warning' | 'failed' | 'pending' }>;
};

const DEMO_TASKS: CallbackTask[] = [
  {
    id: 'T-1001',
    apiName: '人脸注册',
    apiPath: '/api/face/add',
    method: 'POST',
    callbackUrl: 'https://app.example.com/hooks/face',
    callbackMethod: 'POST',
    requestId: 'req_demo_001',
    status: 'sent',
    retries: 0,
    maxRetries: 3,
    scheduledAt: '13:35:42',
    sentAt: '13:35:47',
    timeline: [
      { time: '13:35:42', label: '创建任务', detail: '已加入待发送队列', status: 'success' },
      { time: '13:35:47', label: '发送成功', detail: '200 OK · 14ms', status: 'success' },
    ],
  },
  {
    id: 'T-1002',
    apiName: '人脸对比',
    apiPath: '/api/face/compare',
    method: 'POST',
    callbackUrl: 'https://app.example.com/hooks/compare',
    callbackMethod: 'POST',
    requestId: 'req_compare_002',
    status: 'retry',
    retries: 2,
    maxRetries: 3,
    scheduledAt: '13:42:00',
    sentAt: '13:42:00',
    lastError: '500 Internal Server Error',
    timeline: [
      { time: '13:42:00', label: '首次发送', detail: '500 Internal Server Error', status: 'failed' },
      { time: '13:42:15', label: '第 1 次重试', detail: '502 Bad Gateway', status: 'failed' },
      { time: '13:42:35', label: '第 2 次重试', detail: '500 Internal Server Error', status: 'warning' },
      { time: '13:42:55', label: '等待第 3 次重试', detail: '将在 20 秒后重试', status: 'pending' },
    ],
  },
  {
    id: 'T-1003',
    apiName: '订单支付',
    apiPath: '/api/order/pay',
    method: 'POST',
    callbackUrl: 'https://app.example.com/hooks/pay',
    callbackMethod: 'POST',
    requestId: 'req_pay_003',
    status: 'pending',
    retries: 0,
    maxRetries: 3,
    scheduledAt: '14:00:00',
    timeline: [
      { time: '13:59:30', label: '创建任务', detail: '已加入待发送队列', status: 'pending' },
    ],
  },
  {
    id: 'T-0995',
    apiName: '微信支付',
    apiPath: '/api/pay/wechat/create',
    method: 'POST',
    callbackUrl: 'https://app.example.com/hooks/wechat',
    callbackMethod: 'POST',
    requestId: 'req_wxpay_995',
    status: 'failed',
    retries: 3,
    maxRetries: 3,
    scheduledAt: '13:18:00',
    sentAt: '13:18:42',
    lastError: '503 Service Unavailable',
    timeline: [
      { time: '13:18:00', label: '首次发送', detail: '503 Service Unavailable', status: 'failed' },
      { time: '13:18:15', label: '第 1 次重试', detail: '503 Service Unavailable', status: 'failed' },
      { time: '13:18:35', label: '第 2 次重试', detail: '503 Service Unavailable', status: 'failed' },
      { time: '13:19:00', label: '第 3 次重试（已用尽）', detail: '503 Service Unavailable · 任务失败', status: 'failed' },
    ],
  },
  {
    id: 'T-0998',
    apiName: '活体检测',
    apiPath: '/api/face/liveness',
    method: 'POST',
    callbackUrl: 'https://app.example.com/hooks/liveness',
    callbackMethod: 'POST',
    requestId: 'req_live_998',
    status: 'sent',
    retries: 0,
    maxRetries: 3,
    scheduledAt: '13:25:00',
    sentAt: '13:25:02',
  },
  {
    id: 'T-0992',
    apiName: '短信回执',
    apiPath: '/api/sms/send',
    method: 'POST',
    callbackUrl: 'https://app.example.com/hooks/sms',
    callbackMethod: 'POST',
    requestId: 'req_sms_992',
    status: 'sent',
    retries: 0,
    maxRetries: 3,
    scheduledAt: '12:55:14',
    sentAt: '12:55:16',
  },
  {
    id: 'T-0988',
    apiName: '活体检测',
    apiPath: '/api/face/liveness',
    method: 'POST',
    callbackUrl: 'https://app.example.com/hooks/liveness',
    callbackMethod: 'POST',
    requestId: 'req_live_988',
    status: 'sent',
    retries: 0,
    maxRetries: 3,
    scheduledAt: '12:31:09',
    sentAt: '12:31:12',
  },
];

const STATUS_LABEL: Record<TaskStatus, { label: string; status: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  sent: { label: '已发送', status: 'success' },
  pending: { label: '待发送', status: 'neutral' },
  retry: { label: '重试中', status: 'warning' },
  failed: { label: '失败', status: 'danger' },
  cancelled: { label: '已取消', status: 'neutral' },
};

export function CallbackTasksPage() {
  const [range, setRange] = useState<'today' | '7d' | '30d' | 'custom'>('7d');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [apiFilter, setApiFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);

  const tasks = useMemo(() => {
    return DEMO_TASKS.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (search && !t.id.toLowerCase().includes(search.toLowerCase()) && !t.apiName.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [search, statusFilter]);

  const stats = useMemo(() => {
    return {
      pending: DEMO_TASKS.filter((t) => t.status === 'pending').length + 11,
      retry: DEMO_TASKS.filter((t) => t.status === 'retry').length + 2,
      sent: DEMO_TASKS.filter((t) => t.status === 'sent').length + 480,
      failed: DEMO_TASKS.filter((t) => t.status === 'failed').length + 7,
      successRate: '98.4%',
    };
  }, []);

  const selectedTask = tasks.find((t) => t.id === selected) ?? null;

  return (
    <div className="page-container">
      <PageHeader
        title="回调任务管理"
        description="查看、管理所有 Mock 接口产生的异步回调任务"
        actions={
          <>
            <Button variant="secondary">
              <Trash2 className="h-3.5 w-3.5" />
              清理已完成
            </Button>
            <Button variant="secondary" className="!border-warning-border !text-warning hover:!bg-warning-soft">
              <RotateCw className="h-3.5 w-3.5" />
              批量重发失败
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="待发送" value={stats.pending} icon={<Clock />} />
        <StatCard label="重试中" value={stats.retry} icon={<RotateCw />} />
        <StatCard label="今日已发送" value={stats.sent} icon={<CheckCircle2 />} />
        <StatCard label="失败任务" value={stats.failed} icon={<XCircle />} />
        <StatCard label="成功率" value={stats.successRate} icon={<Activity />} />
      </div>

      <div className="mb-3.5 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="按任务 ID、接口名搜索…"
              className="form-input h-8 pl-8"
            />
          </div>
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="form-select h-8 w-auto min-w-[120px] text-[12px]">
            <option value="all">全部项目</option>
            <option>人脸识别平台</option>
            <option>支付网关</option>
          </select>
          <select value={apiFilter} onChange={(e) => setApiFilter(e.target.value)} className="form-select h-8 w-auto min-w-[120px] text-[12px]">
            <option value="all">全部接口</option>
            <option>人脸注册</option>
            <option>人脸对比</option>
            <option>订单支付</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-select h-8 w-auto min-w-[120px] text-[12px]">
            <option value="all">全部状态</option>
            <option value="pending">待发送</option>
            <option value="retry">重试中</option>
            <option value="sent">已发送</option>
            <option value="failed">失败</option>
          </select>
          <Button variant="ghost" size="sm">
            重置
          </Button>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[12px] text-ink-tertiary">时间范围：</span>
          <Tabs<'today' | '7d' | '30d' | 'custom'>
            variant="pill"
            value={range}
            onChange={setRange}
            items={[
              { value: 'today', label: '今天' },
              { value: '7d', label: '最近 7 天' },
              { value: '30d', label: '最近 30 天' },
              { value: 'custom', label: '自定义' },
            ]}
          />
          <div className="ml-2 flex items-center gap-1.5">
            <input
              type="text"
              defaultValue="2026-06-30"
              className="form-input h-8 w-[120px] font-mono text-[12px]"
            />
            <span className="text-ink-subtle">至</span>
            <input
              type="text"
              defaultValue="2026-07-06"
              className="form-input h-8 w-[120px] font-mono text-[12px]"
            />
          </div>
        </div>
      </div>

      <Card
        title="回调任务"
        extra={
          <div className="text-[12px] text-ink-tertiary">共 {tasks.length} 条任务 · 已选 0 条</div>
        }
        noBody
      >
        {tasks.length === 0 ? (
          <Empty
            icon={<Inbox className="h-10 w-10 text-ink-subtle" />}
            title="暂无回调任务"
            description="启用接口的「延迟回调」后，调用会生成回调任务"
          />
        ) : (
          <>
            <table className="params-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input type="checkbox" className="h-3.5 w-3.5 cursor-pointer rounded accent-ink" />
                  </th>
                  <th>任务 ID</th>
                  <th>所属接口</th>
                  <th>回调 URL · 方法</th>
                  <th>关联请求</th>
                  <th>状态</th>
                  <th>重试</th>
                  <th>计划发送</th>
                  <th>实际发送</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const st = STATUS_LABEL[t.status];
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelected(t.id === selected ? null : t.id)}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-canvas',
                        selected === t.id && t.status === 'retry' && '!bg-warning-soft',
                        selected === t.id && t.status !== 'retry' && '!bg-canvas-subtle/50',
                      )}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="h-3.5 w-3.5 cursor-pointer rounded accent-ink" />
                      </td>
                      <td>
                        <span className="param-code !text-[12px]">{t.id}</span>
                      </td>
                      <td>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-ink">{t.apiName}</span>
                          <span className="param-code !text-[11px]">{t.apiPath}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col gap-0.5">
                          <span className="max-w-[200px] truncate text-[12.5px] text-ink-secondary">{t.callbackUrl}</span>
                          <MethodBadge method={t.callbackMethod as any} />
                        </div>
                      </td>
                      <td>
                        <span className="param-code !text-[11.5px]">{t.requestId}</span>
                      </td>
                      <td>
                        <StatusBadge status={st.status}>
                          {t.status === 'retry' ? '重试中 · 第 ' + t.retries + ' 次' : st.label}
                        </StatusBadge>
                      </td>
                      <td>
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[11px] font-medium',
                            t.retries === 0
                              ? 'bg-canvas-subtle text-ink-tertiary'
                              : t.retries >= t.maxRetries
                              ? 'bg-danger-soft text-danger'
                              : 'bg-warning-soft text-warning',
                          )}
                        >
                          {t.retries}/{t.maxRetries}
                        </span>
                        {t.status === 'retry' && (
                          <div className="mt-1 h-1 w-14 overflow-hidden rounded-full bg-canvas-subtle">
                            <div
                              className="h-full rounded-full bg-warning transition-all"
                              style={{ width: `${(t.retries / t.maxRetries) * 100}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="font-mono text-[12px] text-ink-tertiary">{t.scheduledAt}</td>
                      <td>
                        {t.sentAt ? (
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 font-mono text-[11.5px]',
                              t.status === 'failed'
                                ? 'bg-danger-soft text-danger'
                                : t.status === 'sent'
                                ? 'bg-success-soft text-success-text'
                                : 'bg-canvas-subtle text-ink-tertiary',
                            )}
                          >
                            {t.sentAt} {t.status === 'sent' ? '(200)' : t.status === 'failed' ? '(503)' : '(500)'}
                          </span>
                        ) : (
                          <span className="text-ink-subtle">—</span>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {t.status === 'failed' ? (
                            <>
                              <button className="rounded px-1.5 py-0.5 text-[12px] font-medium text-warning transition-colors hover:bg-warning-soft">
                                重发
                              </button>
                              <button className="rounded p-1 text-ink-subtle transition-colors hover:bg-canvas-subtle">
                                <Eye className="h-3 w-3" />
                              </button>
                            </>
                          ) : t.status === 'pending' ? (
                            <>
                              <button className="rounded p-1 text-ink-subtle transition-colors hover:bg-canvas-subtle" title="编辑">
                                <Edit3 className="h-3 w-3" />
                              </button>
                              <button className="rounded p-1 text-ink-subtle transition-colors hover:bg-danger-soft hover:text-danger" title="取消">
                                <X className="h-3 w-3" />
                              </button>
                            </>
                          ) : (
                            <button className="rounded p-1 text-ink-subtle transition-colors hover:bg-canvas-subtle" title="详情">
                              <Eye className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {selectedTask && (
              <div className="border-t border-line bg-canvas px-5 py-4">
                <TaskDetail task={selectedTask} onClose={() => setSelected(null)} />
              </div>
            )}

            <div className="flex items-center justify-between border-t border-line bg-canvas px-4 py-2.5 text-[12px] text-ink-tertiary">
              <span>共 {tasks.length} 条任务 · 已选 0 条</span>
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
          </>
        )}
      </Card>
    </div>
  );
}

function TaskDetail({ task }: { task: CallbackTask; onClose: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold tracking-[-0.005em] text-ink">
          <Clock className="h-3.5 w-3.5 text-ink-tertiary" />
          执行时间线
        </h3>
        <ol className="relative ml-1.5 space-y-3 border-l border-dashed border-line-strong pl-5">
          {(task.timeline ?? []).map((ev, i) => (
            <li key={i} className="relative">
              <span
                className={cn(
                  'absolute -left-[26px] grid h-2.5 w-2.5 place-items-center rounded-full ring-2 ring-white',
                  ev.status === 'success' && 'bg-success',
                  ev.status === 'warning' && 'bg-warning',
                  ev.status === 'failed' && 'bg-danger',
                  ev.status === 'pending' && 'bg-ink-subtle',
                )}
              />
              <div className="font-mono text-[11.5px] text-ink-tertiary">{ev.time}</div>
              <div className="mt-0.5 text-[13px] font-medium text-ink">{ev.label}</div>
              <div className="mt-0.5 text-[12px] text-ink-secondary">{ev.detail}</div>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold tracking-[-0.005em] text-ink">
          <Send className="h-3.5 w-3.5 text-ink-tertiary" />
          最近一次请求 / 响应
        </h3>
        <pre className="code-content !rounded-md">
          <span className="com"># REQUEST</span>
          {'\n'}
          {task.callbackMethod} {task.callbackUrl}
          {'\n'}
          Content-Type: application/json
          {'\n'}
          X-Request-Id: {task.requestId}
          {'\n\n'}
          <span className="brkt">{'{'}</span>
          {'\n  '}
          <span className="key">"event"</span>: <span className="str">"callback.delivered"</span>,
          {'\n  '}
          <span className="key">"requestId"</span>: <span className="str">"{task.requestId}"</span>,
          {'\n  '}
          <span className="key">"code"</span>: <span className="num">0</span>,
          {'\n  '}
          <span className="key">"data"</span>: <span className="brkt">{'{ /* 业务数据 */ }'}</span>
          {'\n'}
          <span className="brkt">{'}'}</span>
          {'\n\n'}
          <span className="com"># RESPONSE</span>
          {'\n'}
          {task.status === 'failed' ? (
            <>
              <span className="kw" style={{ color: '#F87171' }}>503 Service Unavailable</span>
              {'\n'}
              <span className="brkt">{'{'}</span>
              {'\n  '}
              <span className="key">"error"</span>: <span className="str">"upstream temporarily unavailable"</span>
              {'\n'}
              <span className="brkt">{'}'}</span>
            </>
          ) : task.status === 'retry' ? (
            <>
              <span className="kw" style={{ color: '#F87171' }}>500 Internal Server Error</span>
              {'\n'}
              <span className="brkt">{'{'}</span>
              {'\n  '}
              <span className="key">"error"</span>: <span className="str">"internal server error"</span>
              {'\n'}
              <span className="brkt">{'}'}</span>
            </>
          ) : (
            <>
              <span className="kw" style={{ color: '#86EFAC' }}>200 OK</span>
              {'\n'}
              <span className="brkt">{'{'}</span>
              {'\n  '}
              <span className="key">"success"</span>: <span className="kw">true</span>
              {'\n'}
              <span className="brkt">{'}'}</span>
            </>
          )}
        </pre>
      </div>
    </div>
  );
}

function cn(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(' ');
}
