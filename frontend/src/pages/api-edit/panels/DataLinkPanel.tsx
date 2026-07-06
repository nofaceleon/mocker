import { Link2 } from 'lucide-react';
import { Card, FormField, Input, Select, Switch } from '@/components/ui';
import type { MockApiPayload } from '@/hooks/queries/use-mock-apis';
import type { DataOp } from '@/types/api';
import { PanelHeader } from '../PanelHeader';
import { PanelActions } from '../PanelActions';

const DATA_OPS: ReadonlyArray<{ value: DataOp; label: string; hint: string }> = [
  { value: 'none', label: '不操作', hint: '暂不联动数据' },
  { value: 'insert', label: 'INSERT（写入）', hint: '以请求 body 作为待插入数据；若表不存在会自动建表' },
  { value: 'select', label: 'SELECT（查询）', hint: '以 path 参数 + where 条件查询，结果回填到响应' },
  { value: 'update', label: 'UPDATE', hint: '以 path 参数 + where 定位，body 作为 patch' },
  { value: 'delete', label: 'DELETE', hint: '以 path 参数 + where 条件作为删除条件' },
];

type DataLinkPanelProps = {
  draft: MockApiPayload;
  onChange: (next: MockApiPayload) => void;
  onSave: () => void;
  saving?: boolean;
};

export function DataLinkPanel({ draft, onChange, onSave, saving }: DataLinkPanelProps) {
  const op = (draft.dataOp ?? 'none') as DataOp;
  const enabled = op !== 'none';

  const hint = DATA_OPS.find((o) => o.value === op)?.hint ?? '';

  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Link2}
        title="数据联动"
        action={
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11.5px] text-ink-tertiary">{enabled ? '已启用' : '未启用'}</span>
            <Switch
              checked={enabled}
              onChange={(v) => onChange({ ...draft, dataOp: v ? 'select' : 'none' })}
            />
          </div>
        }
        description="让接口与业务表打通：可对请求做数据查询、写入、更新、删除，并把结果回填到响应。"
      />

      <Card title="数据源配置">
        <div className="form-row">
          <FormField label="操作类型" hint={hint}>
            <Select
              value={op}
              onChange={(e) => onChange({ ...draft, dataOp: e.target.value as DataOp })}
            >
              {DATA_OPS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="业务表名" hint="字母/数字/下划线，开头不能为数字">
            <Input
              className="mono"
              value={draft.dataTable ?? ''}
              onChange={(e) => onChange({ ...draft, dataTable: e.target.value || null })}
              placeholder="例如 face_data"
              disabled={!enabled}
            />
          </FormField>
        </div>

        <FormField label="where 条件" hint="JSON 格式；path 参数自动注入">
          <textarea
            value={JSON.stringify(draft.dataWhere ?? {}, null, 2)}
            onChange={(e) => {
              try {
                const v = e.target.value.trim() ? JSON.parse(e.target.value) : {};
                onChange({ ...draft, dataWhere: v as Record<string, unknown> });
              } catch {
                /* 暂时吞掉，等待失焦时做格式校验 */
              }
            }}
            rows={4}
            disabled={!enabled}
            className="form-textarea mono mono-dark !text-[12.5px]"
            placeholder='{"status": "active"}'
          />
        </FormField>
      </Card>

      <div className="mt-3 rounded-md border border-line bg-canvas-subtle/40 p-3 text-[11.5px] text-ink-tertiary">
        <b className="text-ink-secondary">提示：</b>
        <ul className="ml-4 mt-1 list-disc space-y-0.5">
          <li>
            <code className="param-code">insert</code>：用请求 body 作为待插入数据；表不存在时按字段自动建表（TEXT 宽容存储）
          </li>
          <li>
            <code className="param-code">select / delete</code>：以 path 参数 + where 条件作为查询条件
          </li>
          <li>
            <code className="param-code">update</code>：以 path 参数 + where 定位，body 作为 patch
          </li>
        </ul>
      </div>

      <PanelActions hint="数据查看请前往「数据管理」" onSave={onSave} saving={saving} />
    </div>
  );
}