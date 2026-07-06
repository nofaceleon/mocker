import { useState } from 'react';
import { AlertCircle, Clipboard, Play, TestTube } from 'lucide-react';
import { toast } from 'sonner';
import { Card, Button, FormField, Input, Textarea, CopyButton } from '@/components/ui';
import type { MockApi } from '@/types/api';
import type { TestApiInput, TestApiOutput } from '@/hooks/queries/use-mock-apis';
import { config as runtimeConfig } from '@/lib/runtime-config';
import { PanelHeader } from '../PanelHeader';

type TestPanelProps = {
  api: MockApi;
  onRun: (input: TestApiInput) => Promise<TestApiOutput>;
};

export function TestPanel({ api, onRun }: TestPanelProps) {
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

  const run = async () => {
    setErr(null);
    setResult(null);
    setElapsed(null);
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
  };

  const curl = result
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
        description="在保存前即可发起测试调用：传入请求体 / 头部，查看 Mock 服务的实际响应。便于联调前快速验证。"
      />

      <Card
        title="请求"
        extra={
          <Button variant="primary" size="sm" onClick={run} loading={running}>
            <Play className="h-3 w-3" />
            发送请求
          </Button>
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
      </Card>

      {err && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-[12px] text-danger">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{err}</span>
        </div>
      )}

      {result && (
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

          <Card className="mt-3" title="cURL" extra={<CopyButton text={curl} label="cURL 已复制" />}>
            <pre className="font-mono text-[12.5px] leading-[1.75] text-ink">{curl}</pre>
          </Card>
        </>
      )}
    </div>
  );
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