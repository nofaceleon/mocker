import { useEffect, useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { Card, FormField, Input, Select, Button, CodeBlock } from '@/components/ui';
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

type ResponsePanelProps = {
  draft: MockApiPayload;
  onChange: (next: MockApiPayload) => void;
  onSave: () => void;
  saving?: boolean;
};

export function ResponsePanel({ draft, onChange, onSave, saving }: ResponsePanelProps) {
  const [bodyText, setBodyText] = useState(() => safeStringify(draft.responseBody ?? {}));
  const [bodyErr, setBodyErr] = useState<string | null>(null);
  const [headersText, setHeadersText] = useState(() => safeStringify(draft.responseHeaders ?? {}));
  const [headersErr, setHeadersErr] = useState<string | null>(null);

  useEffect(() => {
    setBodyText(safeStringify(draft.responseBody ?? {}));
  }, [draft.responseBody]);
  useEffect(() => {
    setHeadersText(safeStringify(draft.responseHeaders ?? {}));
  }, [draft.responseHeaders]);

  const applyBody = () => {
    try {
      const parsed = bodyText.trim() ? JSON.parse(bodyText) : {};
      onChange({ ...draft, responseBody: parsed });
      setBodyErr(null);
    } catch (e) {
      setBodyErr(e instanceof Error ? e.message : 'JSON 解析失败');
    }
  };

  const applyHeaders = () => {
    try {
      const parsed = headersText.trim() ? JSON.parse(headersText) : {};
      onChange({ ...draft, responseHeaders: parsed as Record<string, string> });
      setHeadersErr(null);
    } catch (e) {
      setHeadersErr(e instanceof Error ? e.message : 'JSON 解析失败');
    }
  };

  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Check}
        title="响应配置"
        description="定义 Mock 接口如何响应外部请求：状态码、响应头、响应体、模拟延迟。"
      />

      <Card title="响应基本信息">
        <div className="form-row three-col">
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
          <FormField label="响应延迟" hint="毫秒">
            <Input
              type="number"
              min={0}
              max={60000}
              value={draft.responseDelay ?? 0}
              onChange={(e) => onChange({ ...draft, responseDelay: Number(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label="延迟类型" hint="delayMax>0 时启用随机范围">
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

        <div className="form-row">
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
          <FormField label="响应头" hint="JSON 对象">
            <div className="space-y-1.5">
              <textarea
                value={headersText}
                onChange={(e) => setHeadersText(e.target.value)}
                rows={4}
                className={`form-textarea mono !text-[12.5px] ${headersErr ? 'border-danger' : ''}`}
                placeholder='{"X-Request-Id": "{{req.headers[\"x-request-id\"]}}"}'
              />
              {headersErr && <div className="text-[11px] text-danger">{headersErr}</div>}
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setHeadersText(prettyJson(headersText))}>
                  格式化
                </Button>
                <Button size="sm" variant="secondary" onClick={applyHeaders}>
                  <Check className="h-3 w-3" />
                  应用
                </Button>
              </div>
            </div>
          </FormField>
        </div>
      </Card>

      <Card
        title={
          <>
            响应体 <span className="font-normal text-ink-subtle">· 支持变量插值</span>
          </>
        }
        extra={
          <div className="flex gap-3 text-[12px]">
            <button
              type="button"
              className="tool-link"
              onClick={() => setBodyText(prettyJson(bodyText))}
            >
              格式化
            </button>
          </div>
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
            onChange={(e) => setBodyText(e.target.value)}
            rows={14}
            className="block w-full resize-y border-0 bg-transparent font-mono text-[12.5px] leading-[1.75] text-[#E4E4E7] outline-none focus:outline-none"
            spellCheck={false}
          />
        </CodeBlock>

        {bodyErr && <div className="mt-2 text-[11px] text-danger">{bodyErr}</div>}
        <div className="mt-2 flex items-center justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={applyBody}>
            <Check className="h-3 w-3" />
            应用
          </Button>
        </div>
      </Card>

      <PanelActions hint="下次请求生效" onSave={onSave} saving={saving} />
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

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}