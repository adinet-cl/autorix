import type { PolicyDocument } from "@autorix/core";
import type { RedisClientType } from "redis";
import type {
  AutorixScope,
  GetPoliciesInput,
  PolicyProvider,
  PolicySource,
  PrincipalRef,
} from "@autorix/storage";

/**
 * Redis implementation of PolicyProvider
 * 
 * ## Data Structure
 * 
 * Redis uses key-value pairs with JSON serialization:
 * 
 * ### Keys Pattern:
 * - `autorix:policy:{scopeType}:{scopeId}:{policyId}` - Policy document
 * - `autorix:attachment:{scopeType}:{scopeId}:{principalType}:{principalId}` - Set of policy IDs
 * 
 * ### Example:
 * ```
 * autorix:policy:TENANT:t1:admin-policy -> JSON(PolicyDocument)
 * autorix:attachment:TENANT:t1:USER:u1 -> Set["admin-policy", "editor-policy"]
 * autorix:attachment:TENANT:t1:ROLE:admin -> Set["admin-policy"]
 * ```
 * 
 * ## Usage
 * 
 * ```typescript
 * import { createClient } from 'redis';
 * import { RedisPolicyProvider } from '@autorix/storage-redis';
 * 
 * const redis = createClient({ url: 'redis://localhost:6379' });
 * await redis.connect();
 * 
 * const provider = new RedisPolicyProvider(redis);
 * 
 * // Add a policy
 * await provider.addPolicy({
 *   id: 'admin-policy',
 *   scope: { type: 'TENANT', id: 't1' },
 *   document: {
 *     statements: [
 *       { effect: 'allow', actions: ['*'], resources: ['*'] }
 *     ]
 *   }
 * });
 * 
 * // Attach to a user
 * await provider.attachPolicy({
 *   policyId: 'admin-policy',
 *   scope: { type: 'TENANT', id: 't1' },
 *   principal: { type: 'USER', id: 'u1' }
 * });
 * ```
 * 
 * ## Performance Notes
 * 
 * - Fast in-memory lookups
 * - Uses Redis Sets for efficient policy ID lookups
 * - Supports TTL for policy expiration (optional)
 * - Ideal for high-performance, distributed systems
 * - Can be used as cache layer in front of SQL/NoSQL storage
 */
export class RedisPolicyProvider implements PolicyProvider {
  private readonly keyPrefix: string;

  /**
   * Creates a new Redis policy provider.
   * 
   * @param redis - Redis client instance (must be connected)
   * @param options - Configuration options
   * @param options.keyPrefix - Key prefix for all Redis keys (default: 'autorix')
   * 
   * @example
   * ```typescript
   * import { createClient } from 'redis';
   * import { RedisPolicyProvider } from '@autorix/storage-redis';
   * 
   * const redis = createClient({ url: 'redis://localhost:6379' });
   * await redis.connect();
   * 
   * const provider = new RedisPolicyProvider(redis, {
   *   keyPrefix: 'myapp:autorix'
   * });
   * ```
   */
  constructor(
    private redis: RedisClientType,
    options?: {
      keyPrefix?: string;
    }
  ) {
    this.keyPrefix = options?.keyPrefix ?? "autorix";
  }

  /**
   * Get all policies applicable to a principal
   */
  async getPolicies(input: GetPoliciesInput): Promise<PolicySource[]> {
    const { scope, principal, roleIds = [], groupIds = [] } = input;

    // Build list of principals to check
    const principals: Array<{ type: string; id: string }> = [
      { type: principal.type, id: principal.id },
      ...roleIds.map((id) => ({ type: "ROLE", id })),
      ...groupIds.map((id) => ({ type: "GROUP", id })),
    ];

    // Get all policy IDs from all principals using SUNION
    const attachmentKeys = principals.map((p) =>
      this.getAttachmentKey(scope, p)
    );

    // Use SUNION to get all unique policy IDs from all attachment sets
    const policyIds = await this.redis.sUnion(attachmentKeys);

    if (policyIds.length === 0) {
      return [];
    }

    // Fetch all policies in parallel using MGET
    const policyKeys = policyIds.map((id) => this.getPolicyKey(scope, id));
    const policyJsons = await this.redis.mGet(policyKeys);

    // Parse and return policies
    const policies: PolicySource[] = [];
    for (let i = 0; i < policyIds.length; i++) {
      const json = policyJsons[i];
      if (json) {
        try {
          policies.push({
            id: policyIds[i],
            document: JSON.parse(json) as PolicyDocument,
          });
        } catch (error) {
          console.error(`Failed to parse policy ${policyIds[i]}:`, error);
        }
      }
    }

    return policies;
  }

