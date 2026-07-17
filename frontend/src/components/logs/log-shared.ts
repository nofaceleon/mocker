export function formatNumber(n: number): string {
  return n.toLocaleString('zh-CN');
}

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDateParts(iso: string): { dateStr: string; timeStr: string; msStr: string } {
  const d = new Date(iso);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const ms = `.${String(d.getMilliseconds()).padStart(3, '0')}`;
  return { dateStr: date, timeStr: time, msStr: ms };
}

export function statusKindClass(kind: string): string {
  const base = 'rounded px-1.5 py-0.5 font-mono text-[11.5px] font-semibold';
  if (kind === 'success') return `${base} bg-success-soft text-success`;
  if (kind === 'warning') return `${base} bg-warning-soft text-warning`;
  if (kind === 'danger') return `${base} bg-danger-soft text-danger`;
  return `${base} bg-info-soft text-info`;
}

export function responseTimeClass(ms: number): string {
  const base = 'rounded px-1.5 py-0.5 font-mono text-[11.5px] font-medium';
  if (ms < 100) return `${base} bg-success-soft text-success`;
  if (ms < 500) return `${base} bg-canvas-subtle text-ink-secondary`;
  if (ms < 1500) return `${base} bg-warning-soft text-warning`;
  return `${base} bg-danger-soft text-danger`;
}

export function statusText(status: number): string {
  const map: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return map[status] ?? '';
}
