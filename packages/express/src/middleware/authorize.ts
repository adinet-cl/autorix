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

/**
 * Route-level middleware for declarative authorization.
 * 
 * Use this middleware on specific routes to enforce authorization checks.
 * Requires `autorixExpress()` middleware to be registered first.
 * 
 * @param actionOrConfig - Action string (e.g., 'post:create') or full config object
 * @param cfg - Optional config (when first param is just the action string)
 * 
 * @returns Express middleware function
 * 
 * @throws {AutorixMissingMiddlewareError} If autorixExpress() middleware is not registered
 * @throws {AutorixUnauthenticatedError} If requireAuth: true and no principal found
 * @throws {AutorixForbiddenError} If authorization check fails
 * 
 * @example Basic usage
 * ```typescript
 * import { authorize } from '@autorix/express';
 * 
 * app.post('/posts', authorize('post:create'), async (req, res) => {
 *   // Only allowed if user has 'post:create' permission
 *   const post = await createPost(req.body);
 *   res.json(post);
 * });
 * ```
 * 
 * @example With resource loading
 * ```typescript
 * app.put('/posts/:id',
 *   authorize('post:update', {
 *     resource: {
 *       type: 'post',
 *       param: 'id',
 *       loader: async (id, req) => {
 *         return await db.posts.findById(id);
 *       }
 *     }
 *   }),
 *   async (req, res) => {
 *     // Resource is pre-loaded and available in req.autorix.context.resource
 *     // Useful for ABAC conditions like: resource.authorId == principal.id
 *     await updatePost(req.params.id, req.body);
 *     res.json({ ok: true });
 *   }
 * );
 * ```
 * 
 * @example Require authentication
 * ```typescript
 * app.get('/admin/users',
 *   authorize({
 *     action: 'admin:listUsers',
 *     requireAuth: true
 *   }),
 *   async (req, res) => {
 *     // Throws 401 if req.autorix.context.principal is null
 *     const users = await db.users.findAll();
 *     res.json(users);
 *   }
 * );
 * ```
 * 
 * @example Dynamic context
 * ```typescript
 * app.post('/posts/:id/publish',
 *   authorize({
 *     action: 'post:publish',
 *     resource: { type: 'post', param: 'id', loader: loadPost },
 *     context: async (req) => ({
 *       publishDate: req.body.publishDate,
 *       ipAddress: req.ip
 *     })
 *   }),
 *   async (req, res) => {
 *     // Context attributes available for policy conditions
 *     await publishPost(req.params.id, req.body);
 *     res.json({ ok: true });
 *   }
 * );
 * ```
 */
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