  /**
   * Add or update a policy.
   * 
   * @param params - Policy parameters
   * @param ttl - Optional TTL in seconds (for auto-expiring policies)
   * 
   * @example
   * ```typescript
   * // Permanent policy
   * await provider.addPolicy({
   *   id: 'admin-policy',
   *   scope: { type: 'TENANT', id: 't1' },
   *   document: { statements: [] }
   * });
   * 
   * // Temporary policy (expires in 1 hour)
   * await provider.addPolicy({
   *   id: 'temp-access',
   *   scope: { type: 'TENANT', id: 't1' },
   *   document: { statements: [] }
   * }, 3600);
   * ```
   */
  async addPolicy(
    params: {
      id: string;
      scope: AutorixScope;
      document: PolicyDocument;
    },
    ttl?: number
  ): Promise<void> {
    const key = this.getPolicyKey(params.scope, params.id);
    const value = JSON.stringify(params.document);

    if (ttl) {
      await this.redis.set(key, value, { EX: ttl });
    } else {
      await this.redis.set(key, value);
    }
  }

  /**
   * Attach a policy to a principal (user, role, or group)
   */
  async attachPolicy(params: {
    policyId: string;
    scope: AutorixScope;
    principal: PrincipalRef;
  }): Promise<void> {
    const key = this.getAttachmentKey(params.scope, params.principal);
    await this.redis.sAdd(key, params.policyId);
  }

  /**
   * Remove a policy attachment
   */
  async detachPolicy(params: {
    policyId: string;
    scope: AutorixScope;
    principal: PrincipalRef;
  }): Promise<void> {
    const key = this.getAttachmentKey(params.scope, params.principal);
    await this.redis.sRem(key, params.policyId);
  }

  /**
   * Delete a policy and all its attachments
   */
  async deletePolicy(params: {
    id: string;
    scope: AutorixScope;
  }): Promise<void> {
    const policyKey = this.getPolicyKey(params.scope, params.id);

    // Find all attachment keys that reference this policy
    const pattern = this.getAttachmentPattern(params.scope);
    const attachmentKeys: string[] = [];

    // Scan for all attachment keys in this scope
    for await (const key of this.redis.scanIterator({
      MATCH: pattern,
      COUNT: 100,
    })) {
      attachmentKeys.push(key);
    }

    // Remove policy ID from all attachment sets
    if (attachmentKeys.length > 0) {
      await Promise.all(
        attachmentKeys.map((key) => this.redis.sRem(key, params.id))
      );
    }

    // Delete the policy itself
    await this.redis.del(policyKey);
  }

  /**
   * Batch attach multiple policies for better performance.
   * 
   * Uses Redis pipeline to execute all operations in a single round-trip.
   * 
   * @param attachments - Array of attachments
   * 
   * @example
   * ```typescript
   * await provider.attachPolicies([
   *   { policyId: 'p1', scope, principal: { type: 'USER', id: 'u1' } },
   *   { policyId: 'p2', scope, principal: { type: 'USER', id: 'u1' } },
   *   { policyId: 'p3', scope, principal: { type: 'ROLE', id: 'admin' } }
   * ]);
   * ```
   */
  async attachPolicies(
    attachments: Array<{
      policyId: string;
      scope: AutorixScope;
      principal: PrincipalRef;
    }>
  ): Promise<void> {
    const pipeline = this.redis.multi();

    for (const attachment of attachments) {
      const key = this.getAttachmentKey(attachment.scope, attachment.principal);
      pipeline.sAdd(key, attachment.policyId);
    }

    await pipeline.exec();
  }

