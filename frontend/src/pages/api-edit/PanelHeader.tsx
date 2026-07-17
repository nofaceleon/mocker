import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type PanelHeaderProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function PanelHeader({
  icon: Icon,
  title,
  description,
  action,
  className,
}: PanelHeaderProps) {
  return (
    <div className={cn('mb-5', className)}>
      <h2 className="mb-2 flex items-center gap-2.5 text-[22px] font-semibold leading-tight tracking-[-0.025em] text-ink">
        <span className="grid h-8 w-8 place-items-center rounded-md border border-line bg-canvas-subtle text-ink [&>svg]:h-[15px] [&>svg]:w-[15px]">
          <Icon />
        </span>
        {title}
        {action}
      </h2>
      {description && (
        <p className="max-w-[600px] text-[13.5px] leading-[1.6] text-ink-secondary">
          {description}
        </p>
      )}
    </div>
  );
}
