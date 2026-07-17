import { useState, type ReactNode } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Select } from '@/components/ui';
import { CodeEditor } from '@/components/CodeEditor';
import { cn } from '@/lib/cn';
import { JsonImportModal } from './JsonImportModal';

export type ParamLocation = 'query' | 'body' | 'path' | 'header';
export type ParamType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export type ParamRow = {
  id: string;
  name: string;
  type: ParamType;
  location: ParamLocation;
  required: boolean;
  defaultValue: string;
  desc: string;
};

export type Column<R> = {
  key: string;
  header: ReactNode;
  width?: number | string;
  className?: string;
  render: (row: R, idx: number) => ReactNode;
};

type ParamTableProps<R> = {
  rows: R[];
  onChange: (next: R[]) => void;
  columns: Column<R>[];
  emptyText?: ReactNode;
  importJson?: boolean;
  onImportJson?: (raw: string) => R[];
  newRow?: () => R;
};

let _idCounter = 0;
const newRowId = () => {
  _idCounter += 1;
  return `r_${Date.now().toString(36)}_${_idCounter}`;
};

export function newParamRow(): ParamRow {
  return {
    id: newRowId(),
    name: '',
    type: 'string',
    location: 'body',
    required: false,
    defaultValue: '',
    desc: '',
  };
}

const defaultParamImport = (raw: string): ParamRow[] => {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('必须是数组');
  return parsed.map((it: Record<string, unknown>) => ({
    id: newRowId(),
    name: String(it.name ?? ''),
    type: (it.type as ParamType) ?? 'string',
    location: (it.location as ParamLocation) ?? 'body',
    required: Boolean(it.required ?? false),
    defaultValue: it.default === undefined ? '' : String(it.default),
    desc: String(it.desc ?? it.description ?? ''),
  }));
};

export function ParamTable<R extends { id: string }>({
  rows,
  onChange,
  columns,
  emptyText = '暂无数据，点击「添加」开始',
  importJson = false,
  onImportJson,
  newRow,
}: ParamTableProps<R>) {
  const [importOpen, setImportOpen] = useState(false);
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const add = () => {
    const next = (newRow ?? (newParamRow as unknown as () => R))();
    onChange([...rows, next]);
  };
  const handleImport = (raw: string) => {
    try {
      const appended = onImportJson
        ? onImportJson(raw)
        : (defaultParamImport(raw) as unknown as R[]);
      onChange([...rows, ...appended]);
    } catch (err) {
      toast.error('解析失败：' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  if (rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-[12.5px] text-ink-subtle">
        {emptyText}
        <div className="mt-3 flex items-center justify-center gap-2">
          {importJson && (
            <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
              <Plus className="h-3 w-3" />
              导入 JSON
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={add}>
            <Plus className="h-3 w-3" />
            添加
          </Button>
        </div>
        <JsonImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImport={handleImport}
        />
      </div>
    );
  }

  return (
    <>
      <table className="params-table">
        <thead>
          <tr>
            <th style={{ width: 18 }} />
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width }}>
                {c.header}
              </th>
            ))}
            <th style={{ width: 36 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.id}>
              <td className="cursor-grab select-none text-ink-disabled">⋮⋮</td>
              {columns.map((c) => (
                <td key={c.key} className={cn(c.className)}>
                  {c.render(r, idx)}
                </td>
              ))}
              <td>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="grid h-5 w-5 place-items-center rounded text-ink-subtle transition-colors hover:bg-canvas-subtle hover:text-danger"
                  title="删除"
                >
                  <X className="h-3 w-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-line-subtle bg-canvas-subtle/40 px-3 py-2">
        <span className="text-[11.5px] text-ink-tertiary">共 {rows.length} 行</span>
        <div className="flex items-center gap-2">
          {importJson && (
            <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
              <Plus className="h-3 w-3" />
              导入 JSON
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={add}>
            <Plus className="h-3 w-3" />
            添加
          </Button>
        </div>
      </div>
      <JsonImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />
    </>
  );
}

type TextCellProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  className?: string;
};

export function TextCell({ value, onChange, placeholder, mono, className }: TextCellProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn('table-input', mono && 'mono', className)}
    />
  );
}

type SelectCellProps<T extends string> = {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<T>;
  className?: string;
};

export function SelectCell<T extends string>({
  value,
  onChange,
  options,
  className,
}: SelectCellProps<T>) {
  return (
    <Select
      compact
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn('min-w-0', className)}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </Select>
  );
}

type CheckCellProps = {
  checked: boolean;
  onChange: (v: boolean) => void;
};

export function CheckCell({ checked, onChange }: CheckCellProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-3.5 w-3.5 cursor-pointer rounded accent-ink"
    />
  );
}

type JsonFieldProps = {
  value: unknown;
  onChange: (v: unknown) => void;
  rows?: number;
  placeholder?: string;
  language?: string;
  className?: string;
};

export function JsonField({ value, onChange, rows = 5, language, className }: JsonFieldProps) {
  const [text, setText] = useState(() => safeStringify(value));
  const [err, setErr] = useState<string | null>(null);

  const apply = () => {
    if (!text.trim()) {
      onChange(null);
      setErr(null);
      return;
    }
    try {
      onChange(JSON.parse(text));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'JSON 解析失败');
    }
  };

  const format = () => {
    try {
      setText(JSON.stringify(JSON.parse(text), null, 2));
      setErr(null);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {language && (
        <div className="flex items-center justify-between text-[11px] text-ink-subtle">
          <span className="rounded bg-canvas-subtle px-1.5 py-0.5 font-mono">{language}</span>
          <span>修改后点「应用」保存</span>
        </div>
      )}
      <CodeEditor
        language={language === 'javascript' || language === 'js' ? 'javascript' : 'json'}
        value={text}
        onChange={setText}
        rows={rows}
        invalid={!!err}
      />
      {err && <div className="text-[11px] text-danger">{err}</div>}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={format}>
          格式化
        </Button>
        <Button size="sm" variant="secondary" onClick={apply}>
          <Check className="h-3 w-3" />
          应用
        </Button>
      </div>
    </div>
  );
}

function safeStringify(v: unknown): string {
  if (v === null || v === undefined) return '';
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

type CurlPreviewProps = {
  method: string;
  baseUrl: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export function buildCurl({ method, baseUrl, path, headers, body }: CurlPreviewProps): string {
  const parts: string[] = [
    `curl -X ${method.toUpperCase()} '${baseUrl.replace(/\/$/, '')}${path}'`,
  ];
  if (headers) {
    Object.entries(headers).forEach(([k, v]) => {
      parts.push(`  -H '${escapeShell(k)}: ${escapeShell(v)}'`);
    });
  }
  if (body !== undefined && body !== null) {
    parts.push(`  -d '${escapeShell(JSON.stringify(body))}'`);
  }
  return parts.join(' \\\n');
}

function escapeShell(s: string): string {
  return s.replace(/'/g, "'\\''");
}
