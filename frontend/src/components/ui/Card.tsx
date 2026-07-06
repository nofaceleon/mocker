import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({
  className,
  children,
  title,
  extra,
  bodyClassName,
  noBody,
}: {
  className?: string;
  children: ReactNode;
  title?: ReactNode;
  extra?: ReactNode;
  bodyClassName?: string;
  noBody?: boolean;
}) {
  return (
    <section className={cn('card', className)}>
      {(title || extra) && (
        <header className="card-header">
          {title && <div className="card-title">{title}</div>}
          {extra && <div className="flex items-center gap-2">{extra}</div>}
        </header>
      )}
      {noBody ? children : <div className={cn('card-body', bodyClassName)}>{children}</div>}
    </section>
  );
}
