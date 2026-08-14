import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, AlertCircle, ExternalLink, Save, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Switch, confirm } from '@/components/ui';
import type { CallbackConfig } from '@/types/api';
import {
  useCallbackConfig,
  useDeleteCallbackConfig,
  useDeleteSingleCallback,
  useSaveCallbackConfig,
} from '@/hooks/queries/use-callback-config';
import { ApiError } from '@/lib/api';
import { PanelHeader } from '../PanelHeader';
import { CallbackItemCard } from './CallbackItemCard';

type CallbackPanelProps = {
  apiId: number | undefined;
  onSave?: () => void;
  saving?: boolean;
};

const DEFAULT_CONFIG = (idx: number): CallbackConfig => ({
  isEnabled: true,
  name: `回调 ${idx + 1}`,
  callbackUrl: '',
  callbackMethod: 'POST',
  callbackHeaders: { 'Content-Type': 'application/json' },
  callbackBody: '',
  delayType: 'fixed',
  delayValue: '5000',
  retryEnabled: false,
  maxRetries: 3,
  retryInterval: 5000,
  retryStrategy: 'fixed',
  retryCondition: 'server_error',
  retryConditionExpr: 'statusCode != 200',
});

export function CallbackPanel({ apiId, onSave, saving }: CallbackPanelProps) {
  if (apiId === undefined) {
    return (
      <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
        <PanelHeader
          icon={Send}
          title="延迟回调"
          description="启用后，接口响应后会自动按设定延迟向回调 URL 发送请求。常用于模拟支付、识别等异步通知。"
        />
        <div className="info-tip mt-4">
          <AlertCircle />
          <div>请先在「基本配置」保存接口后再配置回调。</div>
        </div>
      </div>
    );
  }

  return <CallbackPanelForm apiId={apiId} onSave={onSave} saving={saving} />;
}

