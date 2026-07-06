import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...rest }, ref) => (
    <textarea
      ref={ref}
      className={cn('form-textarea min-h-[80px]', invalid && 'border-danger', className)}
      {...rest}
    />
  ),
);
Textarea.displayName = 'Textarea';
