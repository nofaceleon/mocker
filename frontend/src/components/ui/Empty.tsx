import { type ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export function Empty({
  title = '暂无数据',
  description,
  action,
  icon = <Inbox className="h-10 w-10 text-ink-subtle" />,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      {icon}
      <div>
        <div className="text-[14px] font-medium text-ink">{title}</div>
        {description && <div className="mt-1 text-[12px] text-ink-tertiary">{description}</div>}
      </div>
      {action}
    </div>
  );
}
