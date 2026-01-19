import { SetMetadata } from "@nestjs/common";
import { AUTORIX_ACTIONS_KEY } from "./autorix.constants";

/**
 * Decorator to specify required actions for a route handler.
 * 
 * Use with `@UseGuards(AutorixGuard)` to enforce authorization.
 * Can be applied to controller classes or individual methods.
 * 
 * @param actions - One or more action strings (e.g., 'post:create', 'user:delete')
 * 
 * @example Single action
 * ```typescript
 * @Controller('posts')
 * @UseGuards(AutorixGuard)
 * export class PostsController {
 *   @Post()
 *   @Policy('post:create')
 *   async createPost(@Body() data: CreatePostDto) {
 *     return this.postsService.create(data);
 *   }
 * }
 * ```
 * 
 * @example Multiple actions (requires ANY of them)
 * ```typescript
 * @Get(':id')
 * @Policy('post:read', 'post:preview')
 * async getPost(@Param('id') id: string) {
 *   // User needs either 'post:read' OR 'post:preview'
 *   return this.postsService.findById(id);
 * }
 * ```
 * 
 * @example Class-level default
 * ```typescript
 * @Controller('admin')
 * @UseGuards(AutorixGuard)
 * @Policy('admin:access')
 * export class AdminController {
 *   // All methods require 'admin:access'
 *   @Get('users')
 *   async listUsers() { return []; }
 * }
 * ```
 */
export function Policy(...actions: string[]) {
  return SetMetadata(AUTORIX_ACTIONS_KEY, actions);
}
