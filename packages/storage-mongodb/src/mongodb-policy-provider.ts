import type { PolicyDocument } from "@autorix/core";
import type { Collection, Db } from "mongodb";
import type {
  AutorixScope,
  GetPoliciesInput,
  PolicyProvider,
  PolicySource,
  PrincipalRef,
  PrincipalType,
} from "@autorix/storage";

/**
 * MongoDB document schemas
 */
interface PolicyDoc {
  _id: string;
  scopeType: string;
  scopeId: string | null;
  document: PolicyDocument;
  createdAt: Date;
  updatedAt: Date;
}

interface AttachmentDoc {
  policyId: string;
  scopeType: string;
  scopeId: string | null;
  principalType: string;
  principalId: string;
  createdAt: Date;
}

/**
 * MongoDB implementation of PolicyProvider
 * 
 * ## Collections
 * - `policies`: Stores policy documents
 * - `policy_attachments`: Stores policy-to-principal mappings
 * 
 * ## Usage
 * 
 * ```typescript
 * import { MongoClient } from 'mongodb';
 * import { MongoDBPolicyProvider } from '@autorix/storage-mongodb';
 * 
 * const client = new MongoClient('mongodb://localhost:27017');
 * await client.connect();
 * const db = client.db('myapp');
 * 
 * const provider = new MongoDBPolicyProvider(db);
 * 
 * // Create indexes (recommended)
 * await provider.createIndexes();
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
 * ```
 */
export class MongoDBPolicyProvider implements PolicyProvider {
  private policies: Collection<PolicyDoc>;
  private attachments: Collection<AttachmentDoc>;

  constructor(db: Db) {
    this.policies = db.collection<PolicyDoc>("policies");
    this.attachments = db.collection<AttachmentDoc>("policy_attachments");
  }

  /**
   * Get all policies applicable to a principal within a scope.
   * 
   * Uses MongoDB aggregation to find attachments, then fetches policies.
   * 
   * @param input - Query parameters
   * @returns Array of policy sources
   */
  async getPolicies(input: GetPoliciesInput): Promise<PolicySource[]> {
    const { scope, principal, roleIds = [], groupIds = [] } = input;

    // Build list of principals to match
    const principalsToMatch: Array<{ type: PrincipalType; id: string }> = [
      { type: principal.type, id: principal.id },
      ...roleIds.map((id) => ({ type: "ROLE" as const, id })),
      ...groupIds.map((id) => ({ type: "GROUP" as const, id })),
    ];

    // Find all policy IDs attached to these principals in this scope
    const attachmentDocs = await this.attachments
      .find({
        scopeType: scope.type,
        scopeId: scope.id ?? null,
        $or: principalsToMatch.map((p) => ({
          principalType: p.type,
          principalId: p.id,
        })),
      })
      .toArray();

    const policyIds = [...new Set(attachmentDocs.map((a) => a.policyId))];

    if (policyIds.length === 0) {
      return [];
    }

    // Fetch the actual policies
    const policyDocs = await this.policies
      .find({
        _id: { $in: policyIds },
        scopeType: scope.type,
        scopeId: scope.id ?? null,
      })
      .toArray();

    return policyDocs.map((doc) => ({
      id: doc._id,
      document: doc.document,
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
    await this.policies.updateOne(
      { _id: params.id },
      {
        $set: {
          scopeType: params.scope.type,
          scopeId: params.scope.id ?? null,
          document: params.document,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
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
    await this.attachments.updateOne(
      {
        policyId: params.policyId,
        scopeType: params.scope.type,
        scopeId: params.scope.id ?? null,
        principalType: params.principal.type,
        principalId: params.principal.id,
      },
      {
        $setOnInsert: {
          policyId: params.policyId,
          scopeType: params.scope.type,
          scopeId: params.scope.id ?? null,
          principalType: params.principal.type,
          principalId: params.principal.id,
          createdAt: new Date(),
        },
      },
      { upsert: true }
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
    await this.attachments.deleteOne({
      policyId: params.policyId,
      scopeType: params.scope.type,
      scopeId: params.scope.id ?? null,
      principalType: params.principal.type,
      principalId: params.principal.id,
    });
  }

  /**
   * Delete a policy and all its attachments
   */
  async deletePolicy(policyId: string): Promise<void> {
    await Promise.all([
      this.policies.deleteOne({ _id: policyId }),
      this.attachments.deleteMany({ policyId }),
    ]);
  }

  /**
   * Create recommended indexes for optimal query performance.
   * 
   * Should be called once at application startup.
   * 
   * @example
   * ```typescript
   * const provider = new MongoDBPolicyProvider(db);
   * await provider.createIndexes();
   * ```
   */
  async createIndexes(): Promise<void> {
    await Promise.all([
      this.policies.createIndex({ scopeType: 1, scopeId: 1 }),
      this.attachments.createIndex({
        scopeType: 1,
        scopeId: 1,
        principalType: 1,
        principalId: 1,
      }),
      this.attachments.createIndex({ policyId: 1 }),
    ]);
  }
}
