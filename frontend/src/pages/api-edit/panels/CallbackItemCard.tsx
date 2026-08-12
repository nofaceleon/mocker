import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Trash2 } from 'lucide-react';
import { Button, FormField, Input, Select, Switch } from '@/components/ui';
import { CodeEditor } from '@/components/CodeEditor';
import type { CallbackConfig, CallbackConditionPreset, HttpMethod } from '@/types/api';
import { cn } from '@/lib/cn';

const RETRY_CONDITION_OPTIONS: { value: CallbackConditionPreset; label: string }[] = [
  { value: 'server_error', label: '服务端错误（status >= 500）' },
  { value: 'always', label: '任何非 2xx 响应' },
  { value: 'success_only', label: '只有 2xx 才不重试' },
  { value: 'custom', label: '自定义表达式' },
];

const HTTP_METHODS: HttpMethod[] = ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'];

type CallbackItemCardProps = {
  index: number;
  item: CallbackConfig;
  isExpanded: boolean;
  chainEnabled: boolean;
  dragHandleProps: {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
  };
  isDragOver: boolean;
  isDragging: boolean;
  onToggleExpand: () => void;
  onChange: (next: CallbackConfig) => void;
  onRemove: () => void;
};

type ItemErrors = {
  callbackUrl?: string;
  retryConditionExpr?: string;
};

