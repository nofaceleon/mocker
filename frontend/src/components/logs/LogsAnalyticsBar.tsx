import { Activity, Calendar, Clock, Server, TrendingDown } from 'lucide-react';
import { Card, StatCard } from '@/components/ui';
import { formatNumber } from './log-shared';
import type { RequestLogStats } from '@/types/api';

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
  distribution: RequestLogStats['statusDistribution'] | null;
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

export function LogsAnalyticsBar({
  stats,
  isLoading,
}: {
  stats: RequestLogStats | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <StatCard key={i} label="—" value="—" icon={<Activity />} />
        ))}
      </div>
    );
  }
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="总调用次数"
          value={stats ? formatNumber(stats.total) : '—'}
          icon={<Activity />}
        />
        <StatCard
          label="今日调用"
          value={stats ? formatNumber(stats.today) : '—'}
          icon={<Calendar />}
        />
        <StatCard
          label="平均响应时间"
          value={stats ? `${stats.avgMs}ms` : '—'}
          hint={
            <span className="inline-flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> 实时计算
            </span>
          }
          icon={<Clock />}
        />
        <StatCard label="成功率" value={stats ? `${stats.successRate}%` : '—'} icon={<Server />} />
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
          <TrendChart data={stats?.trendPoints ?? null} />
        </Card>
        <Card title="状态码分布">
          <StatusPieChart
            distribution={stats?.statusDistribution ?? null}
            total={stats?.total ?? 0}
          />
        </Card>
      </div>
    </>
  );
}
