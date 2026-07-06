import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

export type TopbarProps = {
  brand?: ReactNode;
  nav?: ReactNode;
  right?: ReactNode;
};

export function Topbar({ brand, nav, right }: TopbarProps) {
  return (
    <header className="topbar">
      {brand ?? (
        <a href="/" className="brand">
          <div className="brand-mark">M</div>
          <span>Mock Studio</span>
        </a>
      )}
      {nav}
      <div className="ml-auto flex items-center gap-1.5">{right}</div>
    </header>
  );
}

type BreadcrumbProps = {
  items: Array<{ label: ReactNode; to?: string; onClick?: () => void; current?: boolean }>;
};

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="breadcrumb">
      {items.map((it, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-[7px]">
            {i > 0 && <span className="sep">/</span>}
            {it.to || it.onClick ? (
              <a
                href={it.to ?? '#'}
                onClick={(e) => {
                  if (it.onClick) {
                    e.preventDefault();
                    it.onClick();
                  }
                }}
                className={cn(it.current || isLast ? 'current' : '')}
              >
                {it.label}
              </a>
            ) : (
              <span className={it.current || isLast ? 'current' : ''}>{it.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function UserAvatar({ initials = 'JS' }: { initials?: string }) {
  return <div className="user-avatar">{initials}</div>;
}

// 用于 Portal：解决 SSR 警告
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export { createPortal };
