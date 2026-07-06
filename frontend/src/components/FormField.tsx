import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type FormFieldProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FormField({ label, hint, error, required, className, children }: FormFieldProps) {
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
        <div className="text-[11px] text-ink-tertiary">{hint}</div>
      ) : null}
    </div>
  );
}
