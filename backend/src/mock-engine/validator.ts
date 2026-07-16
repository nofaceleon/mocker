import { z, type ZodTypeAny } from 'zod';
import type { ParamRule, ValidationRules } from '../db/schema.js';

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: ValidationError[] };

export type ValidationError = {
  location: 'query' | 'body' | 'path' | 'header';
  field: string;
  rule: string;
  message: string;
};

/**
 * 根据 rules 校验入参。
 * 入参 ctx 应是 extractContext 的输出。
 *
 * 行为说明：
 * - query / path / header 在 HTTP 中永远是字符串，对 number / boolean 做宽松 coerce
 * - body 同样接受数字字符串（表单 / 部分客户端会把 number 当 string 传）
 * - 缺省值（undefined / null / 非 string 的空串）会填入 rule.default，并写回 ctx
 * - 校验成功后的 coerce 结果也会写回 ctx，供模板 / dataOp 使用
 */
export function validate(rules: ValidationRules, ctx: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];

  validateLocation('query', rules.query, ctx.query, errors);
  validateLocation('body', rules.body, ctx.body, errors);
  validateLocation('path', rules.path, ctx.path, errors);
  validateLocation('header', rules.header, ctx.headers, errors);

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function validateLocation(
  location: ValidationError['location'],
  ruleList: ParamRule[] | undefined,
  value: unknown,
  errors: ValidationError[],
): void {
  if (!ruleList || ruleList.length === 0) return;

  const data =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  for (const rule of ruleList) {
    // mock 引擎 request.ts 的 normalizeKeys 把所有 key 转成了 camelCase，
    // 所以校验时也要尝试 camelCase 版本的 key 才能匹配上
    const camelKey = toCamel(rule.name);
    let fieldValue = data[rule.name] ?? data[camelKey];

    // 非 string 类型把空串视作「未传」，避免 query 里 page="" 被 coerce 成 0
    if (fieldValue === '' && rule.type !== 'string') {
      fieldValue = undefined;
    }

    if ((fieldValue === undefined || fieldValue === null) && rule.default !== undefined) {
      fieldValue = rule.default;
    }

    const result = buildSchema(rule).safeParse(fieldValue);
    if (!result.success) {
      errors.push({
        location,
        field: rule.name,
        rule: rule.type + (rule.required ? '!' : '?'),
        message: result.error.issues[0]?.message ?? 'invalid',
      });
      continue;
    }

    // 写回 default / coerce 后的值，让模板与 dataOp 拿到正确类型
    if (result.data !== undefined) {
      data[camelKey] = result.data;
      if (rule.name !== camelKey) data[rule.name] = result.data;
    }
  }
}

function toCamel(s: string): string {
  return s.replace(/[-_]([a-zA-Z0-9])/g, (_match, c: string) => c.toUpperCase());
}

/** 把 query/path/header 常见的字符串值转成 number；无法转换则原样返回 */
function coerceNumber(v: unknown): unknown {
  if (v === undefined || v === null || v === '') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return v;
    const n = Number(t);
    return Number.isFinite(n) ? n : v;
  }
  return v;
}

/** 接受 true/false/1/0/"true"/"false"/"1"/"0" */
function coerceBoolean(v: unknown): unknown {
  if (v === undefined || v === null || v === '') return v;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') {
    if (v === 1) return true;
    if (v === 0) return false;
    return v;
  }
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (t === 'true' || t === '1') return true;
    if (t === 'false' || t === '0') return false;
  }
  return v;
}

function buildSchema(rule: ParamRule): ZodTypeAny {
  let schema: ZodTypeAny;

  switch (rule.type) {
    case 'string': {
      let s = z.string();
      if (rule.min !== undefined) s = s.min(rule.min);
      if (rule.max !== undefined) s = s.max(rule.max);
      if (rule.pattern) s = s.regex(new RegExp(rule.pattern));
      schema = s;
      break;
    }
    case 'number': {
      let n = z.number();
      if (rule.min !== undefined) n = n.min(rule.min);
      if (rule.max !== undefined) n = n.max(rule.max);
      // query/path/header 永远是字符串；body 也常见数字字符串
      schema = z.preprocess(coerceNumber, n);
      break;
    }
    case 'boolean':
      schema = z.preprocess(coerceBoolean, z.boolean());
      break;
    case 'array':
      schema = z.array(z.unknown());
      break;
    case 'object':
      schema = z.object({}).passthrough();
      break;
    default:
      schema = z.unknown();
  }

  if (rule.enum && rule.enum.length > 0) {
    const allowed = rule.enum;
    schema = schema.refine(
      (v: unknown) => {
        if (v === undefined || v === null) return true;
        // 宽松比较：enum 里写 1 也能匹配 query 字符串 "1" coerce 后的 1
        return allowed.some((a) => a === v || String(a) === String(v));
      },
      { message: `must be one of ${JSON.stringify(allowed)}` },
    );
  }

  if (!rule.required) {
    schema = schema.optional().nullable();
  } else {
    schema = schema.refine((v) => v !== undefined && v !== null, {
      message: 'required',
    });
  }

  return schema;
}

/** 构造校验失败的响应体 */
export function buildFailResponse(
  rules: ValidationRules,
  errors: ValidationError[],
): { status: number; body: unknown } {
  const status = rules.failStatus ?? 400;
  const message = rules.failMessage ?? '参数校验失败';
  return {
    status,
    body: {
      code: 'VALIDATION_ERROR',
      message,
      errors,
    },
  };
}
