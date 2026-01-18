import type { PolicyDocument } from "@autorix/core";
import type { Pool } from "pg";
import type {
  AutorixScope,
  GetPoliciesInput,
  PolicyProvider,
  PolicySource,
  PrincipalRef,
  PrincipalType,
} from "@autorix/storage";

/**
 * PostgreSQL implementation of PolicyProvider
 * 
 * ## Database Schema
 * 
 * ```sql
 * CREATE TABLE policies (
 *   id VARCHAR(255) PRIMARY KEY,
 *   scope_type VARCHAR(50) NOT NULL,
 *   scope_id VARCHAR(255),
 *   document JSONB NOT NULL,
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 * );
 * 
 * CREATE TABLE policy_attachments (
 *   id SERIAL PRIMARY KEY,
 *   policy_id VARCHAR(255) NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
 *   scope_type VARCHAR(50) NOT NULL,
 *   scope_id VARCHAR(255),
 *   principal_type VARCHAR(50) NOT NULL,
 *   principal_id VARCHAR(255) NOT NULL,
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   UNIQUE(policy_id, scope_type, scope_id, principal_type, principal_id)
 * );
 * 
 * CREATE INDEX idx_attachments_lookup 
 *   ON policy_attachments(scope_type, scope_id, principal_type, principal_id);
 * ```
 * 
 * ## Usage
 * 
 * ```typescript
 * import { Pool } from 'pg';
 * import { PostgresPolicyProvider } from '@autorix/storage-postgres';
 * 
 * const pool = new Pool({
 *   host: 'localhost',
 *   database: 'myapp',
 *   user: 'postgres',
 *   password: 'password',
 * });
 * 
 * const provider = new PostgresPolicyProvider(pool);
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
 */
export class PostgresPolicyProvider implements PolicyProvider {
  constructor(private pool: Pool) {}

  async getPolicies(input: GetPoliciesInput): Promise<PolicySource[]> {
    const { scope, principal, roleIds = [], groupIds = [] } = input;

    // Build list of principals to match (user + roles + groups)
    const principalsToMatch: Array<{ type: PrincipalType; id: string }> = [
      { type: principal.type, id: principal.id },
      ...roleIds.map((id) => ({ type: "ROLE" as const, id })),
      ...groupIds.map((id) => ({ type: "GROUP" as const, id })),
    ];

    // Build WHERE clause for principal matching
    const principalConditions = principalsToMatch.map((_, idx) => {
      return `(pa.principal_type = $${3 + idx * 2} AND pa.principal_id = $${4 + idx * 2})`;
    });

    const query = `
      SELECT DISTINCT p.id, p.document
      FROM policies p
      INNER JOIN policy_attachments pa ON p.id = pa.policy_id
      WHERE p.scope_type = $1
        AND p.scope_id ${scope.id === null ? "IS NULL" : "= $2"}
        AND pa.scope_type = $1
        AND pa.scope_id ${scope.id === null ? "IS NULL" : "= $2"}
        AND (${principalConditions.join(" OR ")})
    `;

    // Build parameters array
    const params = [
      scope.type,
      ...(scope.id !== null ? [scope.id] : []),
      ...principalsToMatch.flatMap((p) => [p.type, p.id]),
    ];

    const result = await this.pool.query(query, params);

    return result.rows.map((row) => ({
      id: row.id,
      document: row.document as PolicyDocument,
    }));
  }

  /**
   * Add or update a policy
   */
  async addPolicy(params: {
    id: string;
    scope: AutorixScope;
    document: PolicyDocument;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO policies (id, scope_type, scope_id, document)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE 
       SET document = $4, updated_at = CURRENT_TIMESTAMP`,
      [params.id, params.scope.type, params.scope.id, JSON.stringify(params.document)]
    );
  }

  /**
   * Attach a policy to a principal (user, role, or group)
   */
  async attachPolicy(params: {
    policyId: string;
    scope: AutorixScope;
    principal: PrincipalRef;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO policy_attachments (policy_id, scope_type, scope_id, principal_type, principal_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (policy_id, scope_type, scope_id, principal_type, principal_id) DO NOTHING`,
      [
        params.policyId,
        params.scope.type,
        params.scope.id,
        params.principal.type,
        params.principal.id,
      ]
    );
  }

  /**
   * Remove a policy attachment
   */
  async detachPolicy(params: {
    policyId: string;
    scope: AutorixScope;
    principal: PrincipalRef;
  }): Promise<void> {
    await this.pool.query(
      `DELETE FROM policy_attachments
       WHERE policy_id = $1
         AND scope_type = $2
         AND scope_id ${params.scope.id === null ? "IS NULL" : "= $3"}
         AND principal_type = $${params.scope.id === null ? 3 : 4}
         AND principal_id = $${params.scope.id === null ? 4 : 5}`,
      [
        params.policyId,
        params.scope.type,
        ...(params.scope.id !== null ? [params.scope.id] : []),
        params.principal.type,
        params.principal.id,
      ]
    );
  }

  /**
   * Delete a policy and all its attachments (cascade delete)
   */
  async deletePolicy(policyId: string): Promise<void> {
    await this.pool.query(`DELETE FROM policies WHERE id = $1`, [policyId]);
  }

  /**
   * Initialize database schema (for development/testing)
   */
  async initSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS policies (
        id VARCHAR(255) PRIMARY KEY,
        scope_type VARCHAR(50) NOT NULL,
        scope_id VARCHAR(255),
        document JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS policy_attachments (
        id SERIAL PRIMARY KEY,
        policy_id VARCHAR(255) NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
        scope_type VARCHAR(50) NOT NULL,
        scope_id VARCHAR(255),
        principal_type VARCHAR(50) NOT NULL,
        principal_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(policy_id, scope_type, scope_id, principal_type, principal_id)
      );

      CREATE INDEX IF NOT EXISTS idx_attachments_lookup 
        ON policy_attachments(scope_type, scope_id, principal_type, principal_id);
    `);
  }
}
