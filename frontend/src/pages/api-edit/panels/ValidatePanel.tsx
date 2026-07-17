import { useEffect, useRef, useState } from 'react';
import { Shield } from 'lucide-react';
import { Card, FormField, Input, Select, Switch, Button } from '@/components/ui';
import type { MockApiPayload } from '@/hooks/queries/use-mock-apis';
import type { ValidationParamRule, ParamType } from '@/types/api';
import { PanelHeader } from '../PanelHeader';
import { PanelActions } from '../PanelActions';
import { ParamTable, TextCell, SelectCell } from '../ParamTable';

const RULE_OPTIONS = [
  { value: 'required', label: '必填' },
  { value: 'string', label: '类型：string' },
  { value: 'number', label: '类型：number' },
  { value: 'boolean', label: '类型：boolean' },
  { value: 'minLen', label: '长度 ≥ N' },
  { value: 'maxLen', label: '长度 ≤ N' },
  { value: 'min', label: '数值 ≥ N' },
  { value: 'max', label: '数值 ≤ N' },
  { value: 'pattern', label: '正则匹配' },
  { value: 'enum', label: '枚举值' },
] as const;

type RuleKind = (typeof RULE_OPTIONS)[number]['value'];

type ValidateRow = {
  id: string;
  name: string;
  type: ParamType;
  required: boolean;
  rule: RuleKind;
  ruleValue: string;
  errCode: string;
  errMessage: string;
};

let _vCounter = 0;
const newVid = () => `v_${Date.now().toString(36)}_${++_vCounter}`;

function newValidateRow(): ValidateRow {
  return {
    id: newVid(),
    name: '',
    type: 'string',
    required: true,
    rule: 'required',
    ruleValue: '',
    errCode: '400',
    errMessage: '',
  };
}

function rulesToRows(rules: ValidationParamRule[]): ValidateRow[] {
  return rules.map((r) => {
    let kind: RuleKind = 'string';
    let ruleValue = '';
    if (r.required) kind = 'required';
    else if (r.pattern) {
      kind = 'pattern';
      ruleValue = r.pattern;
    } else if (r.enum) {
      kind = 'enum';
      ruleValue = r.enum.map(String).join(',');
    } else if (typeof r.min === 'number') {
      kind = 'min';
      ruleValue = String(r.min);
    } else if (typeof r.max === 'number') {
      kind = 'max';
      ruleValue = String(r.max);
    } else if (r.type === 'number') {
      kind = 'number';
    } else if (r.type === 'boolean') {
      kind = 'boolean';
    }
    return {
      id: newVid(),
      name: r.name,
      type: r.type,
      required: Boolean(r.required),
      rule: kind,
      ruleValue,
      errCode: '400',
      errMessage: `${r.name} 校验未通过`,
    };
  });
}