function CallbackPanelForm({
  apiId,
  onSave,
  saving,
}: {
  apiId: number;
  onSave?: () => void;
  saving?: boolean;
}) {
  const { data: serverCfg, isLoading } = useCallbackConfig(apiId);
  const saveMut = useSaveCallbackConfig(apiId);
  const deleteAllMut = useDeleteCallbackConfig(apiId);
  const deleteOneMut = useDeleteSingleCallback(apiId);

  const initial = useMemo<CallbackConfig[]>(() => {
    if (serverCfg && Array.isArray(serverCfg)) return serverCfg.map(normalize);
    return [];
  }, [serverCfg]);

  const [items, setItems] = useState<CallbackConfig[]>(initial);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [chainEnabled, setChainEnabled] = useState<boolean>(initial.some((c) => c.isEnabled));
  const [dirty, setDirty] = useState(false);
  const lastSavedRef = useRef<string>(JSON.stringify(initial));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    setItems(initial);
    setChainEnabled(initial.some((c) => c.isEnabled));
    setDirty(false);
    setExpanded(new Set());
    lastSavedRef.current = JSON.stringify(initial);
  }, [initial]);

  const markDirty = (next: CallbackConfig[]) => {
    setDirty(JSON.stringify(next) !== lastSavedRef.current);
  };

  const updateItem = (idx: number, patch: CallbackConfig) => {
    setItems((prev) => {
      const next = prev.slice();
      next[idx] = patch;
      markDirty(next);
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => {
      const next = [...prev, DEFAULT_CONFIG(prev.length)];
      markDirty(next);
      return next;
    });
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(items.length);
      return next;
    });
  };

  const removeItem = async (idx: number) => {
    const target = items[idx];
    const label = target.name?.trim() || `回调 ${idx + 1}`;
    const ok = await confirm({
      title: '删除回调',
      message: (
        <span>
          确认删除 <b>{label}</b> ？如有 pending 任务会一并取消。
        </span>
      ),
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;

    // 已保存到后端的：调用单条删除接口
    if (target.id) {
      try {
        await deleteOneMut.mutateAsync(target.id);
        toast.success(`已删除「${label}」`);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : '删除失败';
        toast.error(msg);
        return;
      }
    }
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      markDirty(next);
      return next;
    });
    setExpanded((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < idx) next.add(i);
        else if (i > idx) next.add(i - 1);
      });
      return next;
    });
  };

  const removeAll = async () => {
    if (!items.length) return;
    const ok = await confirm({
      title: '清空全部回调',
      message: (
        <span>
          确认清空全部 <b>{items.length}</b> 条回调配置？所有关联的 pending 任务会被取消。
        </span>
      ),
      confirmText: '清空',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteAllMut.mutateAsync();
      setItems([]);
      setChainEnabled(false);
      setExpanded(new Set());
      setDirty(false);
      lastSavedRef.current = JSON.stringify([]);
      toast.success('已清空回调配置');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '清空失败';
      toast.error(msg);
    }
  };

  const onDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(idx);
  };

  const onDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIndex;
    setDragIndex(null);
    setDragOverIndex(null);
    if (from === null || from === idx) return;
    setItems((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(idx, 0, moved);
      markDirty(next);
      return next;
    });
    setExpanded((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i === from) next.add(idx);
        else if (from < i && i <= idx) next.add(i - 1);
        else if (from > i && i >= idx) next.add(i + 1);
        else next.add(i);
      });
      return next;
    });
  };

  const onDragEnd = () => () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const toggleExpand = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const validateAll = (): string | null => {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.isEnabled && !it.callbackUrl.trim()) {
        return `第 ${i + 1} 条回调：请填写回调 URL`;
      }
      if (
        it.isEnabled &&
        it.retryEnabled &&
        it.retryCondition === 'custom' &&
        !(it.retryConditionExpr ?? '').trim()
      ) {
        return `第 ${i + 1} 条回调：请填写自定义失败条件表达式`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const err = validateAll();
    if (err) {
      toast.error(err);
      return;
    }
    if (!chainEnabled && items.some((c) => c.isEnabled)) {
      // 用户禁用总开关时，仍允许保存（链不触发即可）
    }
    try {
      const payload = items.map((it, idx) => ({
        ...it,
        sortOrder: idx,
      }));
      const saved = await saveMut.mutateAsync(payload);
      setItems(saved);
      setChainEnabled(saved.some((c) => c.isEnabled));
      setDirty(false);
      setExpanded(new Set());
      lastSavedRef.current = JSON.stringify(saved);
      toast.success(`已保存 ${saved.length} 条回调`);
      onSave?.();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '保存失败';
      toast.error(msg);
    }
  };

  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Send}
        title="延迟回调"
        action={
          <div className="ml-auto flex items-center gap-3">
            <Link
              to={`/callbacks?apiId=${apiId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-ink-secondary hover:text-ink"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              查看任务
            </Link>
            <span className="text-[11.5px] text-ink-tertiary">
              {chainEnabled ? '已启用' : '未启用'}
            </span>
            <Switch
              checked={chainEnabled}
              onChange={setChainEnabled}
              title="启用整条回调链（任意一条启用即触发）"
            />
          </div>
        }
        description="启用后，接口响应后会自动按设定顺序与间隔依次触发每条回调。常用于模拟支付、识别等异步通知链。"
      />

      <div className="info-tip">
        <AlertCircle />
        <div>
          <strong>说明</strong>：每条回调支持独立 URL / Headers / Body 与重试策略。 链路语义为
          <strong>链式</strong>：第 1 条相对 API 响应延时，后续每条相对上一条
          <strong>终态后</strong>（含重试）等待设定毫秒触发。上一条失败不会中断链路。
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <div className="rounded-md border border-dashed border-line bg-canvas-subtle/50 px-4 py-8 text-center text-[12.5px] text-ink-tertiary">
            加载中…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-dashed border-line bg-canvas-subtle/50 px-4 py-10 text-center">
            <div className="text-[13px] text-ink-secondary">还没有配置任何回调</div>
            <div className="mt-1 text-[11.5px] text-ink-tertiary">
              点击下方「新增回调」添加第一条
            </div>
          </div>
        ) : (
          items.map((it, idx) => (
            <CallbackItemCard
              key={it.id ?? `new-${idx}`}
              index={idx}
              item={it}
              isExpanded={expanded.has(idx)}
              chainEnabled={chainEnabled}
              dragHandleProps={{
                draggable: true,
                onDragStart: onDragStart(idx),
                onDragOver: onDragOver(idx),
                onDrop: onDrop(idx),
                onDragEnd: onDragEnd(),
              }}
              isDragOver={dragOverIndex === idx && dragIndex !== null && dragIndex !== idx}
              isDragging={dragIndex === idx}
              onToggleExpand={() => toggleExpand(idx)}
              onChange={(next) => updateItem(idx, next)}
              onRemove={() => removeItem(idx)}
            />
          ))
        )}

        <Button
          variant="secondary"
          size="md"
          onClick={addItem}
          className="w-full mt-2"
          disabled={!chainEnabled}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          新增回调
        </Button>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
        <button
          type="button"
          onClick={removeAll}
          disabled={items.length === 0 || deleteAllMut.isPending}
          className="inline-flex items-center gap-1 rounded-md border border-line bg-canvas-elevated px-3 py-1.5 text-[12.5px] text-danger-text transition-colors hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          清空全部
        </button>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-ink-subtle">
            {dirty ? '有未保存的修改' : isLoading ? '加载中…' : '已保存'}
          </span>
          <Button variant="primary" onClick={handleSave} loading={saving || saveMut.isPending}>
            <Save className="h-3.5 w-3.5" />
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}

function normalize(c: CallbackConfig): CallbackConfig {
  return {
    isEnabled: c.isEnabled ?? false,
    name: c.name ?? null,
    id: c.id,
    sortOrder: c.sortOrder,
    callbackUrl: c.callbackUrl ?? '',
    callbackMethod: c.callbackMethod ?? 'POST',
    callbackHeaders: c.callbackHeaders ?? {},
    callbackBody: c.callbackBody ?? '',
    delayType: c.delayType ?? 'fixed',
    delayValue: c.delayValue ?? '5000',
    retryEnabled: c.retryEnabled ?? false,
    maxRetries: c.maxRetries ?? 3,
    retryInterval: c.retryInterval ?? 5000,
    retryStrategy: c.retryStrategy ?? 'fixed',
    retryCondition: c.retryCondition ?? 'server_error',
    retryConditionExpr: c.retryConditionExpr ?? '',
  };
}
