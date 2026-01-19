import type { AutorixContext, Decision, EvaluateInput, PolicyDocument } from "./types";
import { evaluate } from "./evaluate";

/**
 * Input parameters for evaluating multiple policies.
 */
export type EvaluateAllInput = {
  /** The action being performed (e.g., 'post:create', 'user:delete') */
  action: string;
  /** The resource being accessed (e.g., 'post/123', 'user/*') */
  resource: string;
  /** Array of policy documents to evaluate (null/undefined policies are skipped) */
  policies: Array<PolicyDocument | undefined | null>;
  /** Context object for condition evaluation */
  ctx: AutorixContext;
};

/**
 * Evaluates multiple policy documents against an action and resource.
 * 
 * This is the recommended function for production use as it handles multiple policies
 * attached to a user (direct policies, role policies, group policies).
 * 
 * Evaluation logic:
 * 1. Iterates through all policies
 * 2. If ANY policy has an explicit Deny → returns Deny immediately
 * 3. If ANY policy has an explicit Allow (and no Deny) → returns Allow
 * 4. If no matches → returns Default Deny
 * 
 * @param input - Evaluation input parameters
 * @param input.action - The action being performed
 * @param input.resource - The resource being accessed
 * @param input.policies - Array of policy documents (null/undefined are skipped)
 * @param input.ctx - Context object with principal, resource data, and environment
 * 
 * @returns Decision object with allowed flag, reason, and all matched statement IDs
 * 
 * @example
 * ```typescript
 * import { evaluateAll } from '@autorix/core';
 * 
 * const decision = evaluateAll({
 *   action: 'post:update',
 *   resource: 'post/123',
 *   policies: [
 *     userPolicy,
 *     rolePolicy,
 *     groupPolicy
 *   ],
 *   ctx: {
 *     principal: { id: 'user-123', type: 'USER' },
 *     resource: { authorId: 'user-123' },
 *     context: { ipAddress: '192.168.1.1' }
 *   }
 * });
 * 
 * console.log(decision.allowed); // true or false
 * console.log(decision.reason); // 'EXPLICIT_ALLOW' | 'EXPLICIT_DENY' | 'DEFAULT_DENY'
 * console.log(decision.matchedStatements); // ['stmt#0', 'admin-allow']
 * ```
 */
export function evaluateAll(input: EvaluateAllInput): Decision {
  const { action, resource, policies, ctx } = input;

  let sawAllow = false;
  const matchedStatements: string[] = [];

  for (const policy of policies) {
    if (!policy) continue;

    const d = evaluate({ action, resource, policy, ctx });

    if (d.matchedStatements?.length) matchedStatements.push(...d.matchedStatements);

    if (d.reason === "EXPLICIT_DENY") {
      return { allowed: false, reason: "EXPLICIT_DENY", matchedStatements };
    }

    if (d.reason === "EXPLICIT_ALLOW") {
      sawAllow = true;
    }
  }

  if (sawAllow) {
    return { allowed: true, reason: "EXPLICIT_ALLOW", matchedStatements };
  }

  return { allowed: false, reason: "DEFAULT_DENY", matchedStatements };
}
