import { Send, AlertCircle } from 'lucide-react';
import { Card, FormField, Input, Select, Switch } from '@/components/ui';
import type { MockApiPayload } from '@/hooks/queries/use-mock-apis';
import { PanelHeader } from '../PanelHeader';

type CallbackPanelProps = {
  draft: MockApiPayload;
  onChange: (next: MockApiPayload) => void;
};

export function CallbackPanel({ draft: _draft, onChange: _onChange }: CallbackPanelProps) {
  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Send}
        title="延迟回调"
        action={
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full border border-warning-border bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning-text">
              P1 计划中
            </span>
            <Switch checked={false} onChange={() => undefined} disabled />
          </div>
        }
        description="启用后，接口响应后会自动按设定延迟向回调 URL 发送请求。常用于模拟支付、识别等异步通知。"
      />

      <div className="info-tip dark">
        <AlertCircle />
        <div>
          <strong>当前仅 UI 预览</strong>：本面板不会写入数据库，等待 P1 沙箱与回调调度器实现。
          相关字段（callback_configs / callback_tasks）已在 schema 中预留。
        </div>
      </div>

      <Card className="mt-3 opacity-60 pointer-events-none" title="回调请求">
        <div className="form-row">
          <FormField label="回调 URL" required className="col-span-2">
            <Input className="mono" defaultValue="{{req.body.callbackUrl}}" readOnly />
            <div className="form-helper">
              支持变量替换，例 <code>{'{{req.body.callbackUrl}}'}</code> 或固定 URL
            </div>
          </FormField>
          <FormField label="回调方法">
            <Select defaultValue="POST" disabled>
              <option>POST</option>
              <option>GET</option>
              <option>PUT</option>
              <option>PATCH</option>
            </Select>
          </FormField>
        </div>
        <div className="form-row three-col">
          <FormField label="延迟类型">
            <Select defaultValue="fixed" disabled>
              <option>固定</option>
              <option>随机范围</option>
            </Select>
          </FormField>
          <FormField label="延迟时间" hint="毫秒">
            <Input defaultValue="5000" readOnly />
          </FormField>
          <FormField label="超时" hint="毫秒">
            <Input defaultValue="10000" readOnly />
          </FormField>
        </div>
        <FormField label="回调请求头">
          <textarea
            className="form-textarea mono"
            rows={3}
            readOnly
            defaultValue={`{
  "Content-Type": "application/json",
  "X-Callback-Event": "face.recognized",
  "Authorization": "Bearer mock_token"
}`}
          />
        </FormField>
      </Card>
    </div>
  );
}