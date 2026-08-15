import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Search,
  Bell,
  Settings,
  FolderKanban,
  RefreshCw,
  ScrollText,
  Database,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Sun,
} from 'lucide-react';
import { Topbar, UserAvatar, IconBtn } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/stores/ui-store';

const NAV_ITEMS = [
  { to: '/projects', label: '项目', icon: FolderKanban },
  { to: '/callbacks', label: '回调任务', icon: RefreshCw },
  { to: '/logs', label: '调用日志', icon: ScrollText },
  { to: '/data', label: '数据管理', icon: Database },
  { to: '/stats', label: '统计', icon: BarChart3 },
] as const;

export function MainLayout() {
  const location = useLocation();
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <aside
        className={cn(
          'sidebar flex flex-shrink-0 flex-col border-r border-line bg-canvas-elevated transition-[width] duration-200',
          sidebarCollapsed ? 'w-16' : 'w-[216px]',
        )}
      >
        <div
          className={cn(
            'flex h-[54px] flex-shrink-0 items-center border-b border-line',
            sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3',
          )}
        >
          {!sidebarCollapsed && (
            <a href="/projects" className="brand">
              <div className="brand-mark">M</div>
              <span>Mock Studio</span>
            </a>
          )}
          <IconBtn title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'} onClick={toggleSidebar}>
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </IconBtn>
        </div>

        <nav className="side-nav flex-1 overflow-y-auto px-2 py-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={sidebarCollapsed ? label : undefined}
              className={({ isActive }) =>
                cn('side-nav-item', isActive && 'active', sidebarCollapsed && 'collapsed')
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div
          className={cn(
            'flex flex-shrink-0 items-center gap-1 border-t border-line py-2',
            sidebarCollapsed ? 'flex-col gap-2.5 py-3' : 'px-2',
          )}
        >
          <NavLink to="/settings" className={cn(sidebarCollapsed ? 'inline-flex' : 'flex-1')}>
            <IconBtn title="设置">
              <Settings />
            </IconBtn>
          </NavLink>
          {!sidebarCollapsed && <div className="mx-1 h-5 w-px flex-shrink-0 bg-line" />}
          <UserAvatar initials="JS" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          right={
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
                <input
                  type="text"
                  placeholder="搜索项目、接口、数据键…"
                  className="h-8 w-[260px] rounded-md border border-line bg-canvas-elevated pl-8 pr-3 text-[13px] text-ink transition-all placeholder:text-ink-subtle hover:border-line-strong focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
                />
              </div>
              <IconBtn title="通知">
                <Bell />
              </IconBtn>
              <IconBtn
                title={theme === 'dark' ? '切换为浅色模式' : '切换为深色模式'}
                onClick={toggleTheme}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </IconBtn>
            </>
          }
        />

        <main className="flex-1 overflow-auto" key={location.pathname}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