function rowsToRules(rows: ValidateRow[]): ValidationParamRule[] {
  return rows
    .filter((r) => r.name.trim())
    .map((r) => {
      const rule: ValidationParamRule = { name: r.name.trim(), type: r.type };
      if (r.required || r.rule === 'required') rule.required = true;
      if (r.rule === 'pattern' && r.ruleValue.trim()) rule.pattern = r.ruleValue.trim();
      if (r.rule === 'enum' && r.ruleValue.trim()) {
        rule.enum = r.ruleValue
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (r.rule === 'min') {
        const n = Number(r.ruleValue);
        if (Number.isFinite(n)) rule.min = n;
      }
      if (r.rule === 'max') {
        const n = Number(r.ruleValue);
        if (Number.isFinite(n)) rule.max = n;
      }
      return rule;
    });
}

const STATUS_FAIL = [
  { value: 400, label: '400 Bad Request' },
  { value: 422, label: '422 Unprocessable' },
  { value: 500, label: '500 Server Error' },
];

type ValidatePanelProps = {
  formData: MockApiPayload;
  onChange: (next: MockApiPayload) => void;
  onSave: (data?: Partial<MockApiPayload>) => void;
  saving?: boolean;
};

export function ValidatePanel({ formData, onChange, onSave, saving }: ValidatePanelProps) {
  const rules = formData.validationRules ?? {};
  const bodyRules = rules.body ?? [];
  const [rows, setRows] = useState<ValidateRow[]>(() => rulesToRows(bodyRules));
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    setRows(rulesToRows(bodyRules));
  }, [JSON.stringify(bodyRules)]);

  const applyToFormData = (next: ValidateRow[]) => {
    setRows(next);
    onChange({
      ...formData,
      validationRules: {
        ...rules,
        body: rowsToRules(next),
      },
    });
  };

  const updateRow = (updater: (rs: ValidateRow[]) => ValidateRow[]) => {
    isInternalUpdate.current = true;
    applyToFormData(updater(rows));
  };

  const failStatus = rules.failStatus ?? 400;
  const failMessage = rules.failMessage ?? '参数校验失败';

  const setFail = (patch: Partial<{ failStatus: number; failMessage: string }>) => {
    onChange({
      ...formData,
      validationRules: {
        ...rules,
        ...(patch.failStatus !== undefined ? { failStatus: patch.failStatus } : {}),
        ...(patch.failMessage !== undefined ? { failMessage: patch.failMessage } : {}),
      },
    });
  };

  const enabled = rules.isEnabled !== false;
  const hasRules = rows.length > 0;
  const summary = !enabled
    ? `已禁用 · ${rows.length} 条规则`
    : hasRules
      ? `${rows.length} 条规则 · 失败返 ${failStatus}`
      : '暂未配置规则';

  const ruleOptions = RULE_OPTIONS.map((o) => o.value);

  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Shield}
        title="参数校验"
        description="为请求参数配置校验规则。校验失败时返回自定义错误响应：状态码、错误信息。"
        action={
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11.5px] text-ink-tertiary">{summary}</span>
            <Switch
              checked={enabled}
              onChange={(v) =>
                onChange({
                  ...formData,
                  validationRules: { ...rules, isEnabled: v },
                })
              }
            />
          </div>
        }
      />

      <Card
        noBody
        title={
          <>
            校验规则
            {enabled && <span className="font-normal text-ink-subtle"> · {rows.length} 条</span>}
          </>
        }
      >
        <ParamTable<ValidateRow>
          rows={rows}
          onChange={applyToFormData}
          newRow={newValidateRow}
          emptyText="尚未配置校验规则，点击「添加」开始"
          columns={[
            {
              key: 'name',
              header: '参数',
              width: 160,
              render: (r, idx) => (
                <TextCell
                  value={r.name}
                  onChange={(v) =>
                    updateRow((rs) => rs.map((x, i) => (i === idx ? { ...x, name: v } : x)))
                  }
                  placeholder="name"
                  mono
                />
              ),
            },
            {
              key: 'rule',
              header: '规则',
              width: 180,
              render: (r, idx) => (
                <SelectCell
                  value={r.rule}
                  options={ruleOptions}
                  onChange={(v) =>
                    updateRow((rs) =>
                      rs.map((x, i) => (i === idx ? { ...x, rule: v as RuleKind } : x)),
                    )
                  }
                />
              ),
            },
            {
              key: 'ruleValue',
              header: '规则参数',
              width: 160,
              render: (r, idx) => {
                if (
                  r.rule === 'required' ||
                  r.rule === 'string' ||
                  r.rule === 'number' ||
                  r.rule === 'boolean'
                ) {
                  return <span className="text-[11px] text-ink-subtle">无需参数</span>;
                }
                const placeholder =
                  r.rule === 'enum'
                    ? 'v1,v2,v3'
                    : r.rule === 'pattern'
                      ? '^https://'
                      : r.rule === 'min' ||
                          r.rule === 'max' ||
                          r.rule === 'minLen' ||
                          r.rule === 'maxLen'
                        ? 'N'
                        : '';
                return (
                  <TextCell
                    value={r.ruleValue}
                    onChange={(v) =>
                      updateRow((rs) => rs.map((x, i) => (i === idx ? { ...x, ruleValue: v } : x)))
                    }
                    placeholder={placeholder}
                    mono
                  />
                );
              },
            },
            {
              key: 'code',
              header: '错误码',
              width: 80,
              render: (r, idx) => (
                <TextCell
                  value={r.errCode}
                  onChange={(v) =>
                    updateRow((rs) => rs.map((x, i) => (i === idx ? { ...x, errCode: v } : x)))
                  }
                  mono
                />
              ),
            },
            {
              key: 'msg',
              header: '错误信息',
              render: (r, idx) => (
                <TextCell
                  value={r.errMessage}
                  onChange={(v) =>
                    updateRow((rs) => rs.map((x, i) => (i === idx ? { ...x, errMessage: v } : x)))
                  }
                  placeholder="参数 name 校验失败"
                />
              ),
            },
          ]}
        />
      </Card>

      <Card title="校验失败时的默认响应" className="mt-3">
        <div className="form-row">
          <FormField label="HTTP 状态码">
            <Select
              value={failStatus}
              onChange={(e) => setFail({ failStatus: Number(e.target.value) })}
            >
              {STATUS_FAIL.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="业务错误信息">
            <Input
              className="mono"
              value={failMessage}
              onChange={(e) => setFail({ failMessage: e.target.value })}
              maxLength={500}
            />
          </FormField>
        </div>
      </Card>

      <PanelActions
        hint="启用后立即对请求生效（保存后）"
        onSave={onSave}
        saving={saving}
        right={
          <Button variant="primary" onClick={() => onSave?.()} loading={saving}>
            保存
          </Button>
        }
      />
    </div>
  );
}
