import { useState } from 'react';
import { MethodBadge, Tabs } from '@/components/ui';
import { HeadersBlock, JsonField } from '@/lib/log-format';
import { cn } from '@/lib/cn';
import { statusText } from './log-shared';
import type { RequestLog } from '@/types/api';

function KV({ k, v, mono, valueClass }: { k: string; v: string; mono?: boolean; valueClass?: string }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-2 py-1 text-[12px]">
      <span className="text-ink-tertiary">{k}</span>
      <span className={cn('text-ink', mono && 'font-mono', valueClass)}>{v}</span>
    </div>
  );
}

function renderServerTimeline(log: RequestLog, startedAt: number): string {
  const fmt = (delta: number) => {
    const d = new Date(startedAt + delta);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
  };
  const lines: string[] = [];
  lines.push(`[${fmt(0)}] [INFO]    接收请求 ${log.method} ${log.path}`);
  lines.push(`[${fmt(0)}] [INFO]    客户端 IP: ${log.clientIp ?? 'unknown'}`);
  if (log.requestId) lines.push(`[${fmt(0)}] [INFO]    Request ID: ${log.requestId}`);
  if (log.format === 'sse') {
    lines.push(`[${fmt(1)}] [INFO]    检测到 SSE 协议，准备事件流`);
  } else {
    lines.push(`[${fmt(1)}] [INFO]    校验请求参数`);
  }
  lines.push(
    `[${fmt(log.responseTime)}] [${log.statusKind === 'success' ? 'SUCCESS' : log.statusKind === 'danger' ? 'ERROR' : 'WARN'}] 响应已返回 ${log.status} (${log.responseTime}ms)`,
  );
  if (log.format === 'sse') {
    lines.push(`[${fmt(log.responseTime)}] [INFO]    SSE 流已结束`);
  }
  return lines.join('\n');
}

export function LogsDetailPanel({
  log,
  isLoading,
}: {
  log: RequestLog | null;
  isLoading: boolean;
}) {
  const [tab, setTab] = useState<'request' | 'response' | 'headers' | 'server'>('request');
  const timeMs = log?.createdAt ? new Date(log.createdAt).getTime() : Date.now();

  if (isLoading) {
    return (
      <div className="rounded-md border border-line bg-elevated p-4">
        <div className="py-10 text-center text-[12px] text-ink-tertiary">加载中…</div>
      </div>
    );
  }
  if (!log) {
    return (
      <div className="rounded-md border border-line bg-elevated p-4">
        <div className="py-10 text-center text-[12px] text-ink-tertiary">选择一条日志查看详情</div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-line bg-elevated p-4">
      <div className="mb-3 flex items-center gap-2">
        <MethodBadge method={log.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'} />
        <span className="font-mono text-[13px] text-ink-secondary">{log.path}</span>
        {log.format === 'sse' && (
          <span className="rounded bg-warning-soft px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-warning">
            SSE
          </span>
        )}
      </div>
      <Tabs<'request' | 'response' | 'headers' | 'server'>
        value={tab}
        onChange={setTab}
        className="mb-3"
        items={[
          { value: 'request', label: 'Request' },
          { value: 'response', label: 'Response' },
          { value: 'headers', label: 'Headers' },
          { value: 'server', label: '服务端日志' },
        ]}
      />
      <div className="space-y-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
          {tab === 'request' && '请求参数 / Body'}
          {tab === 'response' && '响应内容'}
          {tab === 'headers' && '请求 / 响应头'}
          {tab === 'server' && '服务端处理时间线'}
        </h4>
        {tab === 'request' && (
          <div className="space-y-3">
            <JsonField label="Query" value={log.requestParams} />
            <JsonField label="Body" value={log.requestBody} />
          </div>
        )}
        {tab === 'response' && <JsonField label="响应内容" value={log.responseBody} placeholder="空响应" />}
        {tab === 'headers' && (
          <div className="space-y-4">
            <div>
              <h5 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-disabled">
                请求头
              </h5>
              <HeadersBlock headers={log.requestHeaders} />
            </div>
            <div>
              <h5 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-disabled">
                响应头
              </h5>
              <HeadersBlock headers={null} emptyHint="后端尚未记录响应头" />
            </div>
          </div>
        )}
        {tab === 'server' && (
          <pre className="code-content !rounded-md !p-3 !text-[12px]">{renderServerTimeline(log, timeMs)}</pre>
        )}
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">请求摘要</h4>
          <div className="rounded-md border border-line bg-elevated p-3">
            <KV k="Method" v={log.method} />
            <KV k="URL" v={log.path} mono />
            <KV k="Client IP" v={log.clientIp ?? '—'} mono />
            <KV k="Request ID" v={log.requestId ?? '—'} mono />
            <KV k="格式" v={log.format === 'sse' ? 'SSE' : 'HTTP'} />
            <KV
              k="状态"
              v={`${log.status} ${statusText(log.status)}`}
              valueClass={
                log.statusKind === 'success'
                  ? 'text-success'
                  : log.statusKind === 'warning' || log.statusKind === 'danger'
                    ? 'text-warning'
                    : ''
              }
            />
            <KV k="响应时间" v={`${log.responseTime} ms`} mono />
            <KV k="响应大小" v={`${log.responseSize} B`} mono />
            <KV k="所属接口" v={log.apiName ?? '—'} />
            <KV k="所属项目" v={log.projectName ?? '—'} />
            <KV k="调用时间" v={new Date(log.createdAt).toLocaleString()} mono />
          </div>
        </div>
      </div>
    </div>
  );
}
