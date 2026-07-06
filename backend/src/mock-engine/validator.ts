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

  const data = (value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {});

  for (const rule of ruleList) {
    const fieldValue = data[rule.name];
    const result = buildSchema(rule).safeParse(fieldValue);
    if (!result.success) {
      errors.push({
        location,
        field: rule.name,
        rule: rule.type + (rule.required ? '!' : '?'),
        message: result.error.issues[0]?.message ?? 'invalid',
      });
    }
  }
}

function buildSchema(rule: ParamRule): ZodTypeAny {
  let schema: ZodTypeAny;

  switch (rule.type) {
    case 'string':
      schema = z.string();
      break;
    case 'number':
      schema = z.number();
      break;
    case 'boolean':
      schema = z.boolean();
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

  if (rule.type === 'string') {
    let s = schema as z.ZodString;
    if (rule.min !== undefined) s = s.min(rule.min);
    if (rule.max !== undefined) s = s.max(rule.max);
    if (rule.pattern) s = s.regex(new RegExp(rule.pattern));
    schema = s;
  }

  if (rule.type === 'number') {
    let n = schema as z.ZodNumber;
    if (rule.min !== undefined) n = n.min(rule.min);
    if (rule.max !== undefined) n = n.max(rule.max);
    schema = n;
  }

  if (rule.enum && rule.enum.length > 0) {
    const allowed = rule.enum;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema = (z.any() as any).refine(
      (v: unknown) => allowed.includes(v),
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