import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type SwitchProps = {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
};

export function Switch({ checked, onChange, disabled, className, title }: SwitchProps) {
  return (
    <label className={cn('switch', className)} title={title}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-slider" />
    </label>
  );
}

export function Tag({
  children,
  color = 'gray',
  className,
}: {
  children: ReactNode;
  color?: 'purple' | 'blue' | 'green' | 'orange' | 'red' | 'pink' | 'gray';
  className?: string;
}) {
  return <span className={cn(`tag tag-${color}`, className)}>{children}</span>;
}

export function TagPill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('tag-pill', className)}>{children}</span>;
}

export function LiveDot({ className }: { className?: string }) {
  return <span className={cn('live-dot', className)} />;
}
