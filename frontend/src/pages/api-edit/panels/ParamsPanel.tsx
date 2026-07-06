import { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { Card } from '@/components/ui';
import type { MockApiPayload } from '@/hooks/queries/use-mock-apis';
import type { ValidationParamRule } from '@/types/api';
import type { ParamType, ParamLocation } from '@/types/api';
import { PanelHeader } from '../PanelHeader';
import { PanelActions } from '../PanelActions';
import {
  ParamTable,
  TextCell,
  SelectCell,
  CheckCell,
  newParamRow,
  type ParamRow,
} from '../ParamTable';

const LOCATIONS: ParamLocation[] = ['body', 'query', 'path', 'header'];
const TYPES: ParamType[] = ['string', 'number', 'boolean', 'array', 'object'];

type ParamsPanelProps = {
  draft: MockApiPayload;
  onChange: (next: MockApiPayload) => void;
  onSave: (data?: Partial<MockApiPayload>) => void;
  saving?: boolean;
};

function rowsFromRules(rules: ValidationParamRule[]): ParamRow[] {
  return rules.map((r) => ({
    id: `seed_${r.name}_${Math.random().toString(36).slice(2, 7)}`,
    name: r.name,
    type: r.type,
    location: 'body',
    required: Boolean(r.required),
    defaultValue: r.default === undefined ? '' : String(r.default),
    desc: '',
  }));
}

function rulesFromRows(rows: ParamRow[]): ValidationParamRule[] {
  return rows
    .filter((r) => r.name.trim())
    .map((r) => {
      const rule: ValidationParamRule = {
        name: r.name.trim(),
        type: r.type,
      };
      if (r.required) rule.required = true;
      if (r.defaultValue !== '') {
        const parsed = parseDefault(r.defaultValue, r.type);
        if (parsed !== undefined) rule.default = parsed;
      }
      return rule;
    });
}

function parseDefault(raw: string, type: ParamType): unknown {
  if (raw === '') return undefined;
  if (type === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  if (type === 'boolean') {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return undefined;
  }
  if (type === 'object' || type === 'array') {
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  return raw;
}

export function ParamsPanel({ draft, onChange, onSave, saving }: ParamsPanelProps) {
  const rules = draft.validationRules ?? {};
  const bodyRules = rules.body ?? [];
  const [rows, setRows] = useState<ParamRow[]>(() => rowsFromRules(bodyRules));

  useEffect(() => {
    setRows(rowsFromRules(bodyRules));
  }, [JSON.stringify(bodyRules)]);

  const applyToDraft = (next: ParamRow[]) => {
    setRows(next);
    onChange({
      ...draft,
      validationRules: {
        ...(rules ?? {}),
        body: rulesFromRows(next),
      },
    });
  };

  const summary = useMemo(() => {
    const total = rows.length;
    const required = rows.filter((r) => r.required).length;
    return total === 0 ? '' : `共 ${total} 个参数 · 必填 ${required}`;
  }, [rows]);

  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={FileText}
        title="请求参数"
        description="定义接口期望接收的请求字段。每行代表一个参数，自动落入后端参数校验的 body 规则集。"
      />

      <Card
        noBody
        title={
          <>
            参数列表
            {summary && <span className="font-normal text-ink-subtle"> · {summary}</span>}
          </>
        }
      >
        <ParamTable
          rows={rows}
          onChange={applyToDraft}
          newRow={newParamRow}
          importJson
          emptyText="尚未定义参数，点击「添加」开始"
          columns={[
            {
              key: 'name',
              header: '参数名',
              render: (r, idx) => (
                <TextCell
                  value={r.name}
                  onChange={(v) => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, name: v } : x)))}
                  placeholder="name"
                  mono
                />
              ),
            },
            {
              key: 'type',
              header: '类型',
              width: 110,
              render: (r, idx) => (
                <SelectCell
                  value={r.type}
                  options={TYPES}
                  onChange={(v) => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, type: v } : x)))}
                />
              ),
            },
            {
              key: 'location',
              header: '位置',
              width: 100,
              render: (r, idx) => (
                <SelectCell
                  value={r.location}
                  options={LOCATIONS}
                  onChange={(v) => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, location: v } : x)))}
                />
              ),
            },
            {
              key: 'required',
              header: '必填',
              width: 60,
              render: (r, idx) => (
                <CheckCell
                  checked={r.required}
                  onChange={(v) => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, required: v } : x)))}
                />
              ),
            },
            {
              key: 'default',
              header: '默认值',
              width: 130,
              render: (r, idx) => (
                <TextCell
                  value={r.defaultValue}
                  onChange={(v) => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, defaultValue: v } : x)))}
                  placeholder="—"
                  mono={r.type === 'object' || r.type === 'array'}
                />
              ),
            },
            {
              key: 'desc',
              header: '说明',
              render: (r, idx) => (
                <TextCell
                  value={r.desc}
                  onChange={(v) => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, desc: v } : x)))}
                  placeholder="备注"
                />
              ),
            },
          ]}
        />
      </Card>

      <PanelActions hint="修改将实时写入 draft" onSave={onSave} saving={saving} />
    </div>
  );
}