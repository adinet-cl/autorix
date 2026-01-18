import type { PolicyDocument } from "@autorix/core";
import type {
  AutorixScope,
  GetPoliciesInput,
  PolicyProvider,
  PolicySource,
  PrincipalRef,
  PrincipalType,
} from "@autorix/storage";

// Using generic type to avoid requiring @prisma/client during build
type PrismaClient = any;

/**
 * Prisma implementation of PolicyProvider
 * 
 * ## Prisma Schema
 * 
 * Add this to your `schema.prisma`:
 * 
 * ```prisma
 * model Policy {
 *   id        String   @id
 *   scopeType String
 *   scopeId   String?
 *   document  Json
 *   createdAt DateTime @default(now())
 *   updatedAt DateTime @updatedAt
 * 
 *   attachments PolicyAttachment[]
 * 
 *   @@index([scopeType, scopeId])
 * }
 * 
 * model PolicyAttachment {
 *   id            Int      @id @default(autoincrement())
 *   policyId      String
 *   scopeType     String
 *   scopeId       String?
 *   principalType String
 *   principalId   String
 *   createdAt     DateTime @default(now())
 * 
 *   policy Policy @relation(fields: [policyId], references: [id], onDelete: Cascade)
 * 
 *   @@unique([policyId, scopeType, scopeId, principalType, principalId])
 *   @@index([scopeType, scopeId, principalType, principalId])
 * }
 * ```
 * 
 * ## Usage
 * 
 * ```typescript
 * import { PrismaClient } from '@prisma/client';
 * import { PrismaPolicyProvider } from '@autorix/storage-prisma';
 * 
 * const prisma = new PrismaClient();
 * const provider = new PrismaPolicyProvider(prisma);
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
export class PrismaPolicyProvider implements PolicyProvider {
  constructor(private prisma: PrismaClient) {}

  async getPolicies(input: GetPoliciesInput): Promise<PolicySource[]> {
    const { scope, principal, roleIds = [], groupIds = [] } = input;

    // Build list of principals to match
    const principalsToMatch: Array<{ type: PrincipalType; id: string }> = [
      { type: principal.type, id: principal.id },
      ...roleIds.map((id) => ({ type: "ROLE" as const, id })),
      ...groupIds.map((id) => ({ type: "GROUP" as const, id })),
    ];

    // Query with Prisma
    const policies = await this.prisma.policy.findMany({
      where: {
        scopeType: scope.type,
        scopeId: scope.id ?? null,
        attachments: {
          some: {
            scopeType: scope.type,
            scopeId: scope.id ?? null,
            OR: principalsToMatch.map((p) => ({
              principalType: p.type,
              principalId: p.id,
            })),
          },
        },
      },
      select: {
        id: true,
        document: true,
      },
    });

    return policies.map((policy: any) => ({
      id: policy.id,
      document: policy.document as PolicyDocument,
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
    await this.prisma.policy.upsert({
      where: { id: params.id },
      create: {
        id: params.id,
        scopeType: params.scope.type,
        scopeId: params.scope.id ?? null,
        document: params.document as any,
      },
      update: {
        document: params.document as any,
      },
    });
  }

  /**
   * Attach a policy to a principal (user, role, or group)
   */
  async attachPolicy(params: {
    policyId: string;
    scope: AutorixScope;
    principal: PrincipalRef;
  }): Promise<void> {
    await this.prisma.policyAttachment.upsert({
      where: {
        policyId_scopeType_scopeId_principalType_principalId: {
          policyId: params.policyId,
          scopeType: params.scope.type,
          scopeId: params.scope.id ?? null,
          principalType: params.principal.type,
          principalId: params.principal.id,
        },
      },
      create: {
        policyId: params.policyId,
        scopeType: params.scope.type,
        scopeId: params.scope.id ?? null,
        principalType: params.principal.type,
        principalId: params.principal.id,
      },
      update: {},
    });
  }

  /**
   * Remove a policy attachment
   */
  async detachPolicy(params: {
    policyId: string;
    scope: AutorixScope;
    principal: PrincipalRef;
  }): Promise<void> {
    await this.prisma.policyAttachment.deleteMany({
      where: {
        policyId: params.policyId,
        scopeType: params.scope.type,
        scopeId: params.scope.id ?? null,
        principalType: params.principal.type,
        principalId: params.principal.id,
      },
    });
  }

  /**
   * Delete a policy and all its attachments (cascade)
   */
  async deletePolicy(policyId: string): Promise<void> {
    // Cascade delete is handled by the schema
    await this.prisma.policy.delete({
      where: { id: policyId },
    });
  }

  /**
   * Batch attach multiple policies at once for better performance
   */
  async attachPolicies(
    params: Array<{
      policyId: string;
      scope: AutorixScope;
      principal: PrincipalRef;
    }>
  ): Promise<void> {
    await this.prisma.policyAttachment.createMany({
      data: params.map((p) => ({
        policyId: p.policyId,
        scopeType: p.scope.type,
        scopeId: p.scope.id ?? null,
        principalType: p.principal.type,
        principalId: p.principal.id,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Batch detach multiple policies at once
   */
  async detachPolicies(
    params: Array<{
      policyId: string;
      scope: AutorixScope;
      principal: PrincipalRef;
    }>
  ): Promise<void> {
    await this.prisma.policyAttachment.deleteMany({
      where: {
        OR: params.map((p) => ({
          policyId: p.policyId,
          scopeType: p.scope.type,
          scopeId: p.scope.id ?? null,
          principalType: p.principal.type,
          principalId: p.principal.id,
        })),
      },
    });
  }
}
