import { RotateCcw, Search } from 'lucide-react';
import { Button, Select, Tabs } from '@/components/ui';
import type { RequestLogHttpMethod, RequestLogRange, RequestLogStatusClass } from '@/hooks/queries/use-request-logs';

const METHOD_OPTIONS: Array<RequestLogHttpMethod | 'all'> = ['all', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const STATUS_OPTIONS: Array<RequestLogStatusClass | 'all'> = ['all', '2xx', '4xx', '5xx'];

type ProjectOption = { id: number; name: string };
type ApiOption = { id: number; name: string; method: string; path: string; projectId?: number | null };

export function LogsFilterBar({
  search,
  onSearchChange,
  projects,
  projectFilter,
  onProjectChange,
  apis,
  apiFilter,
  onApiChange,
  methodFilter,
  onMethodChange,
  statusFilter,
  onStatusChange,
  range,
  onRangeChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  onReset,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  projects: ProjectOption[];
  projectFilter: string;
  onProjectChange: (v: string) => void;
  apis: ApiOption[];
  apiFilter: string;
  onApiChange: (v: string) => void;
  methodFilter: RequestLogHttpMethod | 'all';
  onMethodChange: (v: RequestLogHttpMethod | 'all') => void;
  statusFilter: RequestLogStatusClass | 'all';
  onStatusChange: (v: RequestLogStatusClass | 'all') => void;
  range: RequestLogRange;
  onRangeChange: (v: RequestLogRange) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
  onReset: () => void;
}) {
  const todayStr = new Date().toISOString().split('T')[0];
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="按路径、接口名、IP、Request ID 搜索…"
            className="form-input h-8 pl-8"
          />
        </div>
        <Select
          compact
          value={projectFilter}
          onChange={(e) => onProjectChange(e.target.value)}
          className="w-auto min-w-[120px]"
        >
          <option value="all">全部项目</option>
          {projects.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select
          compact
          value={apiFilter}
          onChange={(e) => onApiChange(e.target.value)}
          className="w-auto min-w-[140px]"
        >
          <option value="all">全部接口</option>
          {apis.map((a) => (
            <option key={a.id} value={String(a.id)}>
              {a.name} · {a.method} {a.path}
            </option>
          ))}
        </Select>
        <Select
          compact
          value={methodFilter}
          onChange={(e) => onMethodChange(e.target.value as RequestLogHttpMethod | 'all')}
          className="w-auto min-w-[110px]"
        >
          {METHOD_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m === 'all' ? '全部方法' : m}
            </option>
          ))}
        </Select>
        <Select
          compact
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as RequestLogStatusClass | 'all')}
          className="w-auto min-w-[110px]"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? '全部状态' : s}
            </option>
          ))}
        </Select>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" />
          重置
        </Button>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="text-[12px] text-ink-tertiary">时间：</span>
        <Tabs<RequestLogRange>
          variant="pill"
          value={range}
          onChange={onRangeChange}
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
                onCustomStartChange(e.target.value);
                if (customEnd && e.target.value > customEnd) onCustomEndChange(e.target.value);
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
                onCustomEndChange(e.target.value);
                if (customStart && e.target.value < customStart) onCustomStartChange(e.target.value);
              }}
              className="form-input h-7 w-auto min-w-[130px] text-[12px]"
            />
          </div>
        )}
      </div>
    </div>
  );
}
