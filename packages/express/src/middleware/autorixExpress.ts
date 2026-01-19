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

/**
 * Express middleware that adds authorization capabilities to requests.
 * 
 * This middleware:
 * 1. Builds authorization context from the request (principal, scope, environment)
 * 2. Attaches `req.autorix` with `can()` and `enforce()` methods
 * 3. Should be registered before route handlers that need authorization
 * 
 * @param opts - Configuration options
 * @param opts.enforcer - Enforcer with policyProvider and can() method
 * @param opts.principal - Function to extract principal from request (e.g., from JWT)
 * @param opts.scope - Function to extract scope from request (e.g., tenant ID)
 * @param opts.environment - Optional function to extract environment attributes
 * @param opts.onDecision - Optional callback invoked after each authorization decision
 * 
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * import { autorixExpress } from '@autorix/express';
 * import { MemoryPolicyProvider } from '@autorix/storage';
 * import { evaluateAll } from '@autorix/core';
 * 
 * const provider = new MemoryPolicyProvider();
 * // ... add policies
 * 
 * app.use(autorixExpress({
 *   enforcer: {
 *     policyProvider: provider,
 *     can: async ({ action, resource, context }) => {
 *       const policies = await provider.getPolicies({
 *         scope: context.scope,
 *         principal: context.principal,
 *         roleIds: context.roleIds,
 *         groupIds: context.groupIds
 *       });
 *       
 *       const result = evaluateAll({
 *         action,
 *         resource,
 *         policies: policies.map(p => p.document),
 *         ctx: {
 *           principal: context.principal,
 *           resource: context.resourceObject ?? {},
 *           context: context.environment ?? {}
 *         }
 *       });
 *       
 *       return result.decision === 'allow';
 *     }
 *   },
 *   principal: async (req) => ({
 *     type: 'USER',
 *     id: req.user?.id || 'anonymous'
 *   }),
 *   scope: async (req) => ({
 *     type: 'TENANT',
 *     id: req.headers['x-tenant-id']
 *   })
 * }));
 * 
 * // Now use in routes
 * app.get('/posts', async (req, res) => {
 *   if (!await req.autorix.can('post:list')) {
 *     return res.status(403).send('Forbidden');
 *   }
 *   // ... return posts
 * });
 * ```
 */
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
