import type { Decision } from "./types";
import { AutorixForbiddenError } from "./errors";

/**
 * Asserts that a decision allows access, throwing an error if denied.
 * 
 * Useful for imperative code where you want to fail fast on denied access.
 * 
 * @param decision - The decision object from evaluate() or evaluateAll()
 * @param message - Custom error message (default: "Forbidden by policy")
 * 
 * @throws {AutorixForbiddenError} If decision.allowed is false
 * 
 * @example
 * ```typescript
 * import { evaluateAll, assertAllowed } from '@autorix/core';
 * 
 * const decision = evaluateAll({ action, resource, policies, ctx });
 * 
 * // Throws if not allowed
 * assertAllowed(decision);
 * 
 * // Continue with business logic
 * await updatePost(postId, data);
 * ```
 * 
 * @example With custom message
 * ```typescript
 * try {
 *   assertAllowed(decision, 'You cannot delete this post');
 * } catch (error) {
 *   if (error instanceof AutorixForbiddenError) {
 *     console.log(error.message); // "You cannot delete this post (EXPLICIT_DENY)"
 *     console.log(error.decision); // Decision object
 *   }
 * }
 * ```
 */
export function assertAllowed(decision: Decision, message = "Forbidden by policy") {
  if (!decision.allowed) {
    throw new AutorixForbiddenError(`${message} (${decision.reason})`, decision);
  }
}
