import { useMemo, useState } from 'react';
import {
  Activity,
  Calendar,
  ChevronRight,
  Clock,
  Download,
  Inbox,
  Search,
  Server,
  TrendingUp,
  TrendingDown,
  Trash2,
  X,
} from 'lucide-react';
import {
  Button,
  Card,
  Empty,
  LiveDot,
  MethodBadge,
  PageHeader,
  StatCard,
  Tabs,
} from '@/components/ui';

type LogStatus = 'success' | 'warning' | 'danger' | 'info';
type HttpMethod_ = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

type LogRow = {
  id: string;
  time: string;
  ms: string;
  method: HttpMethod_;
  path: string;
  api: string;
  group: string;
  request: string;
  status: number;
  statusKind: LogStatus;
  responseMs: number;
  ip: string;
  requestId: string;
};

const DEMO_LOGS: LogRow[] = [
  { id: 'L-2401', time: '2026-07-06 13:35:42', ms: '.128', method: 'POST', path: '/api/face/add', api: '人脸注册', group: '人脸管理', request: '{ name, imageUrl, requestId, callbackUrl }', status: 200, statusKind: 'success', responseMs: 12, ip: '192.168.1.10', requestId: 'req_demo_001' },
  { id: 'L-2400', time: '2026-07-06 13:35:38', ms: '.204', method: 'GET', path: '/api/face/list?page=1&size=10', api: '人脸查询', group: '人脸管理', request: '{ page: 1, size: 10 }', status: 200, statusKind: 'success', responseMs: 28, ip: '192.168.1.10', requestId: 'req_query_002' },
  { id: 'L-2399', time: '2026-07-06 13:35:31', ms: '.512', method: 'POST', path: '/api/face/notfound', api: '异常：人脸未找到', group: '人脸管理', request: '{ faceId: "missing_001" }', status: 404, statusKind: 'danger', responseMs: 102, ip: '192.168.1.10', requestId: 'req_err_003' },
  { id: 'L-2398', time: '2026-07-06 13:35:18', ms: '.704', method: 'POST', path: '/api/face/compare', api: '人脸对比', group: '人脸管理', request: '{ source, target }', status: 200, statusKind: 'success', responseMs: 1502, ip: '192.168.1.10', requestId: 'req_compare_004' },
  { id: 'L-2397', time: '2026-07-06 13:35:11', ms: '.083', method: 'POST', path: '/api/pay/wechat/create', api: '微信支付', group: '支付网关', request: '{ orderId, amount: 99 }', status: 400, statusKind: 'warning', responseMs: 8, ip: '192.168.1.12', requestId: 'req_wxpay_005' },
  { id: 'L-2396', time: '2026-07-06 13:34:58', ms: '.245', method: 'DELETE', path: '/api/face/face_1720109876', api: '人脸删除', group: '人脸管理', request: '{ faceId: "face_1720109876" }', status: 204, statusKind: 'success', responseMs: 15, ip: '192.168.1.10', requestId: 'req_del_006' },
  { id: 'L-2395', time: '2026-07-06 13:34:42', ms: '.901', method: 'GET', path: '/api/sms/send?phone=13800...', api: '短信发送', group: '短信通知', request: '{ phone, template, vars }', status: 200, statusKind: 'success', responseMs: 45, ip: '192.168.1.15', requestId: 'req_sms_007' },
];

