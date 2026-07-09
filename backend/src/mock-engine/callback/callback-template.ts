/**
 * 模拟延时回调 / 响应配置 共用的 {{...}} 模板渲染。
 * 既支持 "{{req.body.x}}" / "{{req.query.x}}" 等运行时引用，也支持 "{{response.x}}"（来自上一次渲染结果）。
 *
 * 设计要点：
 *  - 字符串中的整段 {{...}} 会原样替换为对象的引用值；
 *  - 字符串中的片段 {{...}} 会被 stringifyForReplacement 序列化；
 *  - 不存在的路径 → undefined → 片段替换为空，整段保留原样；
 *  - 暴露给回调 URL / Headers / Body 使用。
 */

export type TemplateContext = {
  req?: Record<string, unknown>;
  response?: unknown;
  dbResult?: unknown;
};

const TEMPLATE_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;
const SINGLE_RE = /^\{\{\s*([^{}]+?)\s*\}\}$/;

/** 递归渲染 value（字符串/数组/对象都支持） */
export function renderTemplate(value: unknown, ctx: TemplateContext): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return renderStringTyped(value, ctx);
  if (Array.isArray(value)) return value.map((v) => renderTemplate(v, ctx));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = renderTemplate(v, ctx);
    }
    return out;
  }
  return value;
}

/**
 * 字符串模板替换：
 *  - 整段是单一 `{{...}}` → 返回该路径解析后的原始值（数字/布尔/对象/字符串，保持类型）
 *  - 片段混合字符串 → 每个 `{{...}}` 替换为 stringify 后的字符串
 */
export function renderStringTyped(input: string, ctx: TemplateContext): unknown {
  const single = SINGLE_RE.exec(input);
  if (single) {
    const v = resolvePath(single[1].trim(), ctx);
    return v === undefined ? '' : v;
  }
  return input.replace(TEMPLATE_RE, (_, expr: string) => {
    const v = resolvePath(expr.trim(), ctx);
    return stringifyForReplacement(v);
  });
}

/** 仅在字符串上做模板替换。返回值总是字符串（空串代表解析失败） */
export function renderString(input: string, ctx: TemplateContext): string {
  if (input === '') return '';
  return input.replace(TEMPLATE_RE, (_, expr: string) => {
    const v = resolvePath(expr.trim(), ctx);
    return stringifyForReplacement(v);
  });
}

function stringifyForReplacement(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function resolvePath(path: string, ctx: TemplateContext): unknown {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return undefined;
  let current: unknown = ctx;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const idx = Number(part);
      if (!Number.isInteger(idx)) return undefined;
      current = current[idx];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/** 保持历史 import：`renderSingle` 当整段就是模板时返回解析后的值（否则返回 undefined） */
export function tryResolveSingleTemplate(input: string, ctx: TemplateContext): unknown {
  const m = SINGLE_RE.exec(input);
  if (!m) return undefined;
  return resolvePath(m[1].trim(), ctx);
}
