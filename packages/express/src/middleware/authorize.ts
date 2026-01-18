import type { NextFunction, Request, Response } from "express";
import type { ResourceSpec } from "../types";
import { resolveResource } from "../context/resource";
import { AutorixMissingMiddlewareError, AutorixUnauthenticatedError } from "../errors/AutorixHttpErrors";

type AuthorizeConfig = {
  action: string;
  resource?: ResourceSpec;
  context?: Record<string, unknown> | ((req: Request) => Record<string, unknown> | Promise<Record<string, unknown>>);
  requireAuth?: boolean;
};

export function authorize(actionOrConfig: string | AuthorizeConfig, cfg?: Omit<AuthorizeConfig, "action">) {
  const config: AuthorizeConfig =
    typeof actionOrConfig === "string" ? { action: actionOrConfig, ...(cfg ?? {}) } : actionOrConfig;

  return async function authorizeMiddleware(req: Request, _res: Response, next: NextFunction) {
    try {
      if (!req.autorix) throw new AutorixMissingMiddlewareError();

      if (config.requireAuth && !req.autorix.context.principal) {
        throw new AutorixUnauthenticatedError();
      }

      const ctxExtra =
        typeof config.context === "function" ? await config.context(req) : (config.context ?? {});

      let resource: unknown = undefined;
      if (config.resource) {
        resource = await resolveResource(config.resource, req);
        req.autorix.context.resource = resource;
      }

      await req.autorix.enforce(config.action, resource, ctxExtra);
      return next();
    } catch (e) {
      return next(e);
    }
  };
}
