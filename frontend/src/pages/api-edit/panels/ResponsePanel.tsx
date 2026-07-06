import { useEffect, useState } from 'react';
import { Check, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Card, FormField, Input, Select, CodeBlock, Button } from '@/components/ui';
import type { MockApiPayload } from '@/hooks/queries/use-mock-apis';
import { PanelHeader } from '../PanelHeader';
import { PanelActions } from '../PanelActions';

const STATUS_OPTIONS = [
  { value: 200, label: '200 OK' },
  { value: 201, label: '201 Created' },
  { value: 202, label: '202 Accepted' },
  { value: 204, label: '204 No Content' },
  { value: 400, label: '400 Bad Request' },
  { value: 401, label: '401 Unauthorized' },
  { value: 403, label: '403 Forbidden' },
  { value: 404, label: '404 Not Found' },
  { value: 422, label: '422 Unprocessable' },
  { value: 500, label: '500 Server Error' },
  { value: 503, label: '503 Unavailable' },
];

const CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
  'application/xml',
  'text/html',
];

type SSEEvent = {
  id?: string;
  event?: string;
  data: unknown;
  retry?: number;
};

type SSEConfig = {
  events: SSEEvent[];
  interval?: number;
  loop?: boolean;
  comment?: string;
};

type ResponsePanelProps = {
  draft: MockApiPayload;
  onChange: (next: MockApiPayload) => void;
  onSave: (data?: Partial<MockApiPayload>) => void;
  saving?: boolean;
};

