import { useMemo } from 'react';
import {
  Activity,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Inbox,
  LayoutGrid,
  Server,
  TrendingDown,
  XCircle,
  Zap,
} from 'lucide-react';
import { Card, PageHeader, StatCard } from '@/components/ui';
import { useCallbackStats } from '@/hooks/queries/use-callback-tasks';
import { useRequestLogStats } from '@/hooks/queries/use-request-logs';
import { useProjects } from '@/hooks/queries/use-projects';
import { formatNumber } from '@/components/logs/log-shared';

// ---------- 趋势图（复用 LogsAnalyticsBar 逻辑） ----------
type TrendPoint = { date: string; http: number; ws: number; sse: number };

function TrendChart({ data }: { data: TrendPoint[] | null }) {
  if (!data || data.length === 0) {
    return <div className="px-1 py-8 text-center text-[12px] text-ink-subtle">暂无趋势数据</div>;
  }
  const W = 720,
    H = 180,
    pad = 24;
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
            style={{ stroke: 'rgb(var(--chart-grid))' }}
            strokeWidth="1"
          />
        ))}
        <defs>
          <linearGradient id="httpGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'rgb(var(--chart-fg))', stopOpacity: 0.18 }} />
            <stop offset="100%" style={{ stopColor: 'rgb(var(--chart-fg))', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <polyline
          points={points('http')}
          fill="none"
          style={{ stroke: 'rgb(var(--chart-fg))' }}
          strokeWidth="1.5"
        />
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
            style={{ fill: 'rgb(var(--chart-fg))' }}
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
            style={{ fill: 'rgb(var(--chart-axis-text))' }}
          >
            {d.date}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ---------- 状态码分布饼图 ----------
function StatusPieChart({
  distribution,
  total,
}: {
  distribution: { '2xx': number; '3xx': number; '4xx': number; '5xx': number } | null;
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
        <text
          x="40"
          y="44"
          textAnchor="middle"
          fontSize="13"
          fontWeight="600"
          style={{ fill: 'rgb(var(--chart-fg))' }}
        >
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

// ---------- 项目调用排行 ----------
function ProjectRankingCard({
  projects,
}: {
  projects: Array<{ id: number; name: string; callCount?: number }>;
}) {
  const sorted = useMemo(() => {
    if (!projects) return [];
    return [...projects]
      .filter((p) => (p.callCount ?? 0) > 0)
      .sort((a, b) => (b.callCount ?? 0) - (a.callCount ?? 0))
      .slice(0, 10);
  }, [projects]);

  if (sorted.length === 0) {
    return <div className="py-8 text-center text-[12px] text-ink-subtle">暂无调用数据</div>;
  }

  const max = sorted[0]?.callCount ?? 1;

  return (
    <div className="space-y-2.5">
      {sorted.map((p, i) => {
        const pct = ((p.callCount ?? 0) / max) * 100;
        return (
          <div key={p.id} className="flex items-center gap-3">
            <span className="w-5 text-right text-[11px] font-medium text-ink-tertiary">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <span className="truncate text-ink">{p.name}</span>
                <span className="shrink-0 tabular-nums font-mono text-ink-secondary">
                  {formatNumber(p.callCount ?? 0)}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-ink transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- 主页面 ----------
export function StatsPage() {
  const { data: logStats, isLoading: logLoading } = useRequestLogStats('24h');
  const { data: callbackStats } = useCallbackStats();
  const { data: projects } = useProjects();

  const successRate = useMemo(() => {
    if (!callbackStats || callbackStats.total === 0) return '—';
    const rate = (callbackStats.sent / callbackStats.total) * 100;
    return `${rate.toFixed(0)}%`;
  }, [callbackStats]);

  const projectStats = useMemo(() => {
    if (!projects) return { projects: 0, apis: 0, calls: 0, pending: callbackStats?.pending ?? 0 };
    return {
      projects: projects.length,
      apis: projects.reduce((sum, p) => sum + (p.apiCount ?? 0), 0),
      calls: projects.reduce((sum, p) => sum + (p.callCount ?? 0), 0),
      pending: callbackStats?.pending ?? 0,
    };
  }, [projects, callbackStats]);

  return (
    <div className="page-container">
      <PageHeader title="数据统计" description="集中展示调用概览、回调任务和项目调用排行" />

      {/* ========== 区块零：项目概览 ========== */}
      <section className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink">
          <BarChart3 className="h-4 w-4 text-ink-tertiary" />
          项目概览
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="项目总数" value={projectStats.projects} icon={<LayoutGrid />} />
          <StatCard label="Mock 接口" value={projectStats.apis} icon={<Zap />} />
          <StatCard label="累计调用" value={formatNumber(projectStats.calls)} icon={<Activity />} />
          <StatCard label="待发回调" value={projectStats.pending} icon={<Clock />} />
        </div>
      </section>

      {/* ========== 区块一：调用概览 ========== */}
      <section className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink">
          <Activity className="h-4 w-4 text-ink-tertiary" />
          调用概览
        </h2>

        {logLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <StatCard key={i} label="—" value="—" icon={<Activity />} />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="总调用次数"
                value={logStats ? formatNumber(logStats.total) : '—'}
                icon={<Activity />}
              />
              <StatCard
                label="今日调用"
                value={logStats ? formatNumber(logStats.today) : '—'}
                icon={<Calendar />}
              />
              <StatCard
                label="平均响应时间"
                value={logStats ? `${logStats.avgMs}ms` : '—'}
                hint={
                  <span className="inline-flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" /> 实时计算
                  </span>
                }
                icon={<Clock />}
              />
              <StatCard
                label="成功率"
                value={logStats ? `${logStats.successRate}%` : '—'}
                icon={<Server />}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
                <TrendChart data={logStats?.trendPoints ?? null} />
              </Card>
              <Card title="状态码分布">
                <StatusPieChart
                  distribution={logStats?.statusDistribution ?? null}
                  total={logStats?.total ?? 0}
                />
              </Card>
            </div>
          </>
        )}
      </section>

      {/* ========== 区块二：回调任务统计 ========== */}
      <section className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink">
          <BarChart3 className="h-4 w-4 text-ink-tertiary" />
          回调任务
        </h2>

        <div className="grid grid-cols-3 gap-3 lg:grid-cols-5">
          <StatCard label="待发送" value={callbackStats?.pending ?? 0} icon={<Clock />} />
          <StatCard label="今日已发送" value={callbackStats?.sent ?? 0} icon={<CheckCircle2 />} />
          <StatCard label="失败任务" value={callbackStats?.failed ?? 0} icon={<XCircle />} />
          <StatCard label="累计" value={callbackStats?.total ?? 0} icon={<Inbox />} />
          <StatCard label="成功率" value={successRate} icon={<Activity />} />
        </div>
      </section>

      {/* ========== 区块三：项目调用排行 ========== */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink">
          <BarChart3 className="h-4 w-4 text-ink-tertiary" />
          项目调用排行
        </h2>
        <Card>
          <ProjectRankingCard projects={projects ?? []} />
        </Card>
      </section>
    </div>
  );
}
