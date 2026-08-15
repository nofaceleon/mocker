import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';

export type SaveStatusState = 'pristine' | 'dirty' | 'saving' | 'saved' | 'error';

export type SaveStatusBarProps = {
  state: SaveStatusState;
  lastSavedAt?: string;
  errorMessage?: string;
  /** 当前 tab 是否有保存按钮。test 面板等无保存按钮时传 false */
  canSave?: boolean;
  onSave?: () => void;
  saving?: boolean;
  className?: string;
};

function formatTime(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function SaveStatusBar({
  state,
  lastSavedAt,
  errorMessage,
  canSave = true,
  onSave,
  saving,
  className,
}: SaveStatusBarProps) {
  // "saved" 状态显示后淡出（约 2s），回到 pristine 隐藏
  const [showSaved, setShowSaved] = useState(false);
  useEffect(() => {
    if (state !== 'saved') {
      setShowSaved(false);
      return;
    }
    setShowSaved(true);
    const t = window.setTimeout(() => setShowSaved(false), 2400);
    return () => window.clearTimeout(t);
  }, [state]);

  // 仅在有意义的状态渲染
  const visible = state === 'dirty' || state === 'saving' || state === 'error' || showSaved;
  if (!visible) return null;

  const tone =
    state === 'error'
      ? 'border-danger-border bg-danger-soft text-danger-text'
      : state === 'saving'
        ? 'border-info-border bg-info-soft text-info-text'
        : showSaved
          ? 'border-success-border bg-success-soft text-success-text'
          : 'border-warning-border bg-warning-soft text-warning-text';

  const Icon =
    state === 'error'
      ? AlertCircle
      : state === 'saving'
        ? Loader2
        : showSaved
          ? CheckCircle2
          : Save;

  const label =
    state === 'error'
      ? (errorMessage ?? '保存失败')
      : state === 'saving'
        ? '保存中…'
        : showSaved
          ? `已保存${formatTime(lastSavedAt) ? `于 ${formatTime(lastSavedAt)}` : ''}`
          : '有未保存的修改';

  const isBusy = state === 'saving' || saving;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'sticky top-0 z-10 mb-4 flex items-center justify-between gap-3 border bg-canvas/95 px-8 py-2.5 backdrop-blur-sm',
        tone,
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-[12.5px] font-medium">
        <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', isBusy && 'animate-spin')} />
        <span className="truncate">{label}</span>
      </div>

      {canSave && (state === 'dirty' || state === 'error') && (
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          loading={isBusy}
          className="!h-7 !text-[12px]"
        >
          {state === 'error' ? '重试' : '保存'}
        </Button>
      )}
    </div>
  );
}
