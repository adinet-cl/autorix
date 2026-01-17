import type { PolicyDocument } from "@autorix/core";
import type { AutorixScope, PrincipalRef } from "./types";

export type PolicySource = {
  id: string;              // id interno de policy (db id, uuid, etc.)
  document: PolicyDocument; // policy JSON ya parseada/validada
};

export type GetPoliciesInput = {
  scope: AutorixScope;
  principal: PrincipalRef;
  roleIds?: string[];
  groupIds?: string[];
  // opcional futuro:
  // includePlatformPolicies?: boolean;
};

export interface PolicyProvider {
  /**
   * Devuelve TODAS las policies aplicables al principal dentro del scope.
   * El provider decide cómo resolver attachments: direct user, roles, grupos, etc.
   */
  getPolicies(input: GetPoliciesInput): Promise<PolicySource[]>;
}
