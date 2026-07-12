import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Database, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, FormField, Input, Select, Switch } from '@/components/ui';
import type { MockApiPayload } from '@/hooks/queries/use-mock-apis';
import { useBusinessTables, useBusinessTableRows } from '@/hooks/queries/use-data-browser';
import type { DataOp } from '@/types/api';
import { reportFieldError } from '@/lib/form-validation';
import { PanelHeader } from '../PanelHeader';
import { PanelActions } from '../PanelActions';
import { copyToClipboard } from '@/lib/clipboard';

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
  const tableRef = useRef<HTMLInputElement>(null);
  const payloadRef = useRef<HTMLTextAreaElement>(null);
  const whereRef = useRef<HTMLTextAreaElement>(null);

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

    if (tableErr) {
      reportFieldError(tableErr, tableRef.current);
      return;
    }

    const whereResult = needsWhere
      ? tryParseObject(whereText, true)
      : { value: {} as Record<string, unknown>, error: null as string | null };
    const payloadResult = needsPayload
      ? tryParseObject(payloadText, true)
      : { value: null as Record<string, unknown> | null, error: null as string | null };

    if (payloadResult.error) {
      setPayloadErr(payloadResult.error);
      reportFieldError(payloadResult.error, payloadRef.current);
      return;
    }
    if (whereResult.error) {
      setWhereErr(whereResult.error);
      reportFieldError(whereResult.error, whereRef.current);
      return;
    }

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
              ref={tableRef}
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

        {enabled && tableName.trim() && TABLE_NAME_RE.test(tableName.trim()) && (
          <TablePreview tableName={tableName.trim()} />
        )}

        {needsPayload && (
          <FormField
            label="写入字段模板"
            hint="JSON 对象；值支持 {{req.body.x}} / {{req.query.x}} / {{req.path.x}}。留空则插入/更新整包请求 body"
            error={payloadErr ?? parsedPayload.error ?? undefined}
          >
            <div className="space-y-1.5">
              <textarea
                ref={payloadRef}
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
                ref={whereRef}
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

      <PanelActions hint={saveHint} onSave={handleSave} saving={saving} />
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

const RESERVED_COLS = new Set(['id', 'created_at', 'updated_at']);

function TablePreview({ tableName }: { tableName: string }) {
  const { data, isLoading, error } = useBusinessTableRows(tableName, { pageSize: 5 });

  const columns = data?.columns ?? [];
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const notFound = error && !isLoading;

  const userColumns = useMemo(
    () => columns.filter((c) => !RESERVED_COLS.has(c.name)),
    [columns],
  );

  const handleCopyFieldName = (name: string) => {
    copyToClipboard(name).then(() => {
      toast.success(`已复制字段名: ${name}`);
    });
  };

  const handleCopyAllFields = () => {
    if (userColumns.length === 0) return;

    const templateObj = userColumns.reduce(
      (acc, c) => {
        acc[c.name] = `{{req.body.${c.name}}}`;
        return acc;
      },
      {} as Record<string, string>,
    );
    const template = JSON.stringify(templateObj, null, 2);

    copyToClipboard(template).then(() => {
      toast.success('已复制写入模板');
    });
  };

  if (isLoading) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-canvas-subtle/40 px-4 py-3 text-[12px] text-ink-tertiary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        加载表结构中...
      </div>
    );
  }

  if (notFound) {
    return (
      <div
        className="mt-3 flex items-center gap-2 rounded-md border px-4 py-3 text-[12px]"
        style={{ borderColor: '#FEF3C7', backgroundColor: '#FEFCE8', color: '#A16207' }}
      >
        <Database className="h-3.5 w-3.5" />
        表 <b className="font-mono">{tableName}</b> 不存在
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-canvas-subtle/40 px-4 py-3 text-[12px] text-ink-tertiary">
        <Database className="h-3.5 w-3.5" />
        表 <b className="font-mono text-ink-secondary">{tableName}</b> 暂无字段信息
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-line bg-canvas-subtle/40">
      <div className="flex items-center justify-between border-b border-line-subtle px-4 py-2.5">
        <div className="flex items-center gap-2 text-[12px] text-ink-secondary">
          <Database className="h-3.5 w-3.5 text-ink-tertiary" />
          <span className="font-medium">表结构预览</span>
          <span className="text-ink-tertiary">
            · {columns.length} 列 · {total} 条记录
          </span>
        </div>
        {userColumns.length > 0 && (
          <button
            type="button"
            onClick={handleCopyAllFields}
            className="inline-flex items-center gap-1 rounded border border-line bg-white px-2 py-1 text-[11px] text-ink-secondary transition-colors hover:bg-canvas-subtle"
            title="复制写入模板"
          >
            <Copy className="h-3 w-3" />
            复制全部字段名
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-line-subtle px-4 py-2.5">
        {columns.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => handleCopyFieldName(c.name)}
            className="inline-flex items-center gap-1 rounded border border-line bg-white px-1.5 py-0.5 font-mono text-[10.5px] text-ink-secondary transition-colors hover:bg-canvas-subtle hover:border-ink-subtle"
            title={`点击复制字段名: ${c.name}`}
          >
            {c.name}
            <span className="text-ink-subtle">{c.type || '?'}</span>
            {c.pk && <span className="tag tag-orange !text-[9px]">PK</span>}
            {RESERVED_COLS.has(c.name) && (
              <span className="text-[9px] text-ink-subtle">系统</span>
            )}
            <Copy className="h-2.5 w-2.5 text-ink-subtle" />
          </button>
        ))}
      </div>

      {rows.length > 0 && (
        <div className="px-4 py-2.5">
          <div className="mb-2 text-[11px] text-ink-tertiary">
            样本数据 (前 {rows.length} 行)
          </div>
          <div className="overflow-x-auto rounded border border-line bg-white scrollbar-modern">
            <table className="params-table !text-[11px]">
              <thead>
                <tr>
                  {columns.slice(0, 6).map((c) => (
                    <th key={c.name} className="!py-1.5 !text-[10.5px]">
                      <span className="font-mono normal-case tracking-normal">{c.name}</span>
                    </th>
                  ))}
                  {columns.length > 6 && <th className="!py-1.5">...</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-canvas-subtle/50">
                    {columns.slice(0, 6).map((c) => (
                      <td key={c.name} className="max-w-[150px] truncate !py-1.5">
                        {renderPreviewCell(row[c.name])}
                      </td>
                    ))}
                    {columns.length > 6 && <td className="!py-1.5 text-ink-subtle">...</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function renderPreviewCell(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
