import { useState, useRef, useEffect } from 'react';
import { AlertCircle, Clipboard, Play, Square, TestTube } from 'lucide-react';
import { toast } from 'sonner';
import { Card, Button, FormField, Input, Textarea, CopyButton } from '@/components/ui';
import type { MockApi } from '@/types/api';
import type { TestApiInput, TestApiOutput } from '@/hooks/queries/use-mock-apis';
import { config as runtimeConfig } from '@/lib/runtime-config';
import { PanelHeader } from '../PanelHeader';

type SSEEvent = {
  id?: string;
  event?: string;
  data: string;
  timestamp: number;
};

type TestPanelProps = {
  api: MockApi;
  onRun: (input: TestApiInput) => Promise<TestApiOutput>;
};

export function TestPanel({ api, onRun }: TestPanelProps) {
  const isSSE = api.protocol === 'SSE';
  const [path, setPath] = useState(api.path);
  const [bodyText, setBodyText] = useState(
    api.method !== 'GET'
      ? JSON.stringify({ name: '张三', imageUrl: 'https://example.com/face.jpg' }, null, 2)
      : '',
  );
  const [headersText, setHeadersText] = useState('{}');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TestApiOutput | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // SSE相关状态
  const [sseEvents, setSseEvents] = useState<SSEEvent[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 组件卸载时关闭SSE连接
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const run = async () => {
    setErr(null);
    setResult(null);
    setElapsed(null);
    setSseEvents([]);

    if (isSSE) {
      // SSE测试：先获取配置信息，然后连接
      try {
        setRunning(true);
        const headers = headersText.trim() ? JSON.parse(headersText) : undefined;
        const body = api.method !== 'GET' && bodyText.trim() ? JSON.parse(bodyText) : undefined;
        const r = await onRun({ path, body, headers });
        setResult(r as unknown as TestApiOutput);

        const sseUrl = (r as unknown as Record<string, unknown>).fullUrl as string;
        const sseConfig = (r as unknown as Record<string, unknown>).sseConfig as Record<string, unknown> | undefined;

        // GET方法使用EventSource，其他方法使用fetch
        if (api.method === 'GET') {
          connectSSEWithEventSource(sseUrl, sseConfig);
        } else {
          connectSSEWithFetch(sseUrl, body, headers, sseConfig);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : '运行失败');
        setRunning(false);
      }
    } else {
      // 普通HTTP测试
      try {
        const headers = headersText.trim() ? JSON.parse(headersText) : undefined;
        const body = api.method !== 'GET' && bodyText.trim() ? JSON.parse(bodyText) : undefined;
        setRunning(true);
        const t0 = performance.now();
        const r = await onRun({ path, body, headers });
        setElapsed(Math.round(performance.now() - t0));
        setResult(r);
      } catch (e) {
        setErr(e instanceof Error ? e.message : '运行失败');
      } finally {
        setRunning(false);
      }
    }
  };

  // 使用EventSource连接SSE（仅支持GET）
  const connectSSEWithEventSource = (url: string, sseConfig?: Record<string, unknown>) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setSseEvents([]);

    const es = new EventSource(url);
    eventSourceRef.current = es;
    setSseConnected(true);
    const t0 = performance.now();

    es.onopen = () => {
      setSseConnected(true);
    };

    setupSSEEventListeners(es, sseConfig, t0);
  };

  // 使用fetch连接SSE（支持所有HTTP方法）
  const connectSSEWithFetch = async (
    url: string,
    body?: unknown,
    headers?: Record<string, string>,
    sseConfig?: Record<string, unknown>,
  ) => {
    setSseEvents([]);
    setSseConnected(true);
    const t0 = performance.now();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch(url, {
        method: api.method,
        headers: {
          'Accept': 'text/event-stream',
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent: Partial<SSEEvent> = {};

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            currentEvent.data = line.slice(6);
          } else if (line.startsWith('event: ')) {
            currentEvent.event = line.slice(7);
          } else if (line.startsWith('id: ')) {
            currentEvent.id = line.slice(4);
          } else if (line === '') {
            // 空行表示事件结束
            if (currentEvent.data) {
              const newEvent: SSEEvent = {
                event: currentEvent.event,
                data: currentEvent.data,
                id: currentEvent.id,
                timestamp: Date.now(),
              };
              setSseEvents((prev) => [...prev, newEvent]);
            }
            currentEvent = {};
          }
        }
      }

      setSseConnected(false);
      setRunning(false);
      setElapsed(Math.round(performance.now() - t0));
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        setErr(e instanceof Error ? e.message : '连接失败');
      }
      setSseConnected(false);
      setRunning(false);
      setElapsed(Math.round(performance.now() - t0));
    }
  };

  // 设置SSE事件监听器（用于EventSource）
  const setupSSEEventListeners = (es: EventSource, sseConfig?: Record<string, unknown>, t0?: number) => {
    const eventTypes = new Set<string>();
    if (sseConfig?.events && Array.isArray(sseConfig.events)) {
      const events = sseConfig.events as Array<{ event?: string }>;
      events.forEach((e) => {
        if (e.event) eventTypes.add(e.event);
      });
    }
    if (eventTypes.size === 0) {
      eventTypes.add('message');
    }

    eventTypes.forEach((eventType) => {
      es.addEventListener(eventType, (event) => {
        const messageEvent = event as MessageEvent;
        const newEvent: SSEEvent = {
          event: eventType === 'message' ? undefined : eventType,
          data: messageEvent.data,
          id: messageEvent.lastEventId || undefined,
          timestamp: Date.now(),
        };
        setSseEvents((prev) => [...prev, newEvent]);
      });
    });

    es.onerror = () => {
      setSseConnected(false);
      setRunning(false);
      if (t0) setElapsed(Math.round(performance.now() - t0));
      es.close();
    };
  };

  const stopSSE = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setSseConnected(false);
    setRunning(false);
  };

  const curl = isSSE
    ? buildCurl({
        method: api.method,
        baseUrl: 'http://localhost:3000',
        path: path,
        headers: { 'Accept': 'text/event-stream' },
        body: api.method !== 'GET' ? { example: 'data' } : null,
      })
    : result
      ? buildCurl({
          method: api.method,
          baseUrl: runtimeConfig.apiBase,
          path: result.path,
          headers: result.responseHeaders,
          body: null,
        })
      : '';

  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={TestTube}
        title="在线测试"
        description={isSSE ? '测试 SSE 事件流连接：接收服务器推送的事件。' : '在保存前即可发起测试调用：传入请求体 / 头部，查看 Mock 服务的实际响应。便于联调前快速验证。'}
      />

      <Card
        title="请求"
        extra={
          <div className="flex items-center gap-2">
            {isSSE && sseConnected ? (
              <Button variant="danger" size="sm" onClick={stopSSE}>
                <Square className="h-3 w-3" />
                断开连接
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={run} loading={running}>
                <Play className="h-3 w-3" />
                {isSSE ? '连接 SSE' : '发送请求'}
              </Button>
            )}
          </div>
        }
      >
        <FormField label="请求路径">
          <Input className="mono" value={path} onChange={(e) => setPath(e.target.value)} />
        </FormField>
        <FormField label="自定义 Header" hint="JSON 对象，留空使用默认值">
          <Textarea
            className="mono mono-dark !text-[12.5px]"
            rows={2}
            value={headersText}
            onChange={(e) => setHeadersText(e.target.value)}
            placeholder='{"X-Token": "demo"}'
          />
        </FormField>
        {api.method !== 'GET' && (
          <FormField label="Body" hint="JSON">
            <Textarea
              className="mono mono-dark !text-[12.5px]"
              rows={8}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
            />
          </FormField>
        )}
        {isSSE && (
          <div className="info-tip mt-2">
            <AlertCircle />
            <div>
              {api.method === 'GET'
                ? 'SSE 使用 GET 方法，通过 EventSource API 建立连接。'
                : `SSE 使用 ${api.method} 方法，通过 fetch API 建立连接，支持发送请求体。`}
            </div>
          </div>
        )}
      </Card>

      {err && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-[12px] text-danger">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{err}</span>
        </div>
      )}

      {/* SSE事件流显示 */}
      {isSSE && (sseEvents.length > 0 || sseConnected) && (
        <Card
          className="mt-3"
          title={
            <div className="flex items-center gap-2">
              SSE 事件流
              {sseConnected && (
                <span className="inline-flex items-center gap-1 text-[11px] text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  已连接
                </span>
              )}
            </div>
          }
          extra={
            <div className="flex items-center gap-3 text-[12px]">
              <span className="text-ink-tertiary">
                {sseEvents.length} 个事件
                {elapsed !== null ? ` · ${elapsed}ms` : ''}
              </span>
              <button
                type="button"
                className="tool-link inline-flex items-center gap-1"
                onClick={() => {
                  const text = sseEvents.map((e) => {
                    const parts = [];
                    if (e.event) parts.push(`event: ${e.event}`);
                    if (e.id) parts.push(`id: ${e.id}`);
                    parts.push(`data: ${e.data}`);
                    return parts.join('\n') + '\n';
                  }).join('\n');
                  navigator.clipboard.writeText(text);
                  toast.success('事件已复制');
                }}
              >
                <Clipboard className="h-3 w-3" />
                复制事件
              </button>
            </div>
          }
        >
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {sseEvents.length === 0 ? (
              <div className="text-center py-8 text-ink-subtle text-[13px]">
                等待事件...
              </div>
            ) : (
              sseEvents.map((event, index) => (
                <div key={index} className="rounded-md border border-line bg-canvas-subtle p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    {event.event && (
                      <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                        {event.event}
                      </span>
                    )}
                    {event.id && (
                      <span className="text-[11px] text-ink-subtle">
                        id: {event.id}
                      </span>
                    )}
                    <span className="text-[11px] text-ink-subtle ml-auto">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="font-mono text-[12px] leading-[1.6] text-ink whitespace-pre-wrap break-all">
                    {formatSSEData(event.data)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* 普通HTTP响应显示 */}
      {!isSSE && result && (
        <>
          <Card
            className="mt-3"
            title={
              <>
                响应 <span className="font-normal text-ink-subtle">· {api.method} {result.path}</span>
              </>
            }
            extra={
              <div className="flex items-center gap-3 text-[12px]">
                <span className={`status-badge status-${statusTone(result.responseStatus)}`}>
                  {result.responseStatus} {statusLabel(result.responseStatus)}
                </span>
                <span className="text-ink-tertiary">
                  {elapsed !== null ? `${elapsed}ms` : ''}
                  {elapsed !== null ? ' · ' : ''}
                  {prettyBytes(byteSize(result.responseBody))}
                </span>
                <button
                  type="button"
                  className="tool-link inline-flex items-center gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(result.responseBody, null, 2));
                    toast.success('响应已复制');
                  }}
                >
                  <Clipboard className="h-3 w-3" />
                  复制响应
                </button>
              </div>
            }
          >
            <JsonPretty value={result.responseBody} />
          </Card>

          <Card
            className="mt-3"
            title="响应头"
            extra={<CopyButton text={JSON.stringify(result.responseHeaders, null, 2)} label="响应头已复制" />}
          >
            <JsonPretty value={result.responseHeaders} />
          </Card>
        </>
      )}

      <Card className="mt-3" title="cURL" extra={<CopyButton text={curl} label="cURL 已复制" />}>
        <pre className="font-mono text-[12.5px] leading-[1.75] text-ink">{curl}</pre>
      </Card>
    </div>
  );
}

