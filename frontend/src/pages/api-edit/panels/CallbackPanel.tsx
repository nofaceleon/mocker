import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, AlertCircle, ExternalLink, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, FormField, Input, Select, Switch } from '@/components/ui';
import type { CallbackConfig, CallbackConditionPreset } from '@/types/api';
import {
  useCallbackConfig,
  useDeleteCallbackConfig,
  useSaveCallbackConfig,
} from '@/hooks/queries/use-callback-config';
import { PanelHeader } from '../PanelHeader';
import { PanelActions } from '../PanelActions';

type CallbackPanelProps = {
  apiId: number | undefined;
  onSave?: () => void;
  saving?: boolean;
};

const DEFAULT_CONFIG: CallbackConfig = {
  isEnabled: false,
  callbackUrl: '',
  callbackMethod: 'POST',
  callbackHeaders: { 'Content-Type': 'application/json' },
  callbackBody: '',
  delayType: 'fixed',
  delayValue: '5000',
  retryEnabled: false,
  maxRetries: 3,
  retryInterval: 5000,
  retryStrategy: 'fixed',
  retryCondition: 'server_error',
  retryConditionExpr: 'statusCode != 200',
};

const RETRY_CONDITION_OPTIONS: { value: CallbackConditionPreset; label: string; hint?: string }[] = [
  { value: 'server_error', label: '服务端错误（status >= 500）' },
  { value: 'always', label: '任何非 2xx 响应' },
  { value: 'success_only', label: '只有 2xx 才不重试' },
  { value: 'custom', label: '自定义表达式' },
];

