import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

/** 兼容原生 select 的 onChange 形态 */
export type SelectChangeEvent = { target: { value: string; name?: string } };

type OptionItem = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

type SelectProps = {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: SelectChangeEvent) => void;
  disabled?: boolean;
  invalid?: boolean;
  compact?: boolean;
  className?: string;
  name?: string;
  id?: string;
  title?: string;
  children: ReactNode;
};

function parseOptions(children: ReactNode): OptionItem[] {
  const items: OptionItem[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{
      value?: string | number;
      disabled?: boolean;
      children?: ReactNode;
    }>;
    if (typeof el.type === 'string' && el.type === 'option') {
      items.push({
        value: String(el.props.value ?? ''),
        label: el.props.children,
        disabled: Boolean(el.props.disabled),
      });
    }
  });
  return items;
}

export function Select({
  value,
  defaultValue,
  onChange,
  disabled,
  invalid,
  compact,
  className,
  name,
  id,
  title,
  children,
}: SelectProps) {
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [uncontrolled, setUncontrolled] = useState(
    defaultValue !== undefined ? String(defaultValue) : '',
  );
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [highlight, setHighlight] = useState(-1);

  const options = useMemo(() => parseOptions(children), [children]);
  const current = value !== undefined ? String(value) : uncontrolled;
  const selected = options.find((o) => o.value === current);
  const selectedLabel = selected?.label ?? (current || '请选择');

  const updateMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuMaxH = 240;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < Math.min(menuMaxH, 160) && spaceAbove > spaceBelow;
    const maxH = Math.min(menuMaxH, openUp ? spaceAbove : spaceBelow);

    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 120),
      maxHeight: Math.max(120, maxH),
      zIndex: 300,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onScroll = () => updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const idx = Math.max(
      0,
      options.findIndex((o) => o.value === current && !o.disabled),
    );
    setHighlight(idx);
    requestAnimationFrame(() => listRef.current?.focus());
  }, [open, options, current]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const commit = (next: string) => {
    if (value === undefined) setUncontrolled(next);
    onChange?.({ target: { value: next, name } });
    setOpen(false);
    triggerRef.current?.focus();
  };

  const moveHighlight = (dir: 1 | -1) => {
    if (options.length === 0) return;
    let i = highlight;
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length;
      if (!options[i].disabled) {
        setHighlight(i);
        return;
      }
    }
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveHighlight(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveHighlight(-1);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const opt = options[highlight];
      if (opt && !opt.disabled) commit(opt.value);
      return;
    }
    if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        title={title}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'form-select flex w-full items-center justify-between gap-1.5 text-left',
          compact && 'form-select-sm',
          invalid && 'border-danger',
          open && '!border-ink !bg-white shadow-[0_0_0_3px_rgba(9,9,11,0.08)]',
          disabled && 'cursor-not-allowed',
        )}
      >
        <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 flex-shrink-0 text-ink-subtle transition-transform duration-150',
            open && 'rotate-180',
            compact && 'h-3 w-3',
          )}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            style={menuStyle}
            onKeyDown={onListKeyDown}
            className="overflow-auto rounded-lg border border-line bg-white py-1 shadow-[0_8px_30px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)] outline-none scrollbar-modern"
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-ink-subtle">暂无选项</div>
            ) : (
              options.map((opt, i) => {
                const isSelected = opt.value === current;
                const isActive = i === highlight;
                return (
                  <button
                    key={`${opt.value}-${i}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onMouseEnter={() => !opt.disabled && setHighlight(i)}
                    onClick={() => !opt.disabled && commit(opt.value)}
                    className={cn(
                      'flex w-full items-center gap-2 px-2.5 text-left transition-colors',
                      compact ? 'py-1.5 text-[12px]' : 'py-2 text-[12.5px]',
                      opt.disabled && 'cursor-not-allowed opacity-40',
                      !opt.disabled && isActive && 'bg-canvas-subtle',
                      isSelected ? 'font-medium text-ink' : 'text-ink-secondary',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0 text-ink" />}
                  </button>
                );
              })
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

Select.displayName = 'Select';
