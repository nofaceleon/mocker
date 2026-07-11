import { forwardRef, type SelectHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
  children: ReactNode;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...rest }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'form-select',
          invalid && 'border-danger',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-tertiary" />
    </div>
  ),
);
Select.displayName = 'Select';
