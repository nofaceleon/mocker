import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type TabsProps<T extends string> = {
  value: T;
  onChange: (v: T) => void;
  items: Array<{ value: T; label: ReactNode; badge?: ReactNode }>;
  className?: string;
  variant?: 'underline' | 'pill';
};

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
  variant = 'underline',
}: TabsProps<T>) {
  if (variant === 'pill') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-0.5 rounded-md border border-line bg-white p-[3px]',
          className,
        )}
      >
        {items.map((it) => (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            className={cn(
              'rounded px-3 py-1 text-[12px] transition-all',
              value === it.value
                ? 'bg-canvas-deep font-medium text-ink-inverse'
                : 'text-ink-tertiary hover:text-ink',
            )}
          >
            {it.label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className={cn('flex items-center gap-1 border-b border-line', className)}>
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          onClick={() => onChange(it.value)}
          className={cn(
            'relative -mb-px flex items-center gap-1.5 px-3 py-2 text-[13px] transition-colors',
            value === it.value
              ? 'font-medium text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-ink'
              : 'text-ink-tertiary hover:text-ink',
          )}
        >
          {it.label}
          {it.badge && <span className="tag-pill !py-0 !text-[10px]">{it.badge}</span>}
        </button>
      ))}
    </div>
  );
}
