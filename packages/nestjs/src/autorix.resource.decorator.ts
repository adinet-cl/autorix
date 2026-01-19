import { SetMetadata } from "@nestjs/common";
import { AUTORIX_RESOURCE_KEY } from "./autorix.constants";
import type { AutorixResourceMeta } from "./autorix.interfaces";

/**
 * Decorator to specify resource information for authorization.
 * 
 * The resource is used for:
 * 1. Pattern matching in policies (e.g., `post/*`, `post/123`)
 * 2. ABAC conditions (e.g., `resource.authorId == principal.id`)
 * 
 * @param meta - Resource metadata
 * @param meta.resolver - Function to resolve resource from ExecutionContext
 * 
 * @example Basic resource
 * ```typescript
 * @Get(':id')
 * @Policy('post:read')
 * @Resource((ctx) => {
 *   const req = ctx.switchToHttp().getRequest();
 *   return {
 *     type: 'post',
 *     id: req.params.id
 *   };
 * })
 * async getPost(@Param('id') id: string) {
 *   return this.postsService.findById(id);
 * }
 * ```
 * 
 * @example With data loading for ABAC
 * ```typescript
 * @Put(':id')
 * @Policy('post:update')
 * @Resource(async (ctx) => {
 *   const req = ctx.switchToHttp().getRequest();
 *   const post = await postsService.findById(req.params.id);
 *   
 *   return {
 *     type: 'post',
 *     id: post.id,
 *     authorId: post.authorId,  // Used in ABAC conditions
 *     status: post.status
 *   };
 * })
 * async updatePost(@Param('id') id: string, @Body() data: UpdatePostDto) {
 *   // Policy can check: resource.authorId == principal.id
 *   return this.postsService.update(id, data);
 * }
 * ```
 */
export function Resource(meta: Omit<AutorixResourceMeta, "mode">) {
  return SetMetadata(AUTORIX_RESOURCE_KEY, {
    ...meta,
    mode: "resolver",
  } satisfies AutorixResourceMeta);
}