export function CallbackPanel({ apiId, onSave, saving }: CallbackPanelProps) {
  if (apiId === undefined) {
    return (
      <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
        <PanelHeader
          icon={Send}
          title="延迟回调"
          description="启用后，接口响应后会自动按设定延迟向回调 URL 发送请求。常用于模拟支付、识别等异步通知。"
        />
        <div className="info-tip mt-4">
          <AlertCircle />
          <div>请先在「基本配置」保存接口后再配置回调。</div>
        </div>
      </div>
    );
  }

  const { data: serverCfg, isLoading } = useCallbackConfig(apiId ?? undefined);
  const saveMut = useSaveCallbackConfig(apiId!);
  const deleteMut = useDeleteCallbackConfig(apiId!);

  const initial = useMemo<CallbackConfig>(() => {
    if (serverCfg) return { ...DEFAULT_CONFIG, ...serverCfg };
    return DEFAULT_CONFIG;
  }, [serverCfg]);

  const [draft, setDraft] = useState<CallbackConfig>(initial);
  const [dirty, setDirty] = useState(false);
  const lastSavedRef = useRef<string>(JSON.stringify(initial));

  useEffect(() => {
    setDraft(initial);
    setDirty(false);
    lastSavedRef.current = JSON.stringify(initial);
  }, [initial]);

  const update = (patch: Partial<CallbackConfig>) => {
    setDraft((d) => {
      const next = { ...d, ...patch };
      setDirty(JSON.stringify(next) !== lastSavedRef.current);
      return next;
    });
  };

  const handleSave = async () => {
    await saveMut.mutateAsync(draft);
    lastSavedRef.current = JSON.stringify(draft);
    setDirty(false);
    onSave?.();
  };

  const handleDelete = async () => {
    if (!serverCfg) return;
    if (!confirm('确认删除该接口的回调配置？所有关联的待发送任务会被取消。')) return;
    await deleteMut.mutateAsync();
    setDraft(DEFAULT_CONFIG);
    lastSavedRef.current = JSON.stringify(DEFAULT_CONFIG);
    setDirty(false);
  };

  const serialiseHeaders = (h: Record<string, string>): string =>
    Object.keys(h).length === 0 ? '' : JSON.stringify(h, null, 2);

  const parseHeaders = (raw: string): Record<string, string> => {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      const obj = JSON.parse(trimmed);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(obj)) out[k] = String(v);
        return out;
      }
    } catch {
      // ignore
    }
    return {};
  };

  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Send}
        title="延迟回调"
        action={
          <div className="ml-auto flex items-center gap-3">
            <Link
              to={`/callbacks?apiId=${apiId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-ink-secondary hover:text-ink"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              查看任务
            </Link>
            <span className="text-[11.5px] text-ink-tertiary">{draft.isEnabled ? '已启用' : '未启用'}</span>
            <Switch checked={draft.isEnabled} onChange={(v) => update({ isEnabled: v })} />
          </div>
        }
        description="启用后，接口响应后会自动按设定延迟向回调 URL 发送请求。常用于模拟支付、识别等异步通知。"
      />

      <div className="info-tip">
        <AlertCircle />
        <div>
          <strong>说明</strong>：回调 URL / Headers / Body 中支持 <code>{'{{req.body.xxx}}'}</code> 与{' '}
          <code>{'{{response.xxx}}'}</code> 变量。任务执行日志可在「回调任务」页查看。
        </div>
      </div>

      <Card className="mt-3" title="回调请求">
        <div className="form-row">
          <FormField label="回调 URL" required className="col-span-2">
            <Input
              className="mono"
              value={draft.callbackUrl}
              onChange={(e) => update({ callbackUrl: e.target.value })}
              placeholder="https://example.com/callback 或 {{req.body.callbackUrl}}"
              disabled={!draft.isEnabled}
            />
            <div className="form-helper">
              支持变量替换，例 <code>{'{{req.body.callbackUrl}}'}</code> 或固定 URL
            </div>
          </FormField>
          <FormField label="回调方法">
            <Select
              value={draft.callbackMethod}
              onChange={(e) => update({ callbackMethod: e.target.value as CallbackConfig['callbackMethod'] })}
              disabled={!draft.isEnabled}
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </Select>
          </FormField>
        </div>
        <div className="form-row three-col">
          <FormField label="延迟类型">
            <Select
              value={draft.delayType}
              onChange={(e) => update({ delayType: e.target.value as CallbackConfig['delayType'] })}
              disabled={!draft.isEnabled}
            >
              <option value="fixed">固定</option>
              <option value="random">随机范围</option>
            </Select>
          </FormField>
          <FormField label="延迟时间" hint={draft.delayType === 'random' ? '范围：最小-最大（毫秒）' : '毫秒'}>
            <Input
              value={draft.delayValue}
              onChange={(e) => update({ delayValue: e.target.value })}
              placeholder={draft.delayType === 'random' ? '3000-8000' : '5000'}
              disabled={!draft.isEnabled}
            />
          </FormField>
        </div>
        <FormField label="回调请求头" hint="JSON 对象">
          <textarea
            className="form-textarea mono mono-dark !text-[12.5px]"
            rows={3}
            value={serialiseHeaders(draft.callbackHeaders)}
            onChange={(e) => update({ callbackHeaders: parseHeaders(e.target.value) })}
            disabled={!draft.isEnabled}
            placeholder='{"Content-Type": "application/json"}'
          />
        </FormField>
        <FormField
          label="回调请求体"
          hint="支持 JSON 文本或文本；变量 {{req.body.x}} / {{response.x}} 会被替换"
        >
          <textarea
            className="form-textarea mono mono-dark !text-[12.5px]"
            rows={6}
            value={draft.callbackBody}
            onChange={(e) => update({ callbackBody: e.target.value })}
            disabled={!draft.isEnabled}
            placeholder='{"faceId": "{{req.body.faceId}}", "result": "{{response.data}}"}'
          />
        </FormField>
      </Card>

      <Card className="mt-4" title="重试策略">
        <div className="form-row">
          <FormField label="启用自动重试" className="col-span-2">
            <Switch
              checked={draft.retryEnabled}
              onChange={(v) => update({ retryEnabled: v })}
              disabled={!draft.isEnabled}
            />
          </FormField>
        </div>
        <div className="form-row three-col">
          <FormField label="最大重试次数">
            <Input
              type="number"
              min={0}
              max={10}
              value={draft.maxRetries}
              onChange={(e) => update({ maxRetries: Math.max(0, Number(e.target.value) || 0) })}
              disabled={!draft.isEnabled || !draft.retryEnabled}
            />
          </FormField>
          <FormField label="重试间隔" hint="毫秒">
            <Input
              type="number"
              min={100}
              value={draft.retryInterval}
              onChange={(e) => update({ retryInterval: Math.max(100, Number(e.target.value) || 100) })}
              disabled={!draft.isEnabled || !draft.retryEnabled}
            />
          </FormField>
          <FormField label="间隔策略">
            <Select
              value={draft.retryStrategy}
              onChange={(e) => update({ retryStrategy: e.target.value as CallbackConfig['retryStrategy'] })}
              disabled={!draft.isEnabled || !draft.retryEnabled}
            >
              <option value="fixed">固定间隔</option>
              <option value="exponential">指数退避</option>
            </Select>
          </FormField>
        </div>
        <div className="form-row">
          <FormField
            label="失败条件"
            hint="满足此条件才会触发自动重试"
            className="col-span-2"
          >
            <Select
              value={draft.retryCondition}
              onChange={(e) =>
                update({ retryCondition: e.target.value as CallbackConfig['retryCondition'] })
              }
              disabled={!draft.isEnabled || !draft.retryEnabled}
            >
              {RETRY_CONDITION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        {draft.retryCondition === 'custom' && (
          <div className="form-row">
            <FormField
              label="自定义表达式"
              hint="可用变量：statusCode（HTTP 状态码）"
              className="col-span-2"
            >
              <Input
                className="mono"
                value={draft.retryConditionExpr ?? ''}
                onChange={(e) => update({ retryConditionExpr: e.target.value })}
                disabled={!draft.isEnabled || !draft.retryEnabled}
                placeholder="statusCode != 200"
              />
            </FormField>
          </div>
        )}
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={handleDelete}
          disabled={!serverCfg || deleteMut.isPending}
          className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] text-danger-text transition-colors hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          删除回调配置
        </button>
        <PanelActions
          hint={dirty ? '有未保存的修改' : isLoading ? '加载中…' : '已保存'}
          onSave={handleSave}
          saving={saving || saveMut.isPending}
        />
      </div>
    </div>
  );
}
