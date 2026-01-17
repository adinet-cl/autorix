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
   * Determina el scope (tenant/workspace/etc) para cargar policies.
   * Por defecto: TENANT leyendo req.tenantId o req.user.tenantId (si existe).
   */
  scopeResolver?: (ctx: ExecutionContext) => Promise<AutorixScope> | AutorixScope;

  /**
   * Determina quién es el principal (user) + roles/grupos.
   * Por defecto: usa req.user.id / req.user.roles / req.user.groups si existen.
   */
  principalResolver?: (
    ctx: ExecutionContext
  ) => Promise<PrincipalResolverResult> | PrincipalResolverResult;

  /**
   * Construye el AutorixContext canónico para ABAC.
   * Por defecto: arma principal + request(method/path) y deja resource vacío.
   */
  contextResolver?: (
    ctx: ExecutionContext,
    scope: AutorixScope,
    principal: PrincipalResolverResult,
    resource?: Record<string, any>
  ) => Promise<AutorixContext> | AutorixContext;

  /**
   * Resuelve el resource (opcional) para ABAC.
   * Útil para "resource.ownerId", "resource.tenantId", etc.
   */
  resourceResolver?: (
    ctx: ExecutionContext
  ) => Promise<Record<string, any> | undefined> | Record<string, any> | undefined;

  /**
   * Qué hacer si falta req.user / principalId.
   */
  onMissingPrincipal?: "deny" | "throw";
}

export type AutorixModuleAsyncOptions = {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => Promise<AutorixNestjsOptions> | AutorixNestjsOptions;
  policyProvider: PolicyProvider; // para MVP: directo
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
