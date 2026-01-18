import { getPath } from './path';
import type { AutorixContext } from '../types';

const VAR_RE = /^\$\{(.+)}$/;

export function resolveValue(value: unknown, ctx: AutorixContext): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  const m = trimmed.match(VAR_RE);
  if (!m) return value;
  const path = m[1].trim();
  
  return getPath({
    principal: ctx.principal,
    resource: ctx.resource,
    request: ctx.request,
    scope: ctx.scope,
    context: { ...ctx.context, scope: ctx.context?.scope ?? ctx.scope },
  }, path);
}