function formatSSEData(data: string): string {
  try {
    const parsed = JSON.parse(data);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return data;
  }
}

function statusTone(code: number): string {
  if (code >= 500) return 'danger';
  if (code >= 400) return 'warning';
  if (code >= 300) return 'info';
  return 'success';
}
function statusLabel(code: number): string {
  if (code >= 500) return 'Server Error';
  if (code >= 400) return 'Bad Request';
  if (code >= 300) return 'Redirect';
  return 'OK';
}
function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
function byteSize(v: unknown): number {
  try {
    return new Blob([JSON.stringify(v)]).size;
  } catch {
    return 0;
  }
}

function buildCurl(opts: {
  method: string;
  baseUrl: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
}): string {
  const parts: string[] = [`curl -X ${opts.method.toUpperCase()} '${opts.baseUrl.replace(/\/$/, '')}${opts.path}'`];
  if (opts.headers) {
    Object.entries(opts.headers).forEach(([k, v]) => {
      parts.push(`  -H '${k}: ${v.replace(/'/g, "'\\''")}'`);
    });
  }
  if (opts.body !== undefined && opts.body !== null) {
    parts.push(`  -d '${JSON.stringify(opts.body).replace(/'/g, "'\\''")}'`);
  }
  return parts.join(' \\\n');
}

