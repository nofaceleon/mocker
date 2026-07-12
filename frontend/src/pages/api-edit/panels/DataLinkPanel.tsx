import { useEffect, useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';
import { Card, FormField, Input, Select, Switch } from '@/components/ui';
import type { MockApiPayload } from '@/hooks/queries/use-mock-apis';
import { useBusinessTables } from '@/hooks/queries/use-data-browser';
import type { DataOp } from '@/types/api';
import { PanelHeader } from '../PanelHeader';
import { PanelActions } from '../PanelActions';

const DATA_OPS: ReadonlyArray<{ value: DataOp; label: string; hint: string }> = [
  { value: 'none', label: '不操作', hint: '暂不联动数据' },
  {
    value: 'insert',
    label: 'INSERT（写入）',
    hint: '按「写入字段模板」映射后插入；模板为空则用整包请求 body',
  },
  { value: 'select', label: 'SELECT（查询）', hint: '以 path 参数 + where 条件查询，结果回填到响应' },
  {
    value: 'update',
    label: 'UPDATE',
    hint: 'where 定位行；patch 可用写入模板或整包 body',
  },
  { value: 'delete', label: 'DELETE', hint: '以 path 参数 + where 条件作为删除条件' },
];

const TABLE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const DEFAULT_INSERT_PAYLOAD = `{
  "name": "{{req.body.name}}",
  "imageUrl": "{{req.body.imageUrl}}"
}`;

type DataLinkPanelProps = {
  formData: MockApiPayload;
  onChange: (next: MockApiPayload) => void;
  onSave: (data?: Partial<MockApiPayload>) => void;
  saving?: boolean;
};

export function DataLinkPanel({ formData, onChange, onSave, saving }: DataLinkPanelProps) {
  const op = (formData.dataOp ?? 'none') as DataOp;
  const enabled = op !== 'none';
  const hint = DATA_OPS.find((o) => o.value === op)?.hint ?? '';
  const { data: businessTables } = useBusinessTables();
  const tableSuggestions = useMemo(
    () => (businessTables ?? []).map((t) => t.name).filter(Boolean),
    [businessTables],
  );

  const [whereText, setWhereText] = useState(() => safeStringify(formData.dataWhere ?? {}));
  const [whereErr, setWhereErr] = useState<string | null>(null);
  const [payloadText, setPayloadText] = useState(() =>
    formData.dataPayload && Object.keys(formData.dataPayload).length > 0
      ? safeStringify(formData.dataPayload)
      : '',
  );
  const [payloadErr, setPayloadErr] = useState<string | null>(null);

  useEffect(() => {
    setWhereText(safeStringify(formData.dataWhere ?? {}));
    setWhereErr(null);
  }, [formData.dataWhere]);

  useEffect(() => {
    if (formData.dataPayload && Object.keys(formData.dataPayload).length > 0) {
      setPayloadText(safeStringify(formData.dataPayload));
    } else {
      setPayloadText('');
    }
    setPayloadErr(null);
  }, [formData.dataPayload]);

  const tableName = formData.dataTable ?? '';
  const tableErr = useMemo(() => {
    if (!enabled) return null;
    if (!tableName.trim()) return '启用数据联动时必须填写业务表名';
    if (!TABLE_NAME_RE.test(tableName.trim())) return '表名仅允许字母/数字/下划线，且不能以数字开头';
    return null;
  }, [enabled, tableName]);

  const parsedWhere = useMemo(() => tryParseObject(whereText, true), [whereText]);
  const parsedPayload = useMemo(() => tryParseObject(payloadText, true), [payloadText]);
  const needsPayload = op === 'insert' || op === 'update';
  const needsWhere = op === 'select' || op === 'update' || op === 'delete';

  const whereEmptyWarning = useMemo(() => {
    if (!enabled || (op !== 'update' && op !== 'delete')) return null;
    if (parsedWhere.error) return null;
    const hasWhereKeys = Object.keys(parsedWhere.value ?? {}).length > 0;
    const hasPathParams = /:\w+/.test(formData.path ?? '');
    if (!hasWhereKeys && !hasPathParams) {
      return `${op === 'update' ? 'UPDATE' : 'DELETE'} 未配置 where，且路径无 :param，运行时可能影响全表`;
    }
    return null;
  }, [enabled, op, parsedWhere, formData.path]);

  const handleWhereChange = (text: string) => {
    setWhereText(text);
    setWhereErr(tryParseObject(text, true).error);
  };

  const handlePayloadChange = (text: string) => {
    setPayloadText(text);
    setPayloadErr(tryParseObject(text, true).error);
  };

  const handleFormatWhere = () => {
    const result = tryParseObject(whereText, true);
    if (result.error) {
      setWhereErr(result.error);
      return;
    }
    setWhereText(JSON.stringify(result.value ?? {}, null, 2));
    setWhereErr(null);
  };

  const handleFormatPayload = () => {
    if (!payloadText.trim()) {
      setPayloadText('');
      setPayloadErr(null);
      return;
    }
    const result = tryParseObject(payloadText, true);
    if (result.error) {
      setPayloadErr(result.error);
      return;
    }
    setPayloadText(JSON.stringify(result.value ?? {}, null, 2));
    setPayloadErr(null);
  };

  const fillPayloadExample = () => {
    setPayloadText(DEFAULT_INSERT_PAYLOAD);
    setPayloadErr(null);
  };

  const handleSave = () => {
    if (!enabled) {
      onSave({ dataOp: 'none' });
      return;
    }

    const whereResult = needsWhere
      ? tryParseObject(whereText, true)
      : { value: {} as Record<string, unknown>, error: null as string | null };
    const payloadResult = needsPayload
      ? tryParseObject(payloadText, true)
      : { value: null as Record<string, unknown> | null, error: null as string | null };

    if (whereResult.error) {
      setWhereErr(whereResult.error);
      return;
    }
    if (payloadResult.error) {
      setPayloadErr(payloadResult.error);
      return;
    }
    if (tableErr) return;

    // 空模板 → null（运行时回退整包 body）
    const dataPayload =
      needsPayload && payloadResult.value && Object.keys(payloadResult.value).length > 0
        ? payloadResult.value
        : null;

    const patch: Partial<MockApiPayload> = {
      dataOp: op,
      dataTable: tableName.trim() || null,
      dataWhere: needsWhere ? whereResult.value ?? {} : {},
      dataPayload,
    };
    onChange({ ...formData, ...patch });
    onSave(patch);
  };

  const jsonBlocked =
    (needsWhere && (!!whereErr || !!parsedWhere.error)) ||
    (needsPayload && (!!payloadErr || !!parsedPayload.error));
  const saveBlocked = enabled && (!!tableErr || jsonBlocked);
  const saveHint = tableErr
    ? tableErr
    : jsonBlocked
      ? '请修正 JSON 后再保存'
      : whereEmptyWarning
        ? whereEmptyWarning
        : '数据查看请前往「数据管理」';

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
              onChange={(v) => onChange({ ...formData, dataOp: v ? 'select' : 'none' })}
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
              onChange={(e) => {
                const next = e.target.value as DataOp;
                onChange({
                  ...formData,
                  dataOp: next,
                  ...(next === 'insert' ? { dataWhere: {} } : {}),
                });
                if (next === 'insert') {
                  setWhereText('{}');
                  setWhereErr(null);
                }
              }}
            >
              {DATA_OPS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="业务表名"
            hint="字母/数字/下划线，开头不能为数字；可从已有表选择"
            error={tableErr ?? undefined}
          >
            <Input
              className="mono"
              list="datalink-table-suggestions"
              value={tableName}
              onChange={(e) => onChange({ ...formData, dataTable: e.target.value || null })}
              placeholder="例如 face_data"
              disabled={!enabled}
              invalid={!!tableErr}
            />
            <datalist id="datalink-table-suggestions">
              {tableSuggestions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </FormField>
        </div>

        {needsPayload && (
          <FormField
            label="写入字段模板"
            hint="JSON 对象；值支持 {{req.body.x}} / {{req.query.x}} / {{req.path.x}}。留空则插入/更新整包请求 body"
            error={payloadErr ?? parsedPayload.error ?? undefined}
          >
            <div className="space-y-1.5">
              <textarea
                value={payloadText}
                onChange={(e) => handlePayloadChange(e.target.value)}
                rows={7}
                disabled={!enabled}
                className={`form-textarea mono mono-dark !text-[12.5px] ${payloadErr || parsedPayload.error ? 'border-danger' : ''}`}
                placeholder={DEFAULT_INSERT_PAYLOAD}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleFormatPayload}
                  disabled={!enabled}
                  className="text-[11.5px] text-ink-tertiary transition-colors hover:text-ink-secondary disabled:opacity-40"
                >
                  格式化
                </button>
                <button
                  type="button"
                  onClick={fillPayloadExample}
                  disabled={!enabled}
                  className="text-[11.5px] text-ink-tertiary transition-colors hover:text-ink-secondary disabled:opacity-40"
                >
                  填入示例
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPayloadText('');
                    setPayloadErr(null);
                  }}
                  disabled={!enabled}
                  className="text-[11.5px] text-ink-tertiary transition-colors hover:text-ink-secondary disabled:opacity-40"
                >
                  清空（用整包 body）
                </button>
              </div>
            </div>
          </FormField>
        )}

        {needsWhere && (
          <FormField
            label="where 条件"
            hint={
              op === 'update'
                ? '定位要更新的行；path 参数（如 :id）会自动并入'
                : op === 'delete'
                  ? '删除条件；path 参数会自动并入'
                  : '查询条件；path 参数会自动并入。留空则仅用 path 参数'
            }
            error={whereErr ?? parsedWhere.error ?? undefined}
          >
            <div className="space-y-1.5">
              <textarea
                value={whereText}
                onChange={(e) => handleWhereChange(e.target.value)}
                rows={4}
                disabled={!enabled}
                className={`form-textarea mono mono-dark !text-[12.5px] ${whereErr || parsedWhere.error ? 'border-danger' : ''}`}
                placeholder='{"status": "active"}'
              />
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleFormatWhere}
                  disabled={!enabled}
                  className="text-[11.5px] text-ink-tertiary transition-colors hover:text-ink-secondary disabled:opacity-40"
                >
                  格式化
                </button>
                {whereEmptyWarning && (
                  <span className="text-[11.5px] text-warning">{whereEmptyWarning}</span>
                )}
              </div>
            </div>
          </FormField>
        )}
      </Card>

      <div className="mt-3 rounded-md border border-line bg-canvas-subtle/40 p-3 text-[11.5px] text-ink-tertiary">
        <b className="text-ink-secondary">提示：</b>
        <ul className="ml-4 mt-1 list-disc space-y-0.5">
          <li>
            <code className="param-code">insert</code>：配置写入字段模板映射列；表不存在时按模板字段自动建表
          </li>
          <li>
            模板示例：
            <code className="param-code">{`{ "name": "{{req.body.name}}", "faceId": "face_{{req.body.requestId}}" }`}</code>
          </li>
          <li>
            <code className="param-code">update</code>：where 定位行，写入模板（或 body）作为 patch
          </li>
          <li>
            结果在「响应配置」用 <code className="param-code">{'{{dbResult}}'}</code> 回填
          </li>
        </ul>
      </div>

      <PanelActions hint={saveHint} onSave={handleSave} saving={saving} disabled={saveBlocked} />
    </div>
  );
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return '{}';
  }
}

/** 空字符串 → null（表示未配置）；{} → 空对象 */
function tryParseObject(
  text: string,
  allowEmpty: boolean,
): { value: Record<string, unknown> | null; error: string | null } {
  if (!text.trim()) {
    return allowEmpty ? { value: null, error: null } : { value: {}, error: null };
  }
  try {
    const v = JSON.parse(text) as unknown;
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      return { value: null, error: '必须是 JSON 对象' };
    }
    return { value: v as Record<string, unknown>, error: null };
  } catch (e) {
    return { value: null, error: e instanceof Error ? e.message : 'JSON 格式错误' };
  }
}