export function LogsPage() {
  const [range, setRange] = useState<'1h' | '24h' | '7d' | 'custom'>('24h');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [apiFilter, setApiFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);

  const logs = useMemo(() => {
    return DEMO_LOGS.filter((l) => {
      if (search && !l.path.toLowerCase().includes(search.toLowerCase()) && !l.api.toLowerCase().includes(search.toLowerCase())) return false;
      if (methodFilter !== 'all' && l.method !== methodFilter) return false;
      if (statusFilter !== 'all') {
        if (statusFilter === '2xx' && l.status >= 300) return false;
        if (statusFilter === '4xx' && (l.status < 400 || l.status >= 500)) return false;
        if (statusFilter === '5xx' && l.status < 500) return false;
      }
      return true;
    });
  }, [search, methodFilter, statusFilter]);

  return (
    <div className="page-container">
      <PageHeader
        title="调用日志"
        description="所有 Mock 接口的请求记录，便于调试和回溯问题"
        actions={
          <>
            <Button variant="secondary">
              <Download className="h-3.5 w-3.5" />
              导出日志
            </Button>
            <Button variant="danger">
              <Trash2 className="h-3.5 w-3.5" />
              清除全部
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="总调用次数"
          value="12,847"
          hint={
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> +12.5% 较上周
            </span>
          }
          trend="up"
          icon={<Activity />}
        />
        <StatCard
          label="今日调用"
          value="2,431"
          hint={
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> +8.3% 较昨日
            </span>
          }
          trend="up"
          icon={<Calendar />}
        />
        <StatCard
          label="平均响应时间"
          value="42ms"
          hint={
            <span className="inline-flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> -3ms 优化中
            </span>
          }
          trend="up"
          icon={<Clock />}
        />
        <StatCard
          label="成功率"
          value="98.7%"
          hint={
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> +0.2% 较上周
            </span>
          }
          trend="up"
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
          <TrendChart />
        </Card>
        <Card title="状态码分布">
          <StatusPieChart />
        </Card>
      </div>

      <div className="mb-3.5 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="按路径、接口名、IP 搜索…"
              className="form-input h-8 pl-8"
            />
          </div>
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="form-select h-8 w-auto min-w-[120px] text-[12px]">
            <option value="all">全部项目</option>
          </select>
          <select value={apiFilter} onChange={(e) => setApiFilter(e.target.value)} className="form-select h-8 w-auto min-w-[120px] text-[12px]">
            <option value="all">全部接口</option>
          </select>
          <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="form-select h-8 w-auto min-w-[110px] text-[12px]">
            <option value="all">全部方法</option>
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>DELETE</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-select h-8 w-auto min-w-[110px] text-[12px]">
            <option value="all">全部状态</option>
            <option value="2xx">2xx</option>
            <option value="4xx">4xx</option>
            <option value="5xx">5xx</option>
          </select>
          <Button variant="ghost" size="sm">重置</Button>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[12px] text-ink-tertiary">时间：</span>
          <Tabs<'1h' | '24h' | '7d' | 'custom'>
            variant="pill"
            value={range}
            onChange={setRange}
            items={[
              { value: '1h', label: '最近 1 小时' },
              { value: '24h', label: '最近 24 小时' },
              { value: '7d', label: '最近 7 天' },
              { value: 'custom', label: '自定义' },
            ]}
          />
          <div className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-ink-tertiary">
            <LiveDot />
            实时刷新中
          </div>
        </div>
      </div>

      <Card
        title={`调用日志 · ${logs.length} 条`}
        noBody
      >
        {logs.length === 0 ? (
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
                    <input type="checkbox" className="h-3.5 w-3.5 cursor-pointer rounded accent-ink" />
                  </th>
                  <th>调用时间</th>
                  <th>方法</th>
                  <th>路径</th>
                  <th>所属接口</th>
                  <th>请求参数</th>
                  <th>状态</th>
                  <th>响应时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => setSelected(l.id === selected ? null : l.id)}
                    className="cursor-pointer hover:bg-canvas"
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="h-3.5 w-3.5 cursor-pointer rounded accent-ink" />
                    </td>
                    <td>
                      <div className="flex flex-col leading-tight">
                        <span className="text-ink">{l.time.split(' ')[0]}</span>
                        <span className="font-mono text-[11px] text-ink-subtle">
                          {l.time.split(' ')[1]}
                          <span className="text-ink-disabled">{l.ms}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <MethodBadge method={l.method} />
                    </td>
                    <td>
                      <span className="param-code max-w-[260px] truncate">{l.path}</span>
                    </td>
                    <td>
                      <div className="flex flex-col leading-tight">
                        <span className="text-ink">{l.api}</span>
                        <span className="text-[11px] text-ink-subtle">（{l.group}）</span>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono text-[11.5px] text-ink-tertiary">{l.request}</span>
                    </td>
                    <td>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 font-mono text-[11.5px] font-semibold',
                          l.statusKind === 'success' && 'bg-success-soft text-success',
                          l.statusKind === 'warning' && 'bg-warning-soft text-warning',
                          l.statusKind === 'danger' && 'bg-danger-soft text-danger',
                          l.statusKind === 'info' && 'bg-info-soft text-info',
                        )}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 font-mono text-[11.5px] font-medium',
                          l.responseMs < 100
                            ? 'bg-success-soft text-success'
                            : l.responseMs < 500
                            ? 'bg-canvas-subtle text-ink-secondary'
                            : l.responseMs < 1500
                            ? 'bg-warning-soft text-warning'
                            : 'bg-danger-soft text-danger',
                        )}
                      >
                        {l.responseMs} ms
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm">
                        查看
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selected && (
              <div className="border-t border-line bg-canvas px-5 py-4">
                <LogDetail log={logs.find((l) => l.id === selected)!} onClose={() => setSelected(null)} />
              </div>
            )}

            <div className="flex items-center justify-between border-t border-line bg-canvas px-4 py-2.5 text-[12px] text-ink-tertiary">
              <span>显示 1 - {Math.min(logs.length, 8)} 条 / 共 2,431 条 · 已选 0 条</span>
              <div className="flex items-center gap-0.5">
                <button className="page-btn">‹</button>
                <button className="page-btn active">1</button>
                <button className="page-btn">2</button>
                <button className="page-btn">3</button>
                <button className="page-btn">4</button>
                <button className="page-btn">5</button>
                <span className="px-1 text-ink-disabled">…</span>
                <button className="page-btn">305</button>
                <button className="page-btn">›</button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function LogDetail({ log, onClose }: { log: LogRow; onClose: () => void }) {
  const [tab, setTab] = useState<'request' | 'response' | 'headers' | 'script'>('request');
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-[-0.005em] text-ink">
          <span className="font-mono">{log.method}</span>
          <span className="font-mono text-ink-secondary">{log.path}</span>
        </h3>
        <button onClick={onClose} className="rounded p-1 text-ink-tertiary hover:bg-canvas-subtle hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <Tabs<'request' | 'response' | 'headers' | 'script'>
        value={tab}
        onChange={setTab}
        className="mb-3"
        items={[
          { value: 'request', label: 'Request' },
          { value: 'response', label: 'Response' },
          { value: 'headers', label: 'Headers' },
          { value: 'script', label: '脚本执行日志' },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">终端日志</h4>
          <pre className="code-content !rounded-md !p-3 !text-[12px]">
            <span className="ts" style={{ color: '#6B7280' }}>[13:35:42.128]</span> <span style={{ color: '#93C5FD' }}>INFO</span>  接收请求 <span style={{ color: '#C4B5FD' }}>POST /api/face/add</span>
            {'\n'}
            <span className="ts" style={{ color: '#6B7280' }}>[13:35:42.130]</span> <span style={{ color: '#93C5FD' }}>INFO</span>  客户端 IP: 192.168.1.10
            {'\n'}
            <span className="ts" style={{ color: '#6B7280' }}>[13:35:42.131]</span> <span style={{ color: '#93C5FD' }}>INFO</span>  加载脚本 mock-script.js (3.2 KB)
            {'\n'}
            <span className="ts" style={{ color: '#6B7280' }}>[13:35:42.135]</span> <span style={{ color: '#FBBF24' }}>WARN</span>  参数校验: imageUrl 长度 &gt; 256，已截断
            {'\n'}
            <span className="ts" style={{ color: '#6B7280' }}>[13:35:42.137]</span> <span style={{ color: '#93C5FD' }}>INFO</span>  数据联动: db.insert(face_data) → 42 rows
            {'\n'}
            <span className="ts" style={{ color: '#6B7280' }}>[13:35:42.138]</span> <span style={{ color: '#86EFAC' }}>SUCCESS</span>  创建回调任务 <span style={{ color: '#C4B5FD' }}>T-1001</span>
            {'\n'}
            <span className="ts" style={{ color: '#6B7280' }}>[13:35:42.139]</span> <span style={{ color: '#93C5FD' }}>INFO</span>  调度器: 5 秒后执行回调
            {'\n'}
            <span className="ts" style={{ color: '#6B7280' }}>[13:35:42.140]</span> <span style={{ color: '#86EFAC' }}>SUCCESS</span>  响应已发送 · 14ms
            {'\n'}
            <span className="ts" style={{ color: '#6B7280' }}>[13:35:42.140]</span> <span style={{ color: '#86EFAC' }}>SUCCESS</span>  <span style={{ color: '#86EFAC' }}>200</span> (12ms)
          </pre>
        </div>
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">请求摘要</h4>
          <div className="space-y-2 rounded-md border border-line bg-white p-3 text-[12.5px]">
            <Row k="Method" v={log.method} mono />
            <Row k="URL" v={`http://localhost:3001${log.path}`} mono />
            <Row k="Client IP" v={log.ip} mono />
            <Row k="User-Agent" v="MockStudio-CLI/0.1.0" mono />
            <Row k="Request ID" v={log.requestId} mono />
            <Row k="HTTP Ver." v="HTTP/1.1" mono />
            <Row
              k="Status"
              v={
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 font-mono text-[11.5px] font-semibold',
                    log.statusKind === 'success' && 'bg-success-soft text-success',
                    log.statusKind === 'warning' && 'bg-warning-soft text-warning',
                    log.statusKind === 'danger' && 'bg-danger-soft text-danger',
                  )}
                >
                  {log.status} {log.status === 200 ? 'OK' : log.status === 404 ? 'Not Found' : ''}
                </span>
              }
            />
            <Row k="Response Size" v="248 B" mono />
            <Row k="Total Time" v={`${log.responseMs} ms`} mono />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-[90px] flex-shrink-0 text-ink-tertiary">{k}</span>
      <span className={mono ? 'font-mono' : ''}>{v}</span>
    </div>
  );
}

