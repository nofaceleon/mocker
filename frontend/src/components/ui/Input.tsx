import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...rest }, ref) => {
    return (
      <input
        ref={ref}
        className={cn('form-input h-8', invalid && 'border-danger', className)}
        {...rest}
      />
    );
  },
);
Input.displayName = 'Input';
