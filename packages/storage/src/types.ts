export type ScopeType = "PLATFORM" | "TENANT" | "WORKSPACE" | "APP";

export type AutorixScope = {
  type: ScopeType;
  id?: string; // TENANT=tenantId, WORKSPACE=workspaceId, etc.
};

export type PrincipalType = "USER" | "ROLE" | "GROUP";

export type PrincipalRef = {
  type: PrincipalType;
  id: string;
};
