import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { evaluateAll } from "@autorix/core";
import type { AutorixContext } from "@autorix/core";
import type { PolicyProvider } from "@autorix/storage";
import { AUTORIX_ACTIONS_KEY, AUTORIX_OPTIONS, AUTORIX_POLICY_PROVIDER } from "./autorix.constants";
import type { AutorixNestjsOptions, PrincipalResolverResult } from "./autorix.interfaces";

function getReq(ctx: ExecutionContext): any {
  const http = ctx.switchToHttp();
  return http.getRequest?.() ?? undefined;
}

function defaultScopeResolver(ctx: ExecutionContext) {
  const req = getReq(ctx);
  const tenantId = req?.tenantId ?? req?.user?.tenantId;
  return { type: "TENANT" as const, id: tenantId };
}

function defaultPrincipalResolver(ctx: ExecutionContext): PrincipalResolverResult {
  const req = getReq(ctx);
  const user = req?.user;

  return {
    principalId: user?.id ?? user?.sub ?? "",
    roleIds: Array.isArray(user?.roles) ? user.roles : [],
    groupIds: Array.isArray(user?.groups) ? user.groups : [],
    principalAttributes: user ?? {},
  };
}

function defaultContextResolver(
  ctx: ExecutionContext,
  scope: any,
  principal: PrincipalResolverResult,
  resource?: Record<string, any>
): AutorixContext {
  const req = getReq(ctx);

  return {
    principal: {
      id: principal.principalId,
      tenantId: scope?.type === "TENANT" ? scope?.id : undefined,
      roles: principal.roleIds,
      ...principal.principalAttributes,
    },
    resource: resource ?? undefined,
    request: {
      method: req?.method,
      path: req?.url ?? req?.originalUrl,
    },
    scope: scope ? { type: scope.type, id: scope.id } : undefined,
  } as any;
}

@Injectable()
export class AutorixGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTORIX_POLICY_PROVIDER) private readonly policyProvider: PolicyProvider,
    @Inject(AUTORIX_OPTIONS) private readonly options: AutorixNestjsOptions
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const actions = this.reflector.getAllAndOverride<string[]>(AUTORIX_ACTIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!actions || actions.length === 0) return true;

    const scope = await (this.options.scopeResolver?.(context) ?? defaultScopeResolver(context));

    const principal = await (this.options.principalResolver?.(context) ?? defaultPrincipalResolver(context));

    if (!principal.principalId) {
      if ((this.options.onMissingPrincipal ?? "deny") === "throw") {
        throw new UnauthorizedException("Missing principal");
      }
      throw new ForbiddenException("Forbidden");
    }

    const resource =
      (await this.options.resourceResolver?.(context)) ??
      undefined;

    const ctx =
      (await this.options.contextResolver?.(context, scope, principal)) ??
      defaultContextResolver(context, scope, principal, resource);

    const policies = await this.policyProvider.getPolicies({
      scope,
      principal: { type: "USER", id: principal.principalId },
      roleIds: principal.roleIds,
      groupIds: principal.groupIds,
    });

    const policyDocs = policies
      .map((p) => p?.document)
      .filter(Boolean);

    for (const action of actions) {

      const decision = evaluateAll({
        action,
        resource: ctx.resource?.type ? `${ctx.resource.type}/*` : "*",
        policies: policyDocs,
        ctx,
      });

      if (!decision.allowed) {
        throw new ForbiddenException(`Forbidden by policy (${decision.reason})`);
      }

    }

    return true;

  }
}
