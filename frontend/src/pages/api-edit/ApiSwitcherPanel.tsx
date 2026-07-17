import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { MethodBadge } from '@/components/ui';
import { useMockApis } from '@/hooks/queries/use-mock-apis';
import { cn } from '@/lib/cn';
import type { MockApi } from '@/types/api';

type ApiSwitcherPanelProps = {
  projectId: number;
  featureGroupId: number;
  currentApiId?: number;
  onSwitch: (api: MockApi) => void;
  onClose: () => void;
};

export function ApiSwitcherPanel({
  featureGroupId,
  currentApiId,
  onSwitch,
  onClose,
}: ApiSwitcherPanelProps) {
  const { data: apis, isLoading } = useMockApis(featureGroupId);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!apis) return [];
    const q = search.trim().toLowerCase();
    if (!q) return apis;
    return apis.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.path.toLowerCase().includes(q) ||
        a.method.toLowerCase().includes(q),
    );
  }, [apis, search]);

  return (
    <aside className="flex flex-col border-l border-line bg-white" style={{ width: 240 }}>
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
          同组接口
        </span>
        <button
          type="button"
          onClick={onClose}
          className="grid h-5 w-5 place-items-center rounded text-ink-subtle transition-colors hover:bg-canvas-subtle hover:text-ink"
          title="关闭"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative border-b border-line px-3 py-2.5">
        <Search className="pointer-events-none absolute left-[26px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索接口…"
          className="h-8 w-full rounded-lg border border-line-subtle bg-canvas-subtle px-3 pl-8 text-[12px] placeholder:text-ink-subtle transition-colors hover:border-line focus:border-ink-subtle focus:bg-white focus:outline-none"
        />
      </div>

      <div className="scrollbar-modern flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="px-3 py-4 text-center text-[12px] text-ink-tertiary">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-[12px] text-ink-tertiary">
            {search ? '无匹配接口' : '该功能组下暂无接口'}
          </div>
        ) : (
          <div className="px-2 py-1.5">
            {filtered.map((api) => (
              <ApiItem
                key={api.id}
                api={api}
                active={api.id === currentApiId}
                onClick={() => onSwitch(api)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function ApiItem({ api, active, onClick }: { api: MockApi; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group mb-0.5 flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-all',
        active ? 'bg-canvas-deep' : 'hover:bg-canvas-subtle',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <MethodBadge
            method={api.method}
            className={cn(
              '!text-[10px] !py-[0px] !px-[4px]',
              active && '!border-transparent !bg-white/15 !text-white',
            )}
          />
          <span
            className={cn('text-[11.5px] font-medium truncate', active ? 'text-white' : 'text-ink')}
          >
            {api.name}
          </span>
        </div>
        <div
          className={cn(
            'mt-1 truncate font-mono text-[10.5px]',
            active ? 'text-white/70' : 'text-ink-subtle',
          )}
        >
          {api.path}
        </div>
      </div>
      <div className="flex-shrink-0 pt-0.5">
        <span
          className={cn(
            'inline-block h-[6px] w-[6px] rounded-full',
            api.isEnabled ? 'bg-green-500' : 'bg-gray-300',
          )}
          title={api.isEnabled ? '已启用' : '已禁用'}
        />
      </div>
    </button>
  );
}
