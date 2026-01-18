# @autorix/storage-prisma

Prisma ORM adapter for Autorix policy storage.

## Installation

```bash
npm install @autorix/storage-prisma @prisma/client
# or
pnpm add @autorix/storage-prisma @prisma/client
```

## Prisma Schema

Add these models to your `schema.prisma`:

```prisma
model Policy {
  id        String   @id
  scopeType String
  scopeId   String?
  document  Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  attachments PolicyAttachment[]

  @@index([scopeType, scopeId])
}

model PolicyAttachment {
  id            Int      @id @default(autoincrement())
  policyId      String
  scopeType     String
  scopeId       String?
  principalType String
  principalId   String
  createdAt     DateTime @default(now())

  policy Policy @relation(fields: [policyId], references: [id], onDelete: Cascade)

  @@unique([policyId, scopeType, scopeId, principalType, principalId])
  @@index([scopeType, scopeId, principalType, principalId])
}
```

Then run:

```bash
npx prisma migrate dev --name add_autorix_policies
# or
npx prisma db push
```

## Usage

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaPolicyProvider } from '@autorix/storage-prisma';

const prisma = new PrismaClient();
const provider = new PrismaPolicyProvider(prisma);

// Add a policy
await provider.addPolicy({
  id: 'admin-policy',
  scope: { type: 'TENANT', id: 't1' },
  document: {
    statements: [
      {
        effect: 'allow',
        actions: ['*'],
        resources: ['*']
      }
    ]
  }
});

// Attach policy to a user
await provider.attachPolicy({
  policyId: 'admin-policy',
  scope: { type: 'TENANT', id: 't1' },
  principal: { type: 'USER', id: 'u1' }
});

// Batch operations for better performance
await provider.attachPolicies([
  {
    policyId: 'admin-policy',
    scope: { type: 'TENANT', id: 't1' },
    principal: { type: 'USER', id: 'u1' }
  },
  {
    policyId: 'editor-policy',
    scope: { type: 'TENANT', id: 't1' },
    principal: { type: 'USER', id: 'u2' }
  }
]);

// Use with Express
import { autorixExpress } from '@autorix/express';

app.use(autorixExpress({
  enforcer: {
    policyProvider: provider,
    can: async ({ action, resource, context }) => {
      const { evaluateAll } = await import('@autorix/core');
      
      const policies = await provider.getPolicies({
        scope: context.scope,
        principal: context.principal,
        roleIds: context.roleIds,
        groupIds: context.groupIds,
      });

      const result = evaluateAll({
        policies: policies.map(p => p.document),
        input: {
          action,
          resource: context.resourceObject ?? {},
          principal: context.principal,
          context: context.environment ?? {}
        }
      });

      return result.decision === 'allow';
    }
  },
  // ... other options
}));
```

## API

### `new PrismaPolicyProvider(prisma: PrismaClient)`

Create a new Prisma policy provider.

**Parameters:**
- `prisma`: PrismaClient instance

### `getPolicies(input: GetPoliciesInput): Promise<PolicySource[]>`

Get all policies attached to a principal within a scope. Called by the enforcer.

### `addPolicy(params): Promise<void>`

Add or update a policy.

**Parameters:**
- `id`: Unique policy identifier
- `scope`: Policy scope (tenant/workspace/etc)
- `document`: Policy document

### `attachPolicy(params): Promise<void>`

Attach a policy to a principal (user, role, or group).

**Parameters:**
- `policyId`: Policy ID to attach
- `scope`: Scope for the attachment
- `principal`: Principal to attach to (user/role/group)

### `detachPolicy(params): Promise<void>`

Remove a policy attachment.

### `deletePolicy(policyId: string): Promise<void>`

Delete a policy and all its attachments (cascade delete).

### `attachPolicies(params[]): Promise<void>`

Batch attach multiple policies for better performance.

### `detachPolicies(params[]): Promise<void>`

Batch detach multiple policies.

## Type Safety

Prisma provides full type safety and autocomplete for all operations. The adapter works with any database supported by Prisma (PostgreSQL, MySQL, SQLite, SQL Server, MongoDB, CockroachDB).

## License

MIT
