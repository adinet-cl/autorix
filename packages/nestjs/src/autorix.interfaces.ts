import type { ExecutionContext } from "@nestjs/common";
import type { AutorixContext } from "@autorix/core";
import type { AutorixScope, PolicyProvider } from "@autorix/storage";

export type PrincipalResolverResult = {
  principalId: string;
  roleIds?: string[];
  groupIds?: string[];
  principalAttributes?: Record<string, any>;
};

export interface AutorixNestjsOptions {
  /**
   * Determines the scope (tenant/workspace/etc) to load policies.
   * Default: TENANT reading req.tenantId or req.user.tenantId (if exists).
   */
  scopeResolver?: (ctx: ExecutionContext) => Promise<AutorixScope> | AutorixScope;

  /**
   * Determines who is the principal (user) + roles/groups.
   * Default: uses req.user.id / req.user.roles / req.user.groups if they exist.
   */
  principalResolver?: (
    ctx: ExecutionContext
  ) => Promise<PrincipalResolverResult> | PrincipalResolverResult;

  /**
   * Builds the canonical AutorixContext for ABAC.
   * Default: builds principal + request(method/path) and leaves resource empty.
   */
  contextResolver?: (
    ctx: ExecutionContext,
    scope: AutorixScope,
    principal: PrincipalResolverResult,
    resource?: Record<string, any>
  ) => Promise<AutorixContext> | AutorixContext;

  /**
   * Resolves the resource (optional) for ABAC.
   * Useful for "resource.ownerId", "resource.tenantId", etc.
   */
  resourceResolver?: (
    ctx: ExecutionContext
  ) => Promise<Record<string, any> | undefined> | Record<string, any> | undefined;

  /**
   * What to do if req.user / principalId is missing.
   */
  onMissingPrincipal?: "deny" | "throw";
}

export type AutorixModuleAsyncOptions = {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => Promise<AutorixNestjsOptions> | AutorixNestjsOptions;
  policyProvider: PolicyProvider;
};

export type AutorixExecutionCtx = {
  req: any;
  context: ExecutionContext;
};

export type ResourceResolverValue =
  | string
  | number
  | null
  | undefined
  | Record<string, any>;

export type AutorixResourceMeta =
  | {
    mode: "param";
    type: string;
    param?: string;
  }
  | {
    mode: "resolver";
    type: string;
    id?: (ctx: AutorixExecutionCtx) => string | number | null | undefined;
    attributes?: (
      ctx: AutorixExecutionCtx
    ) => Promise<Record<string, any> | undefined> | Record<string, any> | undefined;
    tenantId?: (
      ctx: AutorixExecutionCtx
    ) => Promise<string | undefined> | string | undefined;
  };
