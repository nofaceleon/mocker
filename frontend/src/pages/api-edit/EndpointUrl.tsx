import { MethodBadge, CopyButton } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { HttpMethod } from '@/types/api';

type EndpointUrlProps = {
  method: HttpMethod;
  path: string;
  className?: string;
};

export function EndpointUrl({ method, path, className }: EndpointUrlProps) {
  return (
    <span className={cn('param-code flex items-center gap-1.5', className)}>
      <span>{method}</span>
      <span className="text-ink-secondary">{path}</span>
      <CopyButton text={`${method} ${path}`} />
    </span>
  );
}

export { MethodBadge };
