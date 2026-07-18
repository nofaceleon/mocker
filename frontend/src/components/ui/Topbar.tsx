import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconBtn } from './IconBtn';

export type TopbarProps = {
  brand?: ReactNode;
  nav?: ReactNode;
  right?: ReactNode;
  onMobileMenuToggle?: () => void;
  mobileMenuOpen?: boolean;
};

export function Topbar({ brand, nav, right, onMobileMenuToggle, mobileMenuOpen }: TopbarProps) {
  return (
    <header className="topbar">
      {/* 汉堡菜单按钮 - md~lg 屏幕显示（此时 nav 隐藏）；lg+ nav 显示，汉堡隐藏 */}
      <div className="mr-2 md:hidden lg:block">
        <IconBtn
          onClick={onMobileMenuToggle}
          title={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
          className={mobileMenuOpen ? 'bg-canvas-subtle' : ''}
        >
          {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </IconBtn>
      </div>

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
  className?: string;
};

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={cn('breadcrumb', className)}>
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