export function ResponsePanel({ draft, onChange, onSave, saving }: ResponsePanelProps) {
  const isSSE = draft.protocol === 'SSE';

  const [bodyText, setBodyText] = useState(() => safeStringify(draft.responseBody ?? {}));
  const [bodyErr, setBodyErr] = useState<string | null>(null);
  const [headersText, setHeadersText] = useState(() => safeStringify(draft.responseHeaders ?? {}));
  const [headersErr, setHeadersErr] = useState<string | null>(null);

  // SSE配置状态
  const [sseConfig, setSSEConfig] = useState<SSEConfig>(() => {
    if (!isSSE) return { events: [], interval: 500, loop: false };
    const body = draft.responseBody as Record<string, unknown> | null;
    if (body && Array.isArray(body.events)) {
      return {
        events: body.events as SSEEvent[],
        interval: (body.interval as number) ?? 500,
        loop: body.loop === true,
        comment: body.comment as string | undefined,
      };
    }
    return { events: [], interval: 500, loop: false };
  });

  useEffect(() => {
    setBodyText(safeStringify(draft.responseBody ?? {}));
  }, [draft.responseBody]);
  useEffect(() => {
    setHeadersText(safeStringify(draft.responseHeaders ?? {}));
  }, [draft.responseHeaders]);

  const handleSave = () => {
    if (isSSE) {
      // SSE模式：保存SSE配置
      try {
        const headers = headersText.trim() ? JSON.parse(headersText) : {};
        setHeadersErr(null);
        const sseData: Partial<MockApiPayload> = {
          responseBody: sseConfig,
          responseHeaders: headers,
          responseContentType: 'text/event-stream',
        };
        onChange({ ...draft, ...sseData });
        onSave(sseData);
      } catch (e) {
        setHeadersErr(e instanceof Error ? e.message : 'JSON 格式错误');
      }
    } else {
      // 普通HTTP模式
      try {
        const body = bodyText.trim() ? JSON.parse(bodyText) : {};
        setBodyErr(null);
        try {
          const headers = headersText.trim() ? JSON.parse(headersText) : {};
          setHeadersErr(null);
          const httpData: Partial<MockApiPayload> = {
            responseBody: body,
            responseHeaders: headers,
          };
          onChange({ ...draft, ...httpData });
          onSave(httpData);
        } catch (e) {
          setHeadersErr(e instanceof Error ? e.message : 'JSON 格式错误');
        }
      } catch (e) {
        setBodyErr(e instanceof Error ? e.message : 'JSON 格式错误');
      }
    }
  };

  const addSSEEvent = () => {
    setSSEConfig({
      ...sseConfig,
      events: [...sseConfig.events, { event: 'message', data: { text: '' } }],
    });
  };

  const updateSSEEvent = (index: number, event: SSEEvent) => {
    const newEvents = [...sseConfig.events];
    newEvents[index] = event;
    setSSEConfig({ ...sseConfig, events: newEvents });
  };

  const removeSSEEvent = (index: number) => {
    setSSEConfig({
      ...sseConfig,
      events: sseConfig.events.filter((_, i) => i !== index),
    });
  };

  const handleSSEDataChange = (index: number, dataText: string) => {
    try {
      const data = JSON.parse(dataText);
      updateSSEEvent(index, { ...sseConfig.events[index], data });
    } catch {
      // 保持原始文本，让用户继续编辑
    }
  };

  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Check}
        title="响应配置"
        description={isSSE ? '配置 SSE（Server-Sent Events）事件流：事件类型、数据内容、发送间隔。' : '定义 Mock 接口如何响应外部请求：状态码、响应头、响应体、模拟延迟。'}
      />

      <Card title="响应基本信息">
        <div className="form-row three-col">
          {!isSSE && (
            <FormField label="状态码">
              <Select
                value={draft.responseStatus ?? 200}
                onChange={(e) => onChange({ ...draft, responseStatus: Number(e.target.value) })}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          <FormField label="响应延迟" hint="毫秒">
            <Input
              type="number"
              min={0}
              max={60000}
              value={draft.responseDelay ?? 0}
              onChange={(e) => onChange({ ...draft, responseDelay: Number(e.target.value) || 0 })}
            />
          </FormField>
          {isSSE && (
            <FormField label="事件间隔" hint="毫秒">
              <Input
                type="number"
                min={100}
                max={60000}
                value={sseConfig.interval ?? 500}
                onChange={(e) => setSSEConfig({ ...sseConfig, interval: Number(e.target.value) || 500 })}
              />
            </FormField>
          )}
          <FormField label="延迟类型" hint={isSSE ? '首个事件前的延迟' : 'delayMax>0 时启用随机范围'}>
            <Input
              type="number"
              min={0}
              max={60000}
              value={draft.responseDelayMax ?? 0}
              placeholder="0"
              onChange={(e) => onChange({ ...draft, responseDelayMax: Number(e.target.value) || 0 })}
            />
          </FormField>
        </div>

        {isSSE && (
          <div className="form-row">
            <FormField label="循环发送">
              <div className="flex items-center gap-2 pt-1.5">
                <input
                  type="checkbox"
                  checked={sseConfig.loop ?? false}
                  onChange={(e) => setSSEConfig({ ...sseConfig, loop: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-[12.5px] text-ink-secondary">事件发送完毕后循环发送</span>
              </div>
            </FormField>
            <FormField label="初始注释" hint="可选">
              <Input
                value={sseConfig.comment ?? ''}
                onChange={(e) => setSSEConfig({ ...sseConfig, comment: e.target.value || undefined })}
                placeholder="连接建立时的注释内容"
              />
            </FormField>
          </div>
        )}

        <div className="form-row">
          {!isSSE && (
            <FormField label="Content-Type">
              <Select
                value={draft.responseContentType ?? 'application/json'}
                onChange={(e) => onChange({ ...draft, responseContentType: e.target.value })}
              >
                {CONTENT_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          <FormField label="响应头" hint="JSON 对象">
            <div className="space-y-1.5">
              <textarea
                value={headersText}
                onChange={(e) => {
                  setHeadersText(e.target.value);
                  setHeadersErr(null);
                }}
                rows={4}
                className={`form-textarea mono mono-dark !text-[12.5px] ${headersErr ? 'border-danger' : ''}`}
                placeholder='{"X-Request-Id": "{{req.headers[\"x-request-id\"]}}"}'
              />
              {headersErr && <div className="text-[11px] text-danger">{headersErr}</div>}
            </div>
          </FormField>
        </div>
      </Card>

      {isSSE ? (
        <Card title="SSE 事件配置">
          <div className="info-tip mb-4">
            <AlertCircle />
            <div>
              配置 SSE 事件流。每个事件包含 <code>event</code>（事件类型）、<code>data</code>（数据内容）。
              支持变量插值：<code>{'{{req.body.xxx}}'}</code>
            </div>
          </div>

          <div className="space-y-4">
            {sseConfig.events.map((event, index) => (
              <div key={index} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[13px] font-medium">事件 {index + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSSEEvent(index)}
                    className="text-danger hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="form-row three-col">
                  <FormField label="事件类型">
                    <Input
                      value={event.event ?? ''}
                      onChange={(e) => updateSSEEvent(index, { ...event, event: e.target.value || undefined })}
                      placeholder="message"
                    />
                  </FormField>
                  <FormField label="事件 ID">
                    <Input
                      value={event.id ?? ''}
                      onChange={(e) => updateSSEEvent(index, { ...event, id: e.target.value || undefined })}
                      placeholder="可选"
                    />
                  </FormField>
                  <FormField label="重试间隔">
                    <Input
                      type="number"
                      min={0}
                      value={event.retry ?? ''}
                      onChange={(e) => updateSSEEvent(index, { ...event, retry: Number(e.target.value) || undefined })}
                      placeholder="可选"
                    />
                  </FormField>
                </div>

                <FormField label="事件数据">
                  <textarea
                    value={safeStringify(event.data)}
                    onChange={(e) => handleSSEDataChange(index, e.target.value)}
                    rows={4}
                    className="form-textarea mono mono-dark !text-[12.5px]"
                    placeholder='{"text": "Hello, World!"}'
                  />
                </FormField>
              </div>
            ))}

            <Button variant="outline" onClick={addSSEEvent} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              添加事件
            </Button>
          </div>
        </Card>
      ) : (
        <Card
          title={
            <>
              响应体 <span className="font-normal text-ink-subtle">· 支持变量插值</span>
            </>
          }
        >
          <div className="info-tip">
            <AlertCircle />
            <div>
              支持变量：<code>{'{{req.body.xxx}}'}</code> 请求体、<code>{'{{req.query.xxx}}'}</code> 查询参数、<code>{'{{global.xxx}}'}</code> 全局变量
            </div>
          </div>

          <CodeBlock
            className="mt-2.5"
            language="JSON"
            tabs={
              <>
                <code style={{ color: '#C4B5FD' }}>{'{{req.body.*}}'}</code>
                <code style={{ color: '#86EFAC' }}>{'{{req.query.*}}'}</code>
                <code style={{ color: '#F0ABFC' }}>{'{{global.*}}'}</code>
              </>
            }
          >
            <textarea
              value={bodyText}
              onChange={(e) => {
                setBodyText(e.target.value);
                setBodyErr(null);
              }}
              rows={14}
              className="block w-full resize-y border-0 bg-transparent font-mono text-[12.5px] leading-[1.75] text-[#E4E4E7] outline-none focus:outline-none"
              spellCheck={false}
            />
          </CodeBlock>

          {bodyErr && <div className="mt-2 text-[11px] text-danger">{bodyErr}</div>}
        </Card>
      )}

      <PanelActions
        hint={bodyErr || headersErr ? '请修正 JSON 格式错误后再保存' : '下次请求生效'}
        onSave={handleSave}
        saving={saving}
        disabled={!!bodyErr || !!headersErr}
      />
    </div>
  );
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}