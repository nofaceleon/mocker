import { type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/cn';

type FormFieldProps = {
  label?: ReactNode;
  hint?: ReactNode;
  hintIcon?: boolean;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FormField({
  label,
  hint,
  hintIcon,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="text-[12px] font-medium text-ink-secondary">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <div className="text-[11px] text-danger">{error}</div>
      ) : hint ? (
        <div className="flex items-start gap-1 text-[11px] leading-snug text-ink-tertiary">
          {hintIcon && <Info className="mt-px h-3 w-3 flex-shrink-0 text-ink-subtle" aria-hidden />}
          <span>{hint}</span>
        </div>
      ) : null}
    </div>
  );
}