  /**
   * Batch detach multiple policies
   */
  async detachPolicies(
    attachments: Array<{
      policyId: string;
      scope: AutorixScope;
      principal: PrincipalRef;
    }>
  ): Promise<void> {
    const pipeline = this.redis.multi();

    for (const attachment of attachments) {
      const key = this.getAttachmentKey(attachment.scope, attachment.principal);
      pipeline.sRem(key, attachment.policyId);
    }

    await pipeline.exec();
  }

  /**
   * Get all policies in a scope (useful for admin/debugging).
   * 
   * Uses SCAN to iterate through all policy keys in the scope.
   * 
   * @param scope - Scope to query
   * @returns All policies in the scope
   * 
   * @example
   * ```typescript
   * const allPolicies = await provider.getAllPoliciesInScope({
   *   type: 'TENANT',
   *   id: 't1'
   * });
   * console.log(`Found ${allPolicies.length} policies`);
   * ```
   */
  async getAllPoliciesInScope(scope: AutorixScope): Promise<PolicySource[]> {
    const pattern = this.getPolicyPattern(scope);
    const policies: PolicySource[] = [];

    for await (const key of this.redis.scanIterator({
      MATCH: pattern,
      COUNT: 100,
    })) {
      const json = await this.redis.get(key);
      if (json) {
        try {
          const id = this.extractPolicyIdFromKey(key);
          policies.push({
            id,
            document: JSON.parse(json) as PolicyDocument,
          });
        } catch (error) {
          console.error(`Failed to parse policy from key ${key}:`, error);
        }
      }
    }

    return policies;
  }

  /**
   * Clear all policies and attachments in a scope.
   * 
   * **Warning:** This deletes all policies and attachments. Use with caution.
   * 
   * @param scope - Scope to clear
   * 
   * @example
   * ```typescript
   * // Clear all policies in tenant
   * await provider.clearScope({ type: 'TENANT', id: 't1' });
   * ```
   */
  async clearScope(scope: AutorixScope): Promise<void> {
    const policyPattern = this.getPolicyPattern(scope);
    const attachmentPattern = this.getAttachmentPattern(scope);
    const keysToDelete: string[] = [];

    // Scan for all keys in this scope
    for await (const key of this.redis.scanIterator({
      MATCH: policyPattern,
      COUNT: 100,
    })) {
      keysToDelete.push(key);
    }

    for await (const key of this.redis.scanIterator({
      MATCH: attachmentPattern,
      COUNT: 100,
    })) {
      keysToDelete.push(key);
    }

    // Delete all keys
    if (keysToDelete.length > 0) {
      await this.redis.del(keysToDelete);
    }
  }

  /**
   * Helper: Generate policy key
   */
  private getPolicyKey(scope: AutorixScope, policyId: string): string {
    return `${this.keyPrefix}:policy:${scope.type}:${scope.id ?? "global"}:${policyId}`;
  }

  /**
   * Helper: Generate attachment key
   */
  private getAttachmentKey(
    scope: AutorixScope,
    principal: { type: string; id: string }
  ): string {
    return `${this.keyPrefix}:attachment:${scope.type}:${scope.id ?? "global"}:${principal.type}:${principal.id}`;
  }

  /**
   * Helper: Generate policy pattern for SCAN
   */
  private getPolicyPattern(scope: AutorixScope): string {
    return `${this.keyPrefix}:policy:${scope.type}:${scope.id ?? "global"}:*`;
  }

  /**
   * Helper: Generate attachment pattern for SCAN
   */
  private getAttachmentPattern(scope: AutorixScope): string {
    return `${this.keyPrefix}:attachment:${scope.type}:${scope.id ?? "global"}:*`;
  }

  /**
   * Helper: Extract policy ID from key
   */
  private extractPolicyIdFromKey(key: string): string {
    const parts = key.split(":");
    return parts[parts.length - 1];
  }
}
