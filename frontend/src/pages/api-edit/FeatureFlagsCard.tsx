import { useMemo, type ComponentType } from 'react';
import { cn } from '@/lib/cn';
import type { ConfigTab } from './ConfigNav';

export type FeatureRowStatus = {
  /** 配置已存在 */
  configured: boolean;
  /** 人类可读的简述（"insert → users"、"127 行"、"2 条" 等） */
  summary: string;
};

export type FeatureFlagsCardProps = {
  rows: Array<{
    id: 'callback' | 'datalink' | 'script';
    label: string;
    tab: ConfigTab;
    icon: ComponentType<{ className?: string }>;
    status: FeatureRowStatus;
    hidden: boolean;
  }>;
  onJumpTab: (tab: ConfigTab) => void;
  onToggleHidden: (id: 'callback' | 'datalink' | 'script', hidden: boolean) => void;
  className?: string;
};

export function FeatureFlagsCard({
  rows,
  onJumpTab,
  onToggleHidden,
  className,
}: FeatureFlagsCardProps) {
  const anyVisible = useMemo(() => rows.some((r) => !r.hidden), [rows]);

  return (
    <section
      className={cn('mb-5 rounded-lg border border-line bg-canvas-subtle/40 p-4', className)}
    >
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-ink">高级特性</h3>
        <span className="text-[11px] text-ink-tertiary">
          关闭后侧边栏隐藏此面板（不影响接口行为）
        </span>
      </header>
      <ul className="grid gap-2 sm:grid-cols-3">
        {rows.map((row) => {
          const Icon = row.icon;
          const dimmed = row.hidden;
          return (
            <li key={row.id}>
              <div
                className={cn(
                  'group flex h-full flex-col gap-2 rounded-md border bg-canvas px-3 py-2.5 transition-colors',
                  dimmed ? 'border-line-subtle opacity-60' : 'border-line hover:border-line-strong',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded border border-line bg-canvas-subtle text-ink-tertiary [&>svg]:h-3.5 [&>svg]:w-3.5">
                      <Icon />
                    </span>
                    <span className="truncate text-[12.5px] font-medium text-ink">{row.label}</span>
                  </div>
                  <Toggle
                    checked={!row.hidden}
                    onChange={(v) => onToggleHidden(row.id, !v)}
                    title={row.hidden ? '在侧边栏显示' : '从侧边栏隐藏'}
                  />
                </div>

                <div className="flex min-h-[18px] items-center gap-1.5 text-[11.5px]">
                  <StatusDot configured={row.status.configured} />
                  <span
                    className={cn(
                      'truncate',
                      row.status.configured ? 'text-ink-secondary' : 'text-ink-tertiary',
                    )}
                  >
                    {row.status.configured ? row.status.summary : '尚未配置'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onJumpTab(row.tab)}
                  className={cn(
                    'mt-auto self-start rounded px-1.5 py-0.5 text-[11.5px] font-medium transition-colors',
                    dimmed
                      ? 'text-ink-subtle hover:bg-canvas-subtle hover:text-ink-secondary'
                      : 'text-primary hover:bg-primary/5',
                  )}
                >
                  {row.hidden ? '查看' : '打开面板'} →
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {!anyVisible && (
        <p className="mt-3 text-[11px] text-ink-tertiary">已全部隐藏。可通过右上角切换按钮恢复。</p>
      )}
    </section>
  );
}

function StatusDot({ configured }: { configured: boolean }) {
  return (
    <span
      className={cn(
        'inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full',
        configured ? 'bg-success-text' : 'bg-ink-subtle',
      )}
      aria-hidden
    />
  );
}

function Toggle({
  checked,
  onChange,
  title,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        'relative h-4 w-7 flex-shrink-0 rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-ink-subtle/40',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-3 w-3 rounded-full bg-canvas shadow transition-transform',
          checked ? 'translate-x-3.5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
