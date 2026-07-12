import { useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { Card, FormField, Input, Select, Switch } from '@/components/ui';
import type { HttpMethod, Protocol } from '@/types/api';
import type { MockApiPayload } from '@/hooks/queries/use-mock-apis';
import { reportFieldError } from '@/lib/form-validation';
import { PanelHeader } from '../PanelHeader';
import { PanelActions } from '../PanelActions';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const PROTOCOLS: { value: Protocol; label: string }[] = [
  { value: 'HTTP', label: 'HTTP / REST' },
  { value: 'WebSocket', label: 'WebSocket' },
  { value: 'SSE', label: 'SSE' },
];
const PRIORITIES = [
  { value: 'high', label: '高（精确匹配）' },
  { value: 'mid', label: '中（参数匹配）' },
  { value: 'low', label: '低（通配符）' },
] as const;
const CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
  'application/xml',
] as const;

type Extra = {
  protocol?: Protocol;
  priority?: (typeof PRIORITIES)[number]['value'];
  contentType?: string;
  enabled?: boolean;
};

type BasicPanelProps = {
  formData: MockApiPayload;
  onChange: (next: MockApiPayload) => void;
  groupName?: string;
  onSave: (data?: Partial<MockApiPayload>) => void;
  saving?: boolean;
  extra?: Extra;
  onExtraChange?: (next: Extra) => void;
};

export type BasicExtra = Extra;

type FieldErrors = {
  name?: string;
  path?: string;
};

export function BasicPanel({
  formData,
  onChange,
  groupName,
  onSave,
  saving,
  extra,
  onExtraChange,
}: BasicPanelProps) {
  const protocol = extra?.protocol ?? 'HTTP';
  const priority = extra?.priority ?? 'high';
  const contentType = extra?.contentType ?? formData.responseContentType ?? 'application/json';
  const isSSE = protocol === 'SSE';

  const [errors, setErrors] = useState<FieldErrors>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const pathRef = useRef<HTMLInputElement>(null);

  const handleChange = (next: MockApiPayload) => {
    onChange(next);
    setErrors((prev) => {
      const cleared = { ...prev };
      if (next.name !== formData.name) delete cleared.name;
      if (next.path !== formData.path) delete cleared.path;
      return cleared;
    });
  };

  const handleProtocolChange = (newProtocol: Protocol) => {
    onExtraChange?.({ ...(extra ?? {}), protocol: newProtocol });
    // SSE / WebSocket 使用 GET 作为路由方法占位
    if (newProtocol === 'SSE') {
      handleChange({
        ...formData,
        protocol: newProtocol,
        method: 'GET',
        responseContentType: 'text/event-stream',
      });
    } else if (newProtocol === 'WebSocket') {
      handleChange({
        ...formData,
        protocol: newProtocol,
        method: 'GET',
        responseContentType: 'application/json',
        responseBody:
          formData.responseBody &&
          typeof formData.responseBody === 'object' &&
          formData.responseBody !== null &&
          'welcome' in (formData.responseBody as object)
            ? formData.responseBody
            : {
                welcome: { type: 'welcome', message: 'connected' },
                echo: true,
                pushInterval: 0,
                disconnectAfterMs: 0,
              },
      });
    } else {
      handleChange({ ...formData, protocol: newProtocol });
    }
  };

  const handleSave = () => {
    const next: FieldErrors = {};
    if (!formData.name.trim()) {
      next.name = '请填写接口名称';
    }
    const path = formData.path.trim();
    if (!path) {
      next.path = '请填写路由路径';
    } else if (!path.startsWith('/')) {
      next.path = '路由路径必须以 / 开头';
    }

    if (Object.keys(next).length > 0) {
      setErrors(next);
      if (next.name) {
        reportFieldError(next.name, nameRef.current);
      } else if (next.path) {
        reportFieldError(next.path, pathRef.current);
      }
      return;
    }

    setErrors({});
    onSave();
  };

  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Settings}
        title="基本配置"
        description="定义 Mock 接口的基础信息：名称、HTTP 方法、路由路径、归属分组与启用状态。"
      />

      <Card title="接口信息">
        <div className="form-row">
          <FormField label="接口名称" required error={errors.name}>
            <Input
              ref={nameRef}
              value={formData.name}
              onChange={(e) => handleChange({ ...formData, name: e.target.value })}
              placeholder="例如：人脸注册"
              maxLength={100}
              invalid={!!errors.name}
            />
          </FormField>
          <FormField label="所属功能组" hint="项目 / 模块">
            <Input value={groupName ?? '—'} disabled />
          </FormField>
        </div>

        <div className="form-row three-col">
          <FormField label="协议">
            <Select
              value={protocol}
              onChange={(e) => handleProtocolChange(e.target.value as Protocol)}
            >
              {PROTOCOLS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="HTTP 方法" required>
            <Select
              value={formData.method}
              onChange={(e) => handleChange({ ...formData, method: e.target.value as HttpMethod })}
            >
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="路由优先级">
            <Select
              value={priority}
              onChange={(e) => onExtraChange?.({ ...(extra ?? {}), priority: e.target.value as Extra['priority'] })}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField
          label="路由路径"
          required
          error={errors.path}
          hint={
            errors.path
              ? undefined
              : isSSE
                ? 'SSE 基于 HTTP GET，客户端通过 EventSource API 建立连接'
                : undefined
          }
        >
          <div className="input-group">
            <span className="input-group-text">{isSSE ? 'GET' : formData.method}</span>
            <Input
              ref={pathRef}
              className="mono"
              value={formData.path}
              onChange={(e) => handleChange({ ...formData, path: e.target.value })}
              placeholder="/api/events"
              invalid={!!errors.path}
            />
          </div>
          {!errors.path && !isSSE && (
            <div className="form-helper">
              支持 <code>:id</code> 占位符、<code>*</code> 通配符；匹配优先级：精确 &gt; 参数 &gt; 通配符
            </div>
          )}
        </FormField>

        <FormField label="接口描述">
          <textarea
            value={formData.description ?? ''}
            onChange={(e) => handleChange({ ...formData, description: e.target.value || null })}
            rows={2}
            placeholder="一段简短描述"
            className="form-textarea"
            maxLength={2000}
          />
        </FormField>

        <div className="form-row">
          {!isSSE && (
            <FormField label="Content-Type">
              <Select
                value={contentType}
                onChange={(e) => {
                  const v = e.target.value;
                  handleChange({ ...formData, responseContentType: v });
                  onExtraChange?.({ ...(extra ?? {}), contentType: v });
                }}
              >
                {CONTENT_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          {isSSE && (
            <FormField label="Content-Type">
              <Input value="text/event-stream" disabled />
            </FormField>
          )}
          <FormField label="启用接口">
            <div className="flex items-center gap-2 pt-1.5">
              <Switch
                checked={formData.isEnabled ?? true}
                onChange={(v) => handleChange({ ...formData, isEnabled: v })}
              />
              <span className="text-[12.5px] text-ink-secondary">启用后接收外部调用</span>
            </div>
          </FormField>
        </div>
      </Card>

      <PanelActions onSave={handleSave} saving={saving} />
    </div>
  );
}
