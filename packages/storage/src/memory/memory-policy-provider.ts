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

export class MemoryPolicyProvider implements PolicyProvider {
  private policies = new Map<string, PolicyRecord>();
  private attachments: Attachment[] = [];

  addPolicy(policy: PolicyRecord): this {
    this.policies.set(policy.id, policy);
    return this;
  }

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
      // Asegura scope igual por si alguien attachó mal
      if (!sameScope(rec.scope, input.scope)) continue;

      result.push({ id: rec.id, document: rec.document });
    }

    return result;
  }
}
