import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

export type DropdownItem =
  | {
      label?: ReactNode;
      icon?: ReactNode;
      onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
      disabled?: boolean;
      danger?: boolean;
      /** 简单分隔线，单独传一个 { divider: true } 项即可 */
      divider: true;
    }
  | {
      label: ReactNode;
      icon?: ReactNode;
      onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
      disabled?: boolean;
      danger?: boolean;
      divider?: false;
    };

type DropdownProps = {
  /** 触发器元素（必须能接收 ref + onClick，比如 <Button>） */
  trigger: ReactElement;
  items: DropdownItem[];
  /** 自定义对齐方式，默认 'end'（菜单右沿与 trigger 右沿对齐） */
  align?: 'start' | 'end';
  className?: string;
  /** 自定义菜单宽度 */
  menuWidth?: number;
};

export function Dropdown({ trigger, items, align = 'end', className, menuWidth = 180 }: DropdownProps) {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [highlight, setHighlight] = useState(-1);

  const focusableIndices = useMemo(
    () => items.map((it, i) => (!it.divider && !it.disabled ? i : -1)).filter((i) => i >= 0),
    [items],
  );

  const updateMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuMaxH = 320;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < Math.min(menuMaxH, 160) && spaceAbove > spaceBelow;
    const maxH = Math.min(menuMaxH, openUp ? spaceAbove : spaceBelow);

    const left =
      align === 'end'
        ? Math.max(8, rect.right - menuWidth)
        : Math.min(window.innerWidth - menuWidth - 8, rect.left);

    setMenuStyle({
      position: 'fixed',
      left,
      width: menuWidth,
      maxHeight: Math.max(120, maxH),
      zIndex: 300,
      ...(openUp ? { bottom: window.innerHeight - rect.top + gap } : { top: rect.bottom + gap }),
    });
  }, [align, menuWidth]);

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
    if (!open) {
      setHighlight(-1);
      return;
    }
    setHighlight(focusableIndices[0] ?? -1);
    requestAnimationFrame(() => menuRef.current?.focus());
  }, [open, focusableIndices]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: globalThis.MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const moveHighlight = (dir: 1 | -1) => {
    if (focusableIndices.length === 0) return;
    const curPos = focusableIndices.indexOf(highlight);
    const base = curPos < 0 ? 0 : curPos;
    const nextPos = (base + dir + focusableIndices.length) % focusableIndices.length;
    setHighlight(focusableIndices[nextPos]);
  };

  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
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
      const it = items[highlight];
      if (it && !it.divider && !it.disabled) {
        e.preventDefault();
        setOpen(false);
        it.onClick?.({} as ReactMouseEvent<HTMLButtonElement>);
      }
      return;
    }
    if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  // 注入 ref / onClick / 键盘处理 / aria 到 trigger
  if (!isValidElement(trigger)) {
    throw new Error('Dropdown.trigger 必须是单个 React 元素（能接收 ref）');
  }
  const child = Children.only(trigger) as ReactElement<{
    onClick?: (e: ReactMouseEvent<HTMLElement>) => void;
    onKeyDown?: (e: ReactKeyboardEvent<HTMLElement>) => void;
  }>;
  const triggerProps = child.props;

  const enhanced = cloneElement(child, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const original = (trigger as unknown as { ref?: unknown }).ref;
      if (typeof original === 'function') original(node);
      else if (original && typeof original === 'object') {
        (original as { current: HTMLElement | null }).current = node;
      }
    },
    onClick: (e: ReactMouseEvent<HTMLElement>) => {
      triggerProps.onClick?.(e);
      if (!e.defaultPrevented) setOpen((v) => !v);
    },
    onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => {
      triggerProps.onKeyDown?.(e);
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
    },
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': menuId,
  } as Partial<typeof triggerProps> & Record<string, unknown>);

  return (
    <span className={cn('relative inline-block', className)}>
      {enhanced}

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            tabIndex={-1}
            style={menuStyle}
            onKeyDown={onMenuKeyDown}
            className="overflow-auto rounded-lg border border-line bg-canvas-elevated py-1 shadow-[0_8px_30px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)] outline-none scrollbar-modern"
          >
            {items.map((it, i) => {
              if (it.divider) {
                return <div key={i} role="separator" className="my-1 h-px bg-line-subtle" />;
              }
              const isActive = i === highlight;
              return (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  disabled={it.disabled}
                  onMouseEnter={() => !it.disabled && setHighlight(i)}
                  onClick={(e) => {
                    if (it.disabled) return;
                    setOpen(false);
                    it.onClick?.(e);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] transition-colors',
                    !it.disabled && isActive && 'bg-canvas-subtle',
                    it.disabled && 'cursor-not-allowed opacity-40',
                    it.danger
                      ? 'text-danger hover:bg-danger-soft'
                      : 'text-ink-secondary hover:text-ink',
                  )}
                >
                  {it.icon && <span className="flex h-3.5 w-3.5 flex-shrink-0">{it.icon}</span>}
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </span>
  );
}

Dropdown.displayName = 'Dropdown';