import type { NextFunction, Request, Response } from "express";
import type { AutorixExpressOptions, AutorixRequestContext } from "../types";
import { buildRequestContext } from "../context/buildRequestContext";
import { AutorixForbiddenError } from "../errors/AutorixHttpErrors";

declare global {
  namespace Express {
    interface Request {
      autorix?: {
        context: AutorixRequestContext;
        can: (action: string, resource?: unknown, ctxExtra?: Record<string, unknown>) => Promise<boolean>;
        enforce: (action: string, resource?: unknown, ctxExtra?: Record<string, unknown>) => Promise<void>;
      };
    }
  }
}

export function autorixExpress(opts: AutorixExpressOptions) {
  return async function autorixMiddleware(req: Request, _res: Response, next: NextFunction) {
    try {
      const context = await buildRequestContext(req, opts);

      req.autorix = {
        context,
        can: async (action, resource, ctxExtra) => {
          const decision = await opts.enforcer.can({
            action,
            context: {
              ...context,
              attributes: { ...(context.attributes ?? {}), ...(ctxExtra ?? {}) },
            },
            resource,
          });

          opts.onDecision?.({ ...decision, action }, req);
          return decision.allowed;
        },
        enforce: async (action, resource, ctxExtra) => {
          const allowed = await req.autorix!.can(action, resource, ctxExtra);
          if (!allowed) throw new AutorixForbiddenError();
        },
      };

      return next();
    } catch (e) {
      return next(e);
    }
  };
}
