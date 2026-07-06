import { type ReactNode } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui';

type PanelActionsProps = {
  hint?: ReactNode;
  onSave?: () => void;
  saving?: boolean;
  saveLabel?: string;
  right?: ReactNode;
  disabled?: boolean;
};

export function PanelActions({
  hint,
  onSave,
  saving,
  saveLabel = '保存',
  right,
  disabled,
}: PanelActionsProps) {
  return (
    <div className="mt-6 flex items-center justify-between border-t border-line pt-[18px]">
      <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-subtle before:block before:h-1 before:w-1 before:rounded-full before:bg-success before:content-['']">
        {hint ?? '所有修改自动保存到草稿'}
      </span>
      <div className="flex items-center gap-2">
        {right ?? (
          <Button variant="primary" onClick={onSave} loading={saving} disabled={disabled}>
            <Save className="h-3.5 w-3.5" />
            {saveLabel}
          </Button>
        )}
      </div>
    </div>
  );
}