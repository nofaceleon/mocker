import { Settings } from 'lucide-react';
import { Card, FormField, Input, Select, Switch } from '@/components/ui';
import type { HttpMethod, Protocol } from '@/types/api';
import type { MockApiPayload } from '@/hooks/queries/use-mock-apis';
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
  draft: MockApiPayload;
  onChange: (next: MockApiPayload) => void;
  groupName?: string;
  onSave: (data?: Partial<MockApiPayload>) => void;
  saving?: boolean;
  extra?: Extra;
  onExtraChange?: (next: Extra) => void;
};

export type BasicExtra = Extra;

export function BasicPanel({
  draft,
  onChange,
  groupName,
  onSave,
  saving,
  extra,
  onExtraChange,
}: BasicPanelProps) {
  const protocol = extra?.protocol ?? 'HTTP';
  const priority = extra?.priority ?? 'high';
  const contentType = extra?.contentType ?? draft.responseContentType ?? 'application/json';
  const isSSE = protocol === 'SSE';

  const handleProtocolChange = (newProtocol: Protocol) => {
    onExtraChange?.({ ...(extra ?? {}), protocol: newProtocol });
    // SSE协议强制使用GET方法
    if (newProtocol === 'SSE') {
      onChange({ ...draft, protocol: newProtocol, method: 'GET', responseContentType: 'text/event-stream' });
    } else {
      onChange({ ...draft, protocol: newProtocol });
    }
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
          <FormField label="接口名称" required>
            <Input
              value={draft.name}
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
              placeholder="例如：人脸注册"
              maxLength={100}
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
              value={draft.method}
              onChange={(e) => onChange({ ...draft, method: e.target.value as HttpMethod })}
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

        <FormField label="路由路径" required>
          <div className="input-group">
            <span className="input-group-text">{isSSE ? 'GET' : draft.method}</span>
            <Input
              className="mono"
              value={draft.path}
              onChange={(e) => onChange({ ...draft, path: e.target.value })}
              placeholder="/api/events"
            />
          </div>
          <div className="form-helper">
            {isSSE
              ? 'SSE 基于 HTTP GET，客户端通过 EventSource API 建立连接'
              : '支持 <code>:id</code> 占位符、<code>*</code> 通配符；匹配优先级：精确 &gt; 参数 &gt; 通配符'}
          </div>
        </FormField>

        <FormField label="接口描述">
          <textarea
            value={draft.description ?? ''}
            onChange={(e) => onChange({ ...draft, description: e.target.value || null })}
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
                  onChange({ ...draft, responseContentType: v });
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
                checked={draft.isEnabled ?? true}
                onChange={(v) => onChange({ ...draft, isEnabled: v })}
              />
              <span className="text-[12.5px] text-ink-secondary">启用后接收外部调用</span>
            </div>
          </FormField>
        </div>
      </Card>

      <PanelActions onSave={onSave} saving={saving} />
    </div>
  );
}