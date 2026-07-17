import { Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import type { ResponseCondition } from '@/types/api';
import { ResponseConditionRow } from './ResponseConditionRow';

type ResponseConditionEditorProps = {
  conditions: ResponseCondition[];
  onChange: (next: ResponseCondition[]) => void;
};

export function ResponseConditionEditor({ conditions, onChange }: ResponseConditionEditorProps) {
  const addCondition = () => {
    onChange([...conditions, { source: 'query', field: '', operator: 'equals', value: '' }]);
  };

  const updateCondition = (index: number, next: ResponseCondition) => {
    const updated = [...conditions];
    updated[index] = next;
    onChange(updated);
  };

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {conditions.length === 0 && (
        <div className="text-[12px] text-ink-subtle py-1">
          无条件（仅通过手动选择或作为默认响应使用）
        </div>
      )}
      {conditions.map((cond, index) => (
        <ResponseConditionRow
          key={index}
          condition={cond}
          onChange={(next) => updateCondition(index, next)}
          onRemove={() => removeCondition(index)}
        />
      ))}
      <Button variant="secondary" size="sm" onClick={addCondition} className="w-full mt-1">
        <Plus className="mr-1 h-3 w-3" />
        添加条件
      </Button>
    </div>
  );
}
