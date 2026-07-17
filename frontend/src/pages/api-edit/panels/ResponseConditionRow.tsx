import { Trash2 } from 'lucide-react';
import { Input, Select, Button } from '@/components/ui';
import type { ResponseCondition, ResponseConditionSource, ResponseOperator } from '@/types/api';

const SOURCE_OPTIONS: { value: ResponseConditionSource; label: string }[] = [
  { value: 'query', label: 'Query' },
  { value: 'body', label: 'Body' },
  { value: 'header', label: 'Header' },
  { value: 'path', label: 'Path' },
];

const OPERATOR_OPTIONS: { value: ResponseOperator; label: string }[] = [
  { value: 'equals', label: '等于' },
  { value: 'not_equals', label: '不等于' },
  { value: 'contains', label: '包含' },
  { value: 'gt', label: '大于' },
  { value: 'lt', label: '小于' },
  { value: 'gte', label: '大于等于' },
  { value: 'lte', label: '小于等于' },
  { value: 'regex', label: '正则匹配' },
];

type ResponseConditionRowProps = {
  condition: ResponseCondition;
  onChange: (next: ResponseCondition) => void;
  onRemove: () => void;
};

export function ResponseConditionRow({ condition, onChange, onRemove }: ResponseConditionRowProps) {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={condition.source}
        onChange={(e) =>
          onChange({ ...condition, source: e.target.value as ResponseConditionSource })
        }
        className="w-[100px] flex-shrink-0"
      >
        {SOURCE_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>
      <Input
        value={condition.field}
        onChange={(e) => onChange({ ...condition, field: e.target.value })}
        placeholder="字段名"
        className="flex-1 min-w-0"
      />
      <Select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value as ResponseOperator })}
        className="w-[110px] flex-shrink-0"
      >
        {OPERATOR_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <Input
        value={condition.value}
        onChange={(e) => onChange({ ...condition, value: e.target.value })}
        placeholder="期望值"
        className="flex-1 min-w-0"
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="text-danger hover:text-danger flex-shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
