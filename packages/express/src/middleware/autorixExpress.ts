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
        can: async (action, resourceObj, ctxExtra) => {
          // Build resource string for matching (e.g., 'post/123')
          let resourceString = '*';
          if (typeof resourceObj === 'object' && resourceObj && 'type' in resourceObj) {
            const resType = (resourceObj as any).type;
            const resId = (resourceObj as any).id;
            resourceString = resId ? `${resType}/${resId}` : `${resType}/*`;
          } else if (typeof resourceObj === 'string') {
            resourceString = resourceObj;
          } else if (resourceObj === undefined) {
            // Infer resource from action (e.g., 'user:list' -> 'user/*')
            const parts = action.split(':');
            if (parts.length > 1) {
              resourceString = `${parts[0]}/*`;
            }
          }

          const decision = await opts.enforcer.can({
            action,
            resource: resourceString,
            context: {
              ...context,
              resource: resourceObj,  // Object goes in context for conditions
              attributes: { ...(context.attributes ?? {}), ...(ctxExtra ?? {}) },
            },
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
