import type { Decision, EvaluateInput, Statement } from './types';
import { matchAction } from './matchers/action';
import { matchResource } from './matchers/resource';
import { evaluateConditions } from './conditions/evaluate';
import { assertValidPolicyDocument } from './validatePolicy';


function statementId(stmt: Statement, index: number): string {
  return stmt.Sid ?? `stmt#${index}`;
}

export function evaluate(input: EvaluateInput): Decision {
  const { action, resource, policy, ctx } = input;
  const matchedAllow: string[] = [];
  const matchedDeny: string[] = [];

  if (!policy) {
    return { allowed: false, reason: "DEFAULT_DENY", matchedStatements: [] };
  }

  if (input.validate !== false) {
    assertValidPolicyDocument(policy);
  }

  const statements = policy.Statement ?? [];
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!matchAction(action, stmt.Action)) continue;
    if (!matchResource(resource, stmt.Resource)) continue;
    if (!evaluateConditions(stmt.Condition, ctx)) continue;

    const id = statementId(stmt, i);
    if (stmt.Effect === 'Deny') matchedDeny.push(id);
    if (stmt.Effect === 'Allow') matchedAllow.push(id);
  }

  if (matchedDeny.length > 0) {
    return { allowed: false, reason: 'EXPLICIT_DENY', matchedStatements: matchedDeny };
  }

  if (matchedAllow.length > 0) {
    return { allowed: true, reason: 'EXPLICIT_ALLOW', matchedStatements: matchedAllow };
  }

  return { allowed: false, reason: 'DEFAULT_DENY', matchedStatements: [] };
}
