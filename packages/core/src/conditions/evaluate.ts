import type { AutorixContext, ConditionBlock } from '../types';
import { getPath, toBoolean, toNumber } from '../utils/path';
import { resolveValue } from '../utils/vars';
import { matchOneOrMany } from '../utils/wildcard';

function getLeft(ctx: AutorixContext, key: string): unknown {
  return getPath(
    {
      principal: ctx.principal,
      resource: ctx.resource,
      request: ctx.request,
      scope: ctx.scope,
      context: { ...ctx.context, scope: ctx.context?.scope ?? ctx.scope },
    },
    key
  );
}

function allEntries(obj: Record<string, unknown> | undefined): [string, unknown][] {
  if (!obj) return [];
  return Object.entries(obj);
}

function evalStringEquals(ctx: AutorixContext, kv: Record<string, unknown> | undefined): boolean {
  for (const [key, expectedRaw] of allEntries(kv)) {
    const left = getLeft(ctx, key);
    const expected = resolveValue(expectedRaw, ctx);
    if (Array.isArray(expected)) {
      if (!expected.some((e) => String(left) === String(e))) return false;
      continue;
    }
    if (String(left) !== String(expected)) return false;
  }
  return true;
}

function evalStringLike(ctx: AutorixContext, kv: Record<string, unknown> | undefined): boolean {
  for (const [key, expectedRaw] of allEntries(kv)) {
    const left = getLeft(ctx, key);
    const expected = resolveValue(expectedRaw, ctx);
    if (typeof left !== 'string' && typeof left !== 'number' && typeof left !== 'boolean') {
      return false;
    }
    const leftStr = String(left);
    if (typeof expected === 'string' || Array.isArray(expected)) {
      if (!matchOneOrMany(leftStr, expected as any)) return false;
      continue;
    }
    return false;
  }
  return true;
}

function evalNumericEquals(ctx: AutorixContext, kv: Record<string, unknown> | undefined): boolean {
  for (const [key, expectedRaw] of allEntries(kv)) {
    const leftN = toNumber(getLeft(ctx, key));
    const expected = resolveValue(expectedRaw, ctx);
    const expN = toNumber(expected);
    if (leftN === undefined || expN === undefined) return false;
    if (leftN !== expN) return false;
  }
  return true;
}

function evalBool(ctx: AutorixContext, kv: Record<string, unknown> | undefined): boolean {
  for (const [key, expectedRaw] of allEntries(kv)) {
    const leftB = toBoolean(getLeft(ctx, key));
    const expected = resolveValue(expectedRaw, ctx);
    const expB = toBoolean(expected);
    if (leftB === undefined || expB === undefined) return false;
    if (leftB !== expB) return false;
  }
  return true;
}

export function evaluateConditions(condition: ConditionBlock | undefined, ctx: AutorixContext): boolean {
  if (!condition) return true;

  if (!evalStringEquals(ctx, condition.StringEquals)) return false;
  if (!evalStringLike(ctx, condition.StringLike)) return false;
  if (!evalNumericEquals(ctx, condition.NumericEquals)) return false;
  if (!evalBool(ctx, condition.Bool)) return false;

  return true;
}
