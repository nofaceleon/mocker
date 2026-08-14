import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type FilterChipOption<T extends string = string> = {
  value: T;
  label: ReactNode;
  hint?: ReactNode;
};

type FilterChipProps<T extends string> = {
  label: ReactNode;
  value: T | null;
  options: FilterChipOption<T>[];
  onChange: (v: T | null) => void;
  placeholder?: ReactNode;
  clearable?: boolean;
  className?: string;
  align?: 'left' | 'right';
  /** 内容超出时可显示在 chip 上的描述，默认取当前选项 label */
  display?: ReactNode;
  /** 触发器高度，默认 32 */
  size?: 'sm' | 'md';
};

/**
 * 紧凑过滤 chip：button + 下拉菜单。
 * 受控 value，支持 null（= 全部），可一键清除。
 */
export function FilterChip<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder,
  clearable = true,
  className,
  align = 'left',
  display,
  size = 'md',
}: FilterChipProps<T>) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 外点关闭
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);
  const active = value !== null && value !== ('' as unknown as T);
  const h = size === 'sm' ? 'h-7' : 'h-8';

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded border px-3 text-[12.5px] transition-colors',
          h,
          active
            ? 'border-ink bg-ink/[0.04] text-ink'
            : 'border-line bg-canvas-elevated text-ink-secondary hover:border-line-strong hover:text-ink',
        )}
      >
        <span className="text-ink-tertiary">{label}</span>
        <span
          className={cn(
            'max-w-[160px] truncate font-medium',
            active ? 'text-ink' : 'text-ink-secondary',
          )}
        >
          {display ?? current?.label ?? placeholder ?? '全部'}
        </span>
        <ChevronDown
          className={cn('h-3 w-3 text-ink-tertiary transition-transform', open && 'rotate-180')}
        />
        {clearable && active && (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="-mr-1 ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-ink-tertiary hover:bg-canvas-subtle hover:text-ink"
            title="清除"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            'absolute top-full z-30 mt-1.5 min-w-[160px] overflow-hidden rounded-lg border border-line bg-canvas-elevated shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <ul className="max-h-[280px] overflow-auto py-1 scrollbar-modern">
            <li>
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-1.5 text-left text-[12.5px] transition-colors',
                  !active
                    ? 'bg-canvas-subtle text-ink'
                    : 'text-ink-secondary hover:bg-canvas-subtle',
                )}
              >
                <span>{placeholder ?? '全部'}</span>
                {!active && <Check className="h-3 w-3 text-ink" />}
              </button>
            </li>
            {options.map((opt) => {
              const selected = opt.value === value;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[12.5px] transition-colors',
                      selected
                        ? 'bg-canvas-subtle text-ink'
                        : 'text-ink-secondary hover:bg-canvas-subtle hover:text-ink',
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {selected && <Check className="h-3 w-3 flex-shrink-0 text-ink" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
