import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { HttpMethod } from '@/types/api';

export type BadgeVariant =
  | 'neutral'
  | 'method-get'
  | 'method-post'
  | 'method-put'
  | 'method-delete'
  | 'method-patch'
  | 'method-ws'
  | 'method-sse'
  | 'status-success'
  | 'status-warning'
  | 'status-danger'
  | 'status-info'
  | 'status-neutral';

const methodClass: Record<string, string> = {
  GET: 'method-badge method-GET',
  POST: 'method-badge method-POST',
  PUT: 'method-badge method-PUT',
  DELETE: 'method-badge method-DELETE',
  PATCH: 'method-badge method-PATCH',
  WS: 'method-badge method-WS',
  SSE: 'method-badge method-SSE',
};

const statusClass: Record<string, string> = {
  'status-success': 'status-badge status-success',
  'status-warning': 'status-badge status-warning',
  'status-danger': 'status-badge status-danger',
  'status-info': 'status-badge status-info',
  'status-neutral': 'status-badge status-neutral',
};

export function Badge({
  variant = 'neutral',
  children,
  className,
}: {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}) {
  if (variant === 'method-get') return <span className={cn(methodClass.GET, className)}>{children}</span>;
  if (variant === 'method-post') return <span className={cn(methodClass.POST, className)}>{children}</span>;
  if (variant === 'method-put') return <span className={cn(methodClass.PUT, className)}>{children}</span>;
  if (variant === 'method-delete') return <span className={cn(methodClass.DELETE, className)}>{children}</span>;
  if (variant === 'method-patch') return <span className={cn(methodClass.PATCH, className)}>{children}</span>;
  if (variant === 'method-ws') return <span className={cn(methodClass.WS, className)}>{children}</span>;
  if (variant === 'method-sse') return <span className={cn(methodClass.SSE, className)}>{children}</span>;
  if (variant.startsWith('status-')) {
    return <span className={cn(statusClass[variant], className)}>{children}</span>;
  }
  return <span className={cn('tag-pill', className)}>{children}</span>;
}

export function MethodBadge({ method, className }: { method: HttpMethod; className?: string }) {
  return <span className={cn(methodClass[method] ?? methodClass.GET, className)}>{method}</span>;
}

export function StatusBadge({
  status,
  children,
  className,
}: {
  status: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn(statusClass[`status-${status}`], className)}>{children}</span>;
}

export function methodVariant(method: string): BadgeVariant {
  const m = method.toUpperCase() as HttpMethod;
  if (m === 'GET') return 'method-get';
  if (m === 'POST') return 'method-post';
  if (m === 'PUT') return 'method-put';
  if (m === 'DELETE') return 'method-delete';
  if (m === 'PATCH') return 'method-patch';
  if (m === 'WS') return 'method-ws';
  if (m === 'SSE') return 'method-sse';
  return 'neutral';
}
