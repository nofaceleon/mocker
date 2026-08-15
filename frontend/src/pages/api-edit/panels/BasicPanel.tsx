import { useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { Card, CopyButton, FormField, Input, Select, Switch } from '@/components/ui';
import type { HttpMethod, Protocol } from '@/types/api';
import type { MockApiPayload } from '@/hooks/queries/use-mock-apis';
import { config as runtimeConfig } from '@/lib/runtime-config';
import { reportFieldError } from '@/lib/form-validation';
import type { ConfigTab } from '../ConfigNav';
import { PanelHeader } from '../PanelHeader';
import { PanelActions } from '../PanelActions';
import { FeatureFlagsCard, type FeatureFlagsCardProps } from '../FeatureFlagsCard';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const PROTOCOLS: { value: Protocol; label: string; hint: string }[] = [
  { value: 'HTTP', label: 'HTTP / REST', hint: '标准请求-响应模式，适用于绝大多数业务接口' },
  {
    value: 'WebSocket',
    label: 'WebSocket',
    hint: '长连接双向通信，由客户端通过 upgrade 协议建立',
  },
  {
    value: 'SSE',
    label: 'SSE',
    hint: '服务端推送；底层走 HTTP GET，客户端使用 EventSource',
  },
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
  tab?: ConfigTab;
  onTabChange?: (tab: ConfigTab) => void;
  featureRows?: FeatureFlagsCardProps['rows'];
  onToggleFeatureHidden?: FeatureFlagsCardProps['onToggleHidden'];
};

export type BasicExtra = Extra;

type FieldErrors = {
  name?: string;
  path?: string;
};

const PROTOCOL_HINT_BY_VALUE: Record<Protocol, string> = {
  HTTP: PROTOCOLS[0].hint,
  WebSocket: PROTOCOLS[1].hint,
  SSE: PROTOCOLS[2].hint,
};

export function BasicPanel({
  formData,
  onChange,
  groupName,
  onSave,
  saving,
  extra,
  onExtraChange,
  onTabChange,
  featureRows,
  onToggleFeatureHidden,
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

  const fullUrl = `${runtimeConfig.apiBase}${formData.path || '/'}`;

  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Settings}
        title="基本配置"
        description="定义 Mock 接口的基础信息：名称、HTTP 方法、路由路径、归属分组与启用状态。"
      />

      {featureRows && onTabChange && onToggleFeatureHidden && (
        <FeatureFlagsCard
          rows={featureRows}
          onJumpTab={(t) => onTabChange(t)}
          onToggleHidden={onToggleFeatureHidden}
        />
      )}

      <Card title="路由">
        <div className="form-row three-col">
          <FormField label="协议" hint={PROTOCOL_HINT_BY_VALUE[protocol]} hintIcon>
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
              onChange={(e) =>
                onExtraChange?.({ ...(extra ?? {}), priority: e.target.value as Extra['priority'] })
              }
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
            errors.path ? undefined : '支持 :id 占位符、* 通配符；匹配优先级：精确 > 参数 > 通配符'
          }
          hintIcon
        >
          <div className="flex items-stretch gap-2">
            <div className="input-group flex-1">
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
            <CopyButton text={fullUrl} label="已复制完整 URL" />
          </div>
        </FormField>
      </Card>

      <Card title="元数据">
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
      </Card>

      <Card title="响应默认值">
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
