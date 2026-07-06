import { useEffect, useState } from 'react';
import { Send, AlertCircle } from 'lucide-react';
import { Card, FormField, Input, Select, Switch } from '@/components/ui';
import type { MockApiPayload } from '@/hooks/queries/use-mock-apis';
import { PanelHeader } from '../PanelHeader';
import { PanelActions } from '../PanelActions';

type CallbackConfig = {
  isEnabled: boolean;
  callbackUrl: string;
  callbackMethod: string;
  delayType: string;
  delayValue: string;
  callbackHeaders: string;
};

type CallbackPanelProps = {
  draft: MockApiPayload;
  onChange: (next: MockApiPayload) => void;
  onSave: (data?: Partial<MockApiPayload>) => void;
  saving?: boolean;
};

const DEFAULT_CONFIG: CallbackConfig = {
  isEnabled: false,
  callbackUrl: '',
  callbackMethod: 'POST',
  delayType: 'fixed',
  delayValue: '5000',
  callbackHeaders: '{\n  "Content-Type": "application/json"\n}',
};

export function CallbackPanel({ draft, onChange, onSave, saving }: CallbackPanelProps) {
  const [config, setConfig] = useState<CallbackConfig>(() => {
    try {
      const saved = (draft as Record<string, unknown>).callbackConfig;
      return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved as string) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  useEffect(() => {
    try {
      const saved = (draft as Record<string, unknown>).callbackConfig;
      if (saved) {
        setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved as string) });
      }
    } catch {
      // ignore
    }
  }, [draft]);

  const updateConfig = (patch: Partial<CallbackConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    onChange({ ...draft, callbackConfig: JSON.stringify(next) } as Record<string, unknown> as MockApiPayload);
  };

  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Send}
        title="延迟回调"
        action={
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11.5px] text-ink-tertiary">{config.isEnabled ? '已启用' : '未启用'}</span>
            <Switch
              checked={config.isEnabled}
              onChange={(v) => updateConfig({ isEnabled: v })}
            />
          </div>
        }
        description="启用后，接口响应后会自动按设定延迟向回调 URL 发送请求。常用于模拟支付、识别等异步通知。"
      />

      <div className="info-tip">
        <AlertCircle />
        <div>
          <strong>说明</strong>：回调配置会保存到接口中。回调调度功能将在后续版本实现。
        </div>
      </div>

      <Card className="mt-3" title="回调请求">
        <div className="form-row">
          <FormField label="回调 URL" required className="col-span-2">
            <Input
              className="mono"
              value={config.callbackUrl}
              onChange={(e) => updateConfig({ callbackUrl: e.target.value })}
              placeholder="https://example.com/callback 或 {{req.body.callbackUrl}}"
              disabled={!config.isEnabled}
            />
            <div className="form-helper">
              支持变量替换，例 <code>{'{{req.body.callbackUrl}}'}</code> 或固定 URL
            </div>
          </FormField>
          <FormField label="回调方法">
            <Select
              value={config.callbackMethod}
              onChange={(e) => updateConfig({ callbackMethod: e.target.value })}
              disabled={!config.isEnabled}
            >
              <option>POST</option>
              <option>GET</option>
              <option>PUT</option>
              <option>PATCH</option>
            </Select>
          </FormField>
        </div>
        <div className="form-row three-col">
          <FormField label="延迟类型">
            <Select
              value={config.delayType}
              onChange={(e) => updateConfig({ delayType: e.target.value })}
              disabled={!config.isEnabled}
            >
              <option value="fixed">固定</option>
              <option value="random">随机范围</option>
            </Select>
          </FormField>
          <FormField label="延迟时间" hint="毫秒">
            <Input
              type="number"
              value={config.delayValue}
              onChange={(e) => updateConfig({ delayValue: e.target.value })}
              disabled={!config.isEnabled}
            />
          </FormField>
        </div>
        <FormField label="回调请求头" hint="JSON 对象">
          <textarea
            className="form-textarea mono mono-dark !text-[12.5px]"
            rows={3}
            value={config.callbackHeaders}
            onChange={(e) => updateConfig({ callbackHeaders: e.target.value })}
            disabled={!config.isEnabled}
            placeholder='{"Content-Type": "application/json"}'
          />
        </FormField>
      </Card>

      <PanelActions hint="下次请求生效" onSave={onSave} saving={saving} />
    </div>
  );
}