import { RotateCcw, Pause, Play } from 'lucide-react';
import { Button, LiveDot } from '@/components/ui';
import { useMemo } from 'react';

export function LogsStatusStrip({
  lastUpdatedAt: _lastUpdatedAt,
  refreshProgress,
  paused,
  onTogglePause,
  onRefreshNow,
}: {
  lastUpdatedAt: number;
  refreshProgress: number;
  paused: boolean;
  onTogglePause: () => void;
  onRefreshNow: () => void;
}) {
  const remaining = useMemo(() => Math.ceil(((100 - refreshProgress) * 50) / 1000), [refreshProgress]);
  return (
    <div className="flex items-center gap-2">
      <LiveDot />
      <span className="text-[12px] text-ink-tertiary">实时刷新</span>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-ink transition-[width] duration-100 ease-linear"
          style={{ width: `${refreshProgress}%` }}
        />
      </div>
      <span className="w-8 text-right font-mono text-[11px] text-ink-tertiary">{remaining}s</span>
      <Button variant="ghost" size="sm" onClick={onTogglePause} title={paused ? '继续自动刷新' : '暂停自动刷新'}>
        {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
      </Button>
      <Button variant="ghost" size="sm" onClick={onRefreshNow}>
        <RotateCcw className="h-3 w-3" />
      </Button>
    </div>
  );
}
