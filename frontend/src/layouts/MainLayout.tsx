import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Search, Bell, Settings } from 'lucide-react';
import { Topbar, UserAvatar, IconBtn, Drawer } from '@/components/ui';
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
            {/* 桌面端搜索框 - 移动端隐藏 */}
            <div className="relative hidden sm:block">
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
            <div className="mx-1 h-5 w-px bg-line hidden sm:block" />
            <UserAvatar initials="JS" />
          </>
        }
        onMobileMenuToggle={() => setMobileNavOpen(true)}
        mobileMenuOpen={mobileNavOpen}
      />

      {/* 移动端导航 Drawer */}
      <Drawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        title="导航菜单"
        width="sm"
      >
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors',
                  isActive
                    ? 'bg-ink text-ink-inverse'
                    : 'text-ink-secondary hover:bg-canvas-subtle hover:text-ink',
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-6 border-t border-line pt-4">
          <div className="mb-4">
            <input
              type="text"
              placeholder="搜索项目、接口、数据键…"
              className="h-10 w-full rounded-lg border border-line bg-white px-3 pr-8 text-[13px] text-ink transition-all placeholder:text-ink-subtle hover:border-line-strong focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
          </div>
        </div>
      </Drawer>

      <main className="flex-1 overflow-auto" key={location.pathname}>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
