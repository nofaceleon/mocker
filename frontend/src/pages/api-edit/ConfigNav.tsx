import { useMemo } from 'react';
import {
  Settings,
  FileText,
  Check,
  Send,
  Link2,
  Code2,
  TestTube,
  BookOpen,
  PanelRightOpen,
  PanelRightClose,
} from 'lucide-react';
import { MethodBadge, Breadcrumb, CopyButton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { config as runtimeConfig } from '@/lib/runtime-config';
import type { HttpMethod } from '@/types/api';

export type ConfigTab =
  'basic' | 'params' | 'response' | 'callback' | 'datalink' | 'script' | 'test';

export type TabDef = {
  value: ConfigTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: 'ON' | string;
};

export const TABS: ReadonlyArray<TabDef> = [
  { value: 'basic', label: '基本配置', icon: Settings },
  { value: 'params', label: '请求参数', icon: FileText },
  { value: 'response', label: '响应配置', icon: Check },
  { value: 'callback', label: '延迟回调', icon: Send, badge: 'ON' },
  { value: 'datalink', label: '数据联动', icon: Link2, badge: 'ON' },
  { value: 'script', label: '自定义脚本', icon: Code2, badge: 'ON' },
  { value: 'test', label: '在线测试', icon: TestTube },
];

type BreadcrumbItem = {
  label: string;
  to?: string;
  current?: boolean;
};

type FeatureState = {
  hasCallback?: boolean;
  hasDataLink?: boolean;
  hasScript?: boolean;
};

type ConfigNavProps = {
  current: ConfigTab;
  onChange: (v: ConfigTab) => void;
  method: HttpMethod;
  path: string;
  breadcrumb?: BreadcrumbItem[];
  onLogClick?: () => void;
  summary?: {
    name?: string;
    isEnabled?: boolean;
    groupName?: string;
    calledCount?: number;
    lastSavedAt?: string;
    lastCalledAt?: string;
  };
  featureState?: FeatureState;
  showSwitcher?: boolean;
  onToggleSwitcher?: () => void;
};

export function ConfigNav({
  current,
  onChange,
  method,
  path,
  breadcrumb,
  onLogClick,
  summary,
  featureState,
  showSwitcher,
  onToggleSwitcher,
}: ConfigNavProps) {
  const dynamicTabs = useMemo(() => {
    return TABS.map((tab) => {
      if (tab.value === 'callback')
        return { ...tab, badge: featureState?.hasCallback ? 'ON' : 'OFF' };
      if (tab.value === 'datalink')
        return { ...tab, badge: featureState?.hasDataLink ? 'ON' : 'OFF' };
      if (tab.value === 'script') return { ...tab, badge: featureState?.hasScript ? 'ON' : 'OFF' };
      return tab;
    });
  }, [featureState]);

  const sections: Array<{ title: string; tabs: TabDef[] }> = [
    { title: '基础配置', tabs: dynamicTabs.slice(0, 3) },
    { title: '高级特性', tabs: dynamicTabs.slice(3, 6) },
    { title: '调试', tabs: dynamicTabs.slice(6) },
  ];

  return (
    <aside className="flex flex-col overflow-y-auto border-r border-line bg-canvas-elevated scrollbar-modern">
      <div className="border-b border-line-subtle px-4 py-3.5">
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="mb-3 text-[12px]">
            <Breadcrumb items={breadcrumb} className="!ml-0" />
          </div>
        )}

        {/* 接口名称 */}
        <div className="mb-2.5 truncate text-[15px] font-semibold leading-snug text-ink">
          {summary?.name || '新建接口'}
        </div>

        {/* 端点展示条 */}
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-canvas-subtle px-3 py-2">
          <MethodBadge method={method} className="!text-[11px] !py-[1px] !px-[6px]" />
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-secondary">
            {path || '/'}
          </span>
          <CopyButton text={`${runtimeConfig.apiBase}${path}`} />
        </div>

        {/* 元信息行 */}
        <div className="flex items-center gap-2 text-[11px]">
          {summary?.isEnabled ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-ink-secondary">
              <span className="live-dot !h-[6px] !w-[6px]" />
              运行中
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-medium text-ink-secondary">
              <span className="live-dot-danger !h-[6px] !w-[6px]" />
              未启用
            </span>
          )}
          <button
            type="button"
            onClick={onLogClick}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-ink-tertiary transition-colors hover:bg-canvas-subtle hover:text-ink-secondary"
          >
            <BookOpen className="h-3 w-3" />
            日志
          </button>
          {onToggleSwitcher && (
            <button
              type="button"
              onClick={onToggleSwitcher}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-ink-tertiary transition-colors hover:bg-canvas-subtle hover:text-ink-secondary"
              title={showSwitcher ? '隐藏接口列表' : '显示接口列表'}
            >
              {showSwitcher ? (
                <PanelRightClose className="h-3 w-3" />
              ) : (
                <PanelRightOpen className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sections.map((sec) => (
          <div
            key={sec.title}
            className="border-t border-line-subtle px-3 pb-2 pt-3.5 first:border-t-0"
          >
            <div className="px-2 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
              {sec.title}
            </div>
            {sec.tabs.map((t) => (
              <NavItem
                key={t.value}
                tab={t}
                active={current === t.value}
                onClick={() => onChange(t.value)}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="border-t border-line-subtle px-3 py-3 text-[11px] leading-[1.8] text-ink-subtle">
        <div>
          上次保存 ·{' '}
          <span className="text-ink-secondary">
            {summary?.lastSavedAt ? formatRelative(summary.lastSavedAt) : '尚未保存'}
          </span>
        </div>
        <div>
          上次调用 ·{' '}
          <span className="text-ink-secondary">
            {summary?.lastCalledAt ? formatTime(summary.lastCalledAt) : '—'}
          </span>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ tab, active, onClick }: { tab: TabDef; active: boolean; onClick: () => void }) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-[450] transition-all',
        active
          ? 'bg-canvas-deep font-medium text-ink-inverse shadow-sm'
          : 'text-ink-secondary hover:bg-canvas-subtle hover:text-ink',
      )}
    >
      <span
        className={cn(
          'grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded transition-colors',
          active
            ? 'bg-canvas-elevated/15 text-ink-inverse'
            : 'text-ink-tertiary group-hover:text-ink-secondary',
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 truncate tracking-[-0.005em]">{tab.label}</span>
      {tab.badge && (
        <span
          className={cn(
            'rounded-full px-1.5 py-px text-[10px] font-medium',
            active
              ? 'border border-transparent bg-canvas-elevated/15 text-ink-inverse'
              : tab.badge === 'ON'
                ? 'border border-success-border bg-success-soft text-success-text'
                : 'border border-line bg-canvas-subtle text-ink-secondary',
          )}
        >
          {tab.badge}
        </span>
      )}
    </button>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return new Date(iso).toLocaleString();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
