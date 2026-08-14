import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function StatCard({
  label,
  value,
  hint,
  trend,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trend?: 'up' | 'down' | 'flat';
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3.5 rounded-lg border border-line bg-canvas-elevated p-4 transition-all hover:border-line-strong hover:shadow-sm',
        className,
      )}
    >
      {icon && (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[9px] bg-canvas-deep text-canvas-deep-fg [&>svg]:h-[18px] [&>svg]:w-[18px]">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] font-medium text-ink-tertiary">{label}</div>
        <div className="overflow-hidden text-[22px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
          {value}
        </div>
        {(hint || trend) && (
          <div
            className={cn(
              'mt-0.5 text-[11px]',
              trend === 'up' && 'text-success',
              trend === 'down' && 'text-danger',
              (!trend || trend === 'flat') && 'text-ink-subtle',
            )}
          >
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}
