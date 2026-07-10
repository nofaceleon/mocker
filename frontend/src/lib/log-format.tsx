import { useMemo } from 'react';
import { cn } from '@/lib/cn';

// ---------- Header 列表 ----------
// 兜底：历史上后端 json 字段被双重序列化时，前端会拿到一个 JSON 字符串
// 这里尝试 parse；解析失败或结果不是对象时按空数据处理，避免逐字符展开
export function HeadersBlock({
  headers,
  emptyHint,
}: {
  headers: Record<string, string> | null;
  emptyHint?: string;
}) {
  const entries = useMemo(() => {
    if (headers == null) return [] as Array<[string, string]>;
    if (typeof headers === 'string') {
      try {
        const parsed = JSON.parse(headers);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return Object.entries(parsed as Record<string, unknown>).map(
            ([k, v]) => [k, String(v)] as [string, string],
          );
        }
      } catch {
        // 解析失败 —— 视为空数据
      }
      return [];
    }
    return Object.entries(headers);
  }, [headers]);
  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line bg-canvas-subtle/40 px-3 py-3 text-center text-[12px] text-ink-subtle">
        {emptyHint ?? '暂无数据'}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-line bg-elevated">
      {entries.map(([k, v], i) => (
        <div
          key={k}
          className={cn(
            'grid grid-cols-[minmax(0,140px)_1fr] gap-3 px-3 py-1.5 text-[12px]',
            i !== 0 && 'border-t border-line',
          )}
        >
          <span className="truncate font-mono text-ink-tertiary" title={k}>
            {k}
          </span>
          <span
            className="break-all font-mono text-ink-secondary"
            title={String(v)}
          >
            {String(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------- JSON 字段展示 ----------
// 兼容两种输入：对象/数组 或 字符串（已经序列化好的 JSON）。
// 对字符串尝试一次 JSON.parse：成功且结果为对象/数组就当格式化展示；否则按原文返回
function normalizeJson(v: unknown): unknown {
  if (v == null) return null;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (!trimmed) return null;
    if (trimmed === 'undefined' || trimmed === 'null') return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      /* keep as string */
    }
    return v;
  }
  return v;
}

function isJsonEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '' || v.trim() === 'undefined';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v as object).length === 0;
  return false;
}

// 简易 JSON 语法高亮：给字符串/数字/键/标点加 span，依赖 .code-content .key/.str/.num/.kw/.brkt
// 这里用 React 元素而非 dangerouslySetInnerHTML，避免 XSS 与解析开销
function highlight(value: unknown): Array<{ kind: string; text: string }> {
  if (value == null) return [];
  const source = JSON.stringify(value, null, 2);
  const tokens: Array<{ kind: string; text: string }> = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\b(?:true|false|null)\b)|([{}\[\],])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (m.index > last) tokens.push({ kind: 'plain', text: source.slice(last, m.index) });
    if (m[1] !== undefined) {
      tokens.push({ kind: m[2] ? 'key' : 'str', text: m[1] + (m[2] ?? '') });
    } else if (m[3] !== undefined) {
      tokens.push({ kind: 'num', text: m[3] });
    } else if (m[4] !== undefined) {
      tokens.push({ kind: 'kw', text: m[4] });
    } else if (m[5] !== undefined) {
      tokens.push({ kind: 'brkt', text: m[5] });
    }
    last = re.lastIndex;
  }
  if (last < source.length) tokens.push({ kind: 'plain', text: source.slice(last) });
  return tokens;
}

function JsonView({ value }: { value: object }) {
  const tokens = useMemo(() => highlight(value), [value]);
  if (tokens.length === 0) return null;
  return (
    <div className="code-content !max-h-72 !overflow-auto !rounded-md !p-3 !text-[12px]">
      {tokens.map((t, i) => {
        if (t.kind === 'plain') return <span key={i}>{t.text}</span>;
        return <span key={i} className={t.kind}>{t.text}</span>;
      })}
    </div>
  );
}

export function JsonField({
  label,
  value,
  placeholder,
}: {
  label: string;
  value: unknown;
  placeholder?: string;
}) {
  const normalized = useMemo(() => normalizeJson(value), [value]);
  if (isJsonEmpty(normalized)) {
    return (
      <div>
        <h5 className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-disabled">
          {label}
        </h5>
        <div className="rounded-md border border-dashed border-line bg-canvas-subtle/40 px-3 py-3 text-center text-[12px] text-ink-subtle">
          {placeholder ?? '无内容'}
        </div>
      </div>
    );
  }
  // 字符串兜底：parse 后仍是字符串（如响应原文）—— 不加 JSON.stringify 引号
  if (typeof normalized === 'string') {
    return (
      <div>
        <h5 className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-disabled">
          {label}
        </h5>
        <pre className="code-content !max-h-72 !overflow-auto !whitespace-pre-wrap !rounded-md !p-3 !text-[12px]">
          {normalized}
        </pre>
      </div>
    );
  }
  return (
    <div>
      <h5 className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-disabled">
        {label}
      </h5>
      <JsonView value={normalized as object} />
    </div>
  );
}