export function CallbackItemCard({
  index,
  item,
  isExpanded,
  chainEnabled,
  dragHandleProps,
  isDragOver,
  isDragging,
  onToggleExpand,
  onChange,
  onRemove,
}: CallbackItemCardProps) {
  const [headersText, setHeadersText] = useState(() => serialiseHeaders(item.callbackHeaders));
  const [headersErr, setHeadersErr] = useState<string | null>(null);
  const [errors, setErrors] = useState<ItemErrors>({});
  const urlRef = useRef<HTMLInputElement>(null);
  const exprRef = useRef<HTMLInputElement>(null);
  const innerDragRef = useRef(false);

  useEffect(() => {
    setHeadersText(serialiseHeaders(item.callbackHeaders));
    setHeadersErr(null);
  }, [item.callbackHeaders]);

  const update = (patch: Partial<CallbackConfig>) => {
    onChange({ ...item, ...patch });
    setErrors((prev) => {
      const next = { ...prev };
      if ('callbackUrl' in patch) delete next.callbackUrl;
      if ('retryConditionExpr' in patch || 'retryCondition' in patch || 'retryEnabled' in patch) {
        delete next.retryConditionExpr;
      }
      return next;
    });
  };

  const validateNow = (): ItemErrors => {
    const next: ItemErrors = {};
    if (!item.callbackUrl.trim()) next.callbackUrl = '请填写回调 URL';
    if (
      item.retryEnabled &&
      item.retryCondition === 'custom' &&
      !(item.retryConditionExpr ?? '').trim()
    ) {
      next.retryConditionExpr = '请填写自定义表达式';
    }
    setErrors(next);
    return next;
  };

  const handleExpandToggle = () => {
    if (innerDragRef.current) {
      innerDragRef.current = false;
      return;
    }
    if (!isExpanded) validateNow();
    onToggleExpand();
  };

  const handleHeadersBlur = () => {
    const parsed = parseHeaders(headersText);
    if (parsed === null) {
      setHeadersErr('JSON 格式错误');
      return;
    }
    setHeadersErr(null);
    onChange({ ...item, callbackHeaders: parsed });
  };

  const summary = item.callbackUrl || '(未配置 URL)';
  const delayLabel =
    item.delayType === 'random' ? `${item.delayValue}（随机）` : `${item.delayValue} ms`;

  return (
    <div
      className={cn(
        'rounded-lg border bg-white transition-colors',
        isDragOver ? 'border-primary bg-primary/5' : 'border-border',
        !chainEnabled && 'opacity-60',
        isDragging && 'opacity-40',
      )}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        draggable={dragHandleProps.draggable}
        onDragStart={(e) => {
          innerDragRef.current = true;
          dragHandleProps.onDragStart(e);
        }}
        onDragOver={dragHandleProps.onDragOver}
        onDrop={(e) => {
          dragHandleProps.onDrop(e);
          setTimeout(() => {
            innerDragRef.current = false;
          }, 0);
        }}
        onDragEnd={(e) => {
          dragHandleProps.onDragEnd(e);
          setTimeout(() => {
            innerDragRef.current = false;
          }, 0);
        }}
      >
        <GripVertical className="h-4 w-4 text-ink-subtle flex-shrink-0 cursor-grab active:cursor-grabbing" />

        <button
          type="button"
          onClick={handleExpandToggle}
          className="flex flex-1 items-center gap-2 min-w-0 text-left"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-canvas-subtle text-[11px] font-mono text-ink-secondary">
            {index + 1}
          </span>
          <span className="text-[13px] font-medium truncate">
            {item.name?.trim() || `回调 ${index + 1}`}
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-mono flex-shrink-0',
              item.callbackMethod === 'GET'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-emerald-50 text-emerald-700',
            )}
          >
            {item.callbackMethod}
          </span>
          <span className="text-[11px] text-ink-subtle truncate inline">{summary}</span>
        </button>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[11px] text-ink-tertiary">{delayLabel}</span>
          <Switch
            checked={item.isEnabled}
            onChange={(v) => update({ isEnabled: v })}
            disabled={!chainEnabled}
            title={chainEnabled ? '启用/禁用该回调' : '请先启用回调链'}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-7 w-7 p-0 text-danger hover:text-danger"
            title="删除回调"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          <div className="form-row">
            <FormField label="名称" hint="可空；用于标识这条回调">
              <Input
                value={item.name ?? ''}
                onChange={(e) => update({ name: e.target.value })}
                placeholder={`回调 ${index + 1}`}
                disabled={!chainEnabled}
              />
            </FormField>
          </div>

          <div className="form-row">
            <FormField label="回调 URL" required className="col-span-2" error={errors.callbackUrl}>
              <Input
                ref={urlRef}
                className="mono"
                value={item.callbackUrl}
                onChange={(e) => update({ callbackUrl: e.target.value })}
                placeholder="https://example.com/callback 或 {{req.body.callbackUrl}}"
                disabled={!chainEnabled}
                invalid={!!errors.callbackUrl}
              />
              {!errors.callbackUrl && (
                <div className="form-helper">
                  支持变量替换，例 <code>{'{{req.body.callbackUrl}}'}</code> 或固定 URL
                </div>
              )}
            </FormField>
            <FormField label="回调方法">
              <Select
                value={item.callbackMethod}
                onChange={(e) =>
                  update({ callbackMethod: e.target.value as CallbackConfig['callbackMethod'] })
                }
                disabled={!chainEnabled}
              >
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="form-row three-col">
            <FormField label="延迟类型">
              <Select
                value={item.delayType}
                onChange={(e) =>
                  update({ delayType: e.target.value as CallbackConfig['delayType'] })
                }
                disabled={!chainEnabled}
              >
                <option value="fixed">固定</option>
                <option value="random">随机范围</option>
              </Select>
            </FormField>
            <FormField
              label="延迟时间"
              hint={item.delayType === 'random' ? '范围：最小-最大（毫秒）' : '毫秒'}
            >
              <Input
                value={item.delayValue}
                onChange={(e) => update({ delayValue: e.target.value })}
                placeholder={item.delayType === 'random' ? '3000-8000' : '5000'}
                disabled={!chainEnabled}
              />
            </FormField>
            <FormField label="链路语义" hint="相对上一条回调结束">
              <Input value="等待后触发下一条" disabled readOnly className="!bg-canvas-subtle" />
            </FormField>
          </div>

          <FormField label="回调请求头" hint="JSON 对象">
            <CodeEditor
              language="json"
              rows={3}
              value={headersText}
              onChange={(v) => {
                setHeadersText(v);
                setHeadersErr(null);
              }}
              onBlur={handleHeadersBlur}
              disabled={!chainEnabled}
              invalid={!!headersErr}
            />
            {headersErr && <div className="text-[11px] text-danger mt-1">{headersErr}</div>}
          </FormField>

          <FormField
            label="回调请求体"
            hint="支持 JSON 文本；变量 {{req.body.x}} / {{response.x}} 会被替换"
          >
            <CodeEditor
              language="json"
              rows={6}
              value={item.callbackBody}
              onChange={(v) => update({ callbackBody: v })}
              disabled={!chainEnabled}
            />
          </FormField>

          <div className="rounded-md border border-border bg-canvas-subtle/40 p-3 space-y-3">
            <div className="form-row">
              <FormField label="启用自动重试" className="col-span-2">
                <Switch
                  checked={item.retryEnabled}
                  onChange={(v) => update({ retryEnabled: v })}
                  disabled={!chainEnabled}
                />
              </FormField>
            </div>
            <div className="form-row three-col">
              <FormField label="最大重试次数">
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={item.maxRetries}
                  onChange={(e) => update({ maxRetries: Math.max(0, Number(e.target.value) || 0) })}
                  disabled={!chainEnabled || !item.retryEnabled}
                />
              </FormField>
              <FormField label="重试间隔" hint="毫秒">
                <Input
                  type="number"
                  min={100}
                  value={item.retryInterval}
                  onChange={(e) =>
                    update({
                      retryInterval: Math.max(100, Number(e.target.value) || 100),
                    })
                  }
                  disabled={!chainEnabled || !item.retryEnabled}
                />
              </FormField>
              <FormField label="间隔策略">
                <Select
                  value={item.retryStrategy}
                  onChange={(e) =>
                    update({
                      retryStrategy: e.target.value as CallbackConfig['retryStrategy'],
                    })
                  }
                  disabled={!chainEnabled || !item.retryEnabled}
                >
                  <option value="fixed">固定间隔</option>
                  <option value="exponential">指数退避</option>
                </Select>
              </FormField>
            </div>
            <div className="form-row">
              <FormField label="失败条件" hint="满足此条件才会触发自动重试" className="col-span-2">
                <Select
                  value={item.retryCondition}
                  onChange={(e) =>
                    update({
                      retryCondition: e.target.value as CallbackConfig['retryCondition'],
                    })
                  }
                  disabled={!chainEnabled || !item.retryEnabled}
                >
                  {RETRY_CONDITION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            {item.retryCondition === 'custom' && (
              <div className="form-row">
                <FormField
                  label="自定义表达式"
                  required
                  hint={errors.retryConditionExpr ? undefined : '可用变量：statusCode'}
                  error={errors.retryConditionExpr}
                  className="col-span-2"
                >
                  <Input
                    ref={exprRef}
                    className="mono"
                    value={item.retryConditionExpr ?? ''}
                    onChange={(e) => update({ retryConditionExpr: e.target.value })}
                    disabled={!chainEnabled || !item.retryEnabled}
                    placeholder="statusCode != 200"
                    invalid={!!errors.retryConditionExpr}
                  />
                </FormField>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function serialiseHeaders(h: Record<string, string>): string {
  return Object.keys(h).length === 0 ? '' : JSON.stringify(h, null, 2);
}

function parseHeaders(raw: string): Record<string, string> | null {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const obj = JSON.parse(trimmed);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) out[k] = String(v);
      return out;
    }
    return null;
  } catch {
    return null;
  }
}
