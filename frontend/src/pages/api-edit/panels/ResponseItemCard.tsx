import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Trash2, Star, GripVertical, AlertCircle } from 'lucide-react';
import { Button, Select, Input } from '@/components/ui';
import { CodeEditor } from '@/components/CodeEditor';
import type { MockApiResponse } from '@/types/api';
import { ResponseConditionEditor } from './ResponseConditionEditor';

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

type ResponseItemCardProps = {
  item: MockApiResponse;
  isSSE: boolean;
  onChange: (next: MockApiResponse) => void;
  onRemove: () => void;
  dragHandleProps: {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
  };
  isDragOver: boolean;
};

export function ResponseItemCard({
  item,
  isSSE,
  onChange,
  onRemove,
  dragHandleProps,
  isDragOver,
}: ResponseItemCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isDragging = useRef(false);
  const [bodyText, setBodyText] = useState(() => safeStringify(item.responseBody ?? {}));
  const [bodyErr, setBodyErr] = useState<string | null>(null);
  const [headersText, setHeadersText] = useState(() => safeStringify(item.responseHeaders ?? {}));
  const [headersErr, setHeadersErr] = useState<string | null>(null);

  // 同步 props 变化到本地状态
  useEffect(() => {
    setBodyText(safeStringify(item.responseBody ?? {}));
    setBodyErr(null);
  }, [item.responseBody]);

  useEffect(() => {
    setHeadersText(safeStringify(item.responseHeaders ?? {}));
    setHeadersErr(null);
  }, [item.responseHeaders]);

  const status = item.responseStatus ?? 200;
  const conditionSummary = item.conditions.length > 0
    ? item.conditions.map((c) => `${c.source}.${c.field} ${c.operator} ${c.value}`).join(' AND ')
    : '无条件';

  const handleSaveBody = () => {
    try {
      const body = bodyText.trim() ? JSON.parse(bodyText) : {};
      setBodyText(JSON.stringify(body, null, 2));
      setBodyErr(null);
      onChange({ ...item, responseBody: body });
    } catch (e) {
      setBodyErr(e instanceof Error ? e.message : 'JSON 格式错误');
    }
  };

  const handleSaveHeaders = () => {
    try {
      const headers = headersText.trim() ? JSON.parse(headersText) : null;
      setHeadersText(headers ? JSON.stringify(headers, null, 2) : '{}');
      setHeadersErr(null);
      onChange({ ...item, responseHeaders: headers });
    } catch (e) {
      setHeadersErr(e instanceof Error ? e.message : 'JSON 格式错误');
    }
  };

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isDragOver ? 'border-primary bg-primary/5' : 'border-border'
      }`}
    >
      {/* Header - always visible */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-canvas-subtle/50"
        onClick={() => {
          if (!isDragging.current) setExpanded(!expanded);
        }}
        draggable={dragHandleProps.draggable}
        onDragStart={(e) => {
          isDragging.current = true;
          dragHandleProps.onDragStart(e);
        }}
        onDragOver={dragHandleProps.onDragOver}
        onDrop={(e) => {
          dragHandleProps.onDrop(e);
          // 延迟重置，避免 drop 后立即触发 click
          setTimeout(() => { isDragging.current = false; }, 0);
        }}
        onDragEnd={(e) => {
          dragHandleProps.onDragEnd(e);
          setTimeout(() => { isDragging.current = false; }, 0);
        }}
      >
        <GripVertical className="h-4 w-4 text-ink-subtle flex-shrink-0 cursor-grab active:cursor-grabbing" />

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {expanded ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
          <span className="text-[13px] font-medium truncate">{item.name}</span>
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-mono ${
            status >= 500 ? 'bg-danger/10 text-danger' :
            status >= 400 ? 'bg-warning/10 text-warning' :
            'bg-success/10 text-success'
          }`}>
            {status}
          </span>
          {item.isDefault && (
            <span title="默认响应">
              <Star className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" fill="currentColor" />
            </span>
          )}
          <span className="text-[11px] text-ink-subtle truncate hidden sm:inline">
            {conditionSummary}
          </span>
        </button>

        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...item, isDefault: !item.isDefault })}
            className={`h-6 w-6 p-0 ${item.isDefault ? 'text-amber-500' : 'text-ink-subtle'}`}
          >
            <Star className="h-3.5 w-3.5" fill={item.isDefault ? 'currentColor' : 'none'} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onRemove} className="h-6 w-6 p-0 text-danger hover:text-danger">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {/* Name */}
          <div className="form-row">
            <div className="flex-1">
              <label className="form-label">名称</label>
              <Input
                value={item.name}
                onChange={(e) => onChange({ ...item, name: e.target.value })}
                placeholder="如：成功响应、参数错误"
              />
            </div>
          </div>

          {/* Conditions */}
          <div>
            <label className="form-label">匹配条件</label>
            <ResponseConditionEditor
              conditions={item.conditions}
              onChange={(conditions) => onChange({ ...item, conditions })}
            />
          </div>

          {/* Response config */}
          <div className="form-row three-col">
            <div>
              <label className="form-label">状态码</label>
              <Select
                value={status}
                onChange={(e) => onChange({ ...item, responseStatus: Number(e.target.value) })}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="form-label">延迟 (ms)</label>
              <Input
                type="number"
                min={0}
                max={60000}
                value={item.responseDelay ?? 0}
                onChange={(e) => onChange({ ...item, responseDelay: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="form-label">延迟上限 (ms)</label>
              <Input
                type="number"
                min={0}
                max={60000}
                value={item.responseDelayMax ?? 0}
                placeholder="0"
                onChange={(e) => onChange({ ...item, responseDelayMax: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          {!isSSE && (
            <div className="form-row">
              <div className="flex-1">
                <label className="form-label">Content-Type</label>
                <Select
                  value={item.responseContentType ?? 'application/json'}
                  onChange={(e) => onChange({ ...item, responseContentType: e.target.value })}
                >
                  {CONTENT_TYPES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          {/* Response headers */}
          <div>
            <label className="form-label">响应头 <span className="text-ink-subtle font-normal">· JSON 对象</span></label>
            <CodeEditor
              language="json"
              value={headersText}
              onChange={(v) => { setHeadersText(v); setHeadersErr(null); }}
              onBlur={handleSaveHeaders}
              rows={3}
              invalid={!!headersErr}
            />
            {headersErr && <div className="text-[11px] text-danger mt-1">{headersErr}</div>}
          </div>

          {/* Response body */}
          <div>
            <label className="form-label">响应体 <span className="text-ink-subtle font-normal">· 支持变量插值</span></label>
            <div className="info-tip mb-2">
              <AlertCircle />
              <div>
                支持变量：<code>{'{{req.body.xxx}}'}</code> 请求体、<code>{'{{req.query.xxx}}'}</code> 查询参数、
                <code>{'{{req.path.xxx}}'}</code> 路径参数、
                <code>{'{{dbResult}}'}</code> 数据联动结果（insert 为行对象，select 为数组，update/delete 为{' '}
                <code>{'{ affected }'}</code>）
              </div>
            </div>
            <CodeEditor
              language="json"
              value={bodyText}
              onChange={(v) => { setBodyText(v); setBodyErr(null); }}
              onBlur={handleSaveBody}
              rows={8}
              invalid={!!bodyErr}
            />
            {bodyErr && <div className="text-[11px] text-danger mt-1">{bodyErr}</div>}
          </div>
        </div>
      )}
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
