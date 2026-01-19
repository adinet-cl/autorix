import type { PolicyDocument } from "@autorix/core";
import type { AutorixScope, PrincipalRef, PrincipalType } from "../types";
import type { GetPoliciesInput, PolicyProvider, PolicySource } from "../provider";

type PolicyRecord = {
  id: string;
  scope: AutorixScope;
  document: PolicyDocument;
};

type Attachment = {
  policyId: string;
  scope: AutorixScope;
  principalType: PrincipalType;
  principalId: string;
};

function sameScope(a: AutorixScope, b: AutorixScope): boolean {
  return a.type === b.type && (a.id ?? null) === (b.id ?? null);
}

/**
 * In-memory implementation of PolicyProvider.
 * 
 * Stores policies and attachments in memory (Maps and Arrays).
 * Perfect for development, testing, and small applications.
 * 
 * **Note:** Data is lost when the process restarts. For production
 * with persistence, use database adapters like @autorix/storage-postgres.
 * 
 * @example
 * ```typescript
 * import { MemoryPolicyProvider } from '@autorix/storage';
 * 
 * const provider = new MemoryPolicyProvider();
 * 
 * // Add a policy
 * provider.addPolicy({
 *   id: 'admin-policy',
 *   scope: { type: 'TENANT', id: 't1' },
 *   document: {
 *     statements: [{
 *       effect: 'allow',
 *       actions: ['*'],
 *       resources: ['*']
 *     }]
 *   }
 * });
 * 
 * // Attach to a user
 * provider.attachPolicy({
 *   policyId: 'admin-policy',
 *   scope: { type: 'TENANT', id: 't1' },
 *   principal: { type: 'USER', id: 'user-123' }
 * });
 * ```
 */
export class MemoryPolicyProvider implements PolicyProvider {
  private policies = new Map<string, PolicyRecord>();
  private attachments: Attachment[] = [];

  /**
   * Add a policy to the provider.
   * 
   * If a policy with the same ID already exists, it will be replaced.
   * 
   * @param policy - The policy to add
   * @param policy.id - Unique policy identifier
   * @param policy.scope - Scope where the policy applies
   * @param policy.document - The policy document
   * @returns this (for chaining)
   * 
   * @example
   * ```typescript
   * provider
   *   .addPolicy({ id: 'p1', scope, document: policy1 })
   *   .addPolicy({ id: 'p2', scope, document: policy2 });
   * ```
   */
  addPolicy(policy: PolicyRecord): this {
    this.policies.set(policy.id, policy);
    return this;
  }

  /**
   * Attach a policy to a principal (user, role, or group).
   * 
   * The same policy can be attached multiple times to different principals.
   * 
   * @param params - Attachment parameters
   * @param params.policyId - ID of the policy to attach
   * @param params.scope - Scope for the attachment
   * @param params.principal - Principal to attach to (user/role/group)
   * @returns this (for chaining)
   * 
   * @example
   * ```typescript
   * provider
   *   .attachPolicy({
   *     policyId: 'admin-policy',
   *     scope: { type: 'TENANT', id: 't1' },
   *     principal: { type: 'USER', id: 'user-123' }
   *   })
   *   .attachPolicy({
   *     policyId: 'admin-policy',
   *     scope: { type: 'TENANT', id: 't1' },
   *     principal: { type: 'ROLE', id: 'admin' }
   *   });
   * ```
   */
  attachPolicy(params: {
    policyId: string;
    scope: AutorixScope;
    principal: PrincipalRef;
  }): this {
    this.attachments.push({
      policyId: params.policyId,
      scope: params.scope,
      principalType: params.principal.type,
      principalId: params.principal.id,
    });
    return this;
  }

  /**
   * Get all policies applicable to a principal within a scope.
   * 
   * This method is called by the authorization enforcer. It:
   * 1. Finds all attachments matching the scope and principal
   * 2. Also checks for role and group attachments
   * 3. Returns the unique set of policy documents
   * 
   * @param input - Query parameters
   * @param input.scope - The scope to query
   * @param input.principal - The principal (user) requesting access
   * @param input.roleIds - Optional array of role IDs the user has
   * @param input.groupIds - Optional array of group IDs the user belongs to
   * @returns Array of policy sources (id + document)
   * 
   * @example
   * ```typescript
   * const policies = await provider.getPolicies({
   *   scope: { type: 'TENANT', id: 't1' },
   *   principal: { type: 'USER', id: 'user-123' },
   *   roleIds: ['admin', 'editor'],
   *   groupIds: ['engineering']
   * });
   * 
   * // Returns policies attached to:
   * // - USER:user-123
   * // - ROLE:admin
   * // - ROLE:editor
   * // - GROUP:engineering
   * ```
   */
  async getPolicies(input: GetPoliciesInput): Promise<PolicySource[]> {
    const roleIds = input.roleIds ?? [];
    const groupIds = input.groupIds ?? [];

    const principalsToMatch: Array<{ type: PrincipalType; id: string }> = [
      { type: input.principal.type, id: input.principal.id },
      ...roleIds.map((id) => ({ type: "ROLE" as const, id })),
      ...groupIds.map((id) => ({ type: "GROUP" as const, id })),
    ];

    const matchedPolicyIds = new Set<string>();

    for (const att of this.attachments) {
      if (!sameScope(att.scope, input.scope)) continue;

      const ok = principalsToMatch.some(
        (p) => p.type === att.principalType && p.id === att.principalId
      );
      if (ok) matchedPolicyIds.add(att.policyId);
    }

    const result: PolicySource[] = [];
    for (const policyId of matchedPolicyIds) {
      const rec = this.policies.get(policyId);
      if (!rec) continue;
      // Ensures same scope in case someone attached incorrectly
      if (!sameScope(rec.scope, input.scope)) continue;

      result.push({ id: rec.id, document: rec.document });
    }

    return result;
  }
}