function JsonPretty({ value }: { value: unknown }) {
  return (
    <pre className="font-mono text-[12.5px] leading-[1.75] text-ink">
      {renderJson(value, 0)}
    </pre>
  );
}

function renderJson(v: unknown, depth: number): React.ReactNode {
  if (v === null) return <span className="text-ink-subtle">null</span>;
  if (typeof v === 'string') return <span className="text-success-text">"{v}"</span>;
  if (typeof v === 'number') return <span className="text-fuchsia-400">{v}</span>;
  if (typeof v === 'boolean') return <span className="text-purple-600">{String(v)}</span>;
  if (Array.isArray(v)) {
    if (v.length === 0) return <span>{'[]'}</span>;
    return (
      <span>
        {'[\n'}
        {v.map((item, i) => (
          <span key={i}>
            {'  '.repeat(depth + 1)}
            {renderJson(item, depth + 1)}
            {i < v.length - 1 ? ',' : ''}
            {'\n'}
          </span>
        ))}
        {'  '.repeat(depth)}
        {']'}
      </span>
    );
  }
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) return <span>{'{}'}</span>;
    return (
      <span>
        {'{\n'}
        {entries.map(([k, val], i) => (
          <span key={k}>
            {'  '.repeat(depth + 1)}
            <span className="text-amber-600">"{k}"</span>: {renderJson(val, depth + 1)}
            {i < entries.length - 1 ? ',' : ''}
            {'\n'}
          </span>
        ))}
        {'  '.repeat(depth)}
        {'}'}
      </span>
    );
  }
  return <span>{String(v)}</span>;
}