// 简易 SVG 折线图（按设计稿）
function TrendChart() {
  const data = [
    { x: '06-30', http: 320, ws: 80, sse: 40 },
    { x: '07-01', http: 410, ws: 95, sse: 50 },
    { x: '07-02', http: 380, ws: 110, sse: 45 },
    { x: '07-03', http: 480, ws: 130, sse: 60 },
    { x: '07-04', http: 520, ws: 140, sse: 70 },
    { x: '07-05', http: 460, ws: 120, sse: 65 },
    { x: '07-06', http: 580, ws: 160, sse: 80 },
  ];
  const W = 720, H = 180, pad = 24;
  const max = 600;
  const xStep = (W - pad * 2) / (data.length - 1);

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
        {/* Y grid */}
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
        {/* 渐变 */}
        <defs>
          <linearGradient id="httpGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#09090B" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#09090B" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* HTTP 折线 + 填充 */}
        <polyline
          points={points('http')}
          fill="none"
          stroke="#09090B"
          strokeWidth="1.5"
        />
        <polygon
          points={`${pad},${H - pad} ${points('http')} ${W - pad},${H - pad}`}
          fill="url(#httpGrad)"
        />
        <polyline
          points={points('ws')}
          fill="none"
          stroke="#22C55E"
          strokeWidth="1.5"
        />
        <polyline
          points={points('sse')}
          fill="none"
          stroke="#F59E0B"
          strokeWidth="1.5"
        />
        {/* 数据点 */}
        {data.map((d, i) => (
          <g key={i}>
            <circle
              cx={pad + i * xStep}
              cy={H - pad - (d.http / max) * (H - pad * 2)}
              r={i === 3 ? 3.5 : 2}
              fill="#09090B"
            />
          </g>
        ))}
        {/* X 轴标签 */}
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
            {d.x}
          </text>
        ))}
        {/* 第 4 天的引导虚线 */}
        <line
          x1={pad + 3 * xStep}
          y1={pad}
          x2={pad + 3 * xStep}
          y2={H - pad}
          stroke="#D4D4D8"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      </svg>
    </div>
  );
}

function StatusPieChart() {
  // 89% 2xx / 6% 4xx / 3% 5xx / 2% 3xx
  const segs = [
    { label: '2xx', pct: 89, color: '#22C55E' },
    { label: '4xx', pct: 6, color: '#F59E0B' },
    { label: '5xx', pct: 3, color: '#EF4444' },
    { label: '3xx', pct: 2, color: '#3B82F6' },
  ];
  const R = 32;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex items-center gap-4 py-2">
      <svg viewBox="0 0 80 80" className="h-20 w-20 flex-shrink-0">
        <g transform="rotate(-90 40 40)">
          {segs.map((s, i) => {
            const len = (s.pct / 100) * C;
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
        <text x="40" y="44" textAnchor="middle" fontSize="14" fontWeight="600" fill="#09090B">
          2,431
        </text>
      </svg>
      <ul className="space-y-1.5 text-[12px]">
        {segs.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-ink">{s.label}</span>
            <span className="text-ink-tertiary">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function cn(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(' ');
}
