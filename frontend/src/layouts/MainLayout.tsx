import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Search, Bell, Settings } from 'lucide-react';
import { Topbar, UserAvatar, IconBtn } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/lib/cn';

const NAV_ITEMS = [
  { to: '/projects', label: '项目' },
  { to: '/callbacks', label: '回调任务' },
  { to: '/logs', label: '调用日志' },
  { to: '/data', label: '数据管理' },
  { to: '/stats', label: '统计' },
] as const;

export function MainLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <Topbar
        brand={
          <a href="/projects" className="brand">
            <div className="brand-mark">M</div>
            <span>Mock Studio</span>
          </a>
        }
        nav={
          <nav className="nav-menu">
            {NAV_ITEMS.map(({ to, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => cn(isActive && 'active')}>
                {label}
              </NavLink>
            ))}
          </nav>
        }
        right={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text"
                placeholder="搜索项目、接口、数据键…"
                className="h-8 w-[260px] rounded-md border border-line bg-white pl-8 pr-3 text-[13px] text-ink transition-all placeholder:text-ink-subtle hover:border-line-strong focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
              />
            </div>
            <IconBtn title="通知">
              <Bell />
            </IconBtn>
            <NavLink to="/settings" className="inline-flex">
              <IconBtn title="设置">
                <Settings />
              </IconBtn>
            </NavLink>
            <div className="mx-1 h-5 w-px bg-line" />
            <UserAvatar initials="JS" />
          </>
        }
      />

      <main className="flex-1 overflow-auto" key={location.pathname}>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
