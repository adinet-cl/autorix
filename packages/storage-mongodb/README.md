# @autorix/storage-mongodb

MongoDB adapter for Autorix policy storage.

## Installation

```bash
npm install @autorix/storage-mongodb mongodb
# or
pnpm add @autorix/storage-mongodb mongodb
```

## Collections

### `policies`
```javascript
{
  _id: "admin-policy",              // Unique policy identifier
  scopeType: "TENANT",               // Scope type
  scopeId: "t1",                     // Scope identifier (nullable)
  document: { ... },                 // Policy document (JSONB)
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### `policy_attachments`
```javascript
{
  policyId: "admin-policy",          // Reference to policy
  scopeType: "TENANT",
  scopeId: "t1",
  principalType: "USER",             // USER, ROLE, or GROUP
  principalId: "u1",
  createdAt: ISODate("...")
}
```

## Usage

```typescript
import { MongoClient } from 'mongodb';
import { MongoDBPolicyProvider } from '@autorix/storage-mongodb';

// Connect to MongoDB
const client = new MongoClient('mongodb://localhost:27017');
await client.connect();
const db = client.db('myapp');

const provider = new MongoDBPolicyProvider(db);

// Create indexes (recommended - do once at startup)
await provider.createIndexes();

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

### `new MongoDBPolicyProvider(db: Db)`

Create a new MongoDB policy provider.

**Parameters:**
- `db`: MongoDB Db instance

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

Delete a policy and all its attachments.

### `createIndexes(): Promise<void>`

Create recommended indexes for optimal query performance. Run this once at application startup.

## Indexes

The following indexes are recommended:

```javascript
db.policies.createIndex({ scopeType: 1, scopeId: 1 })
db.policy_attachments.createIndex({ 
  scopeType: 1, 
  scopeId: 1, 
  principalType: 1, 
  principalId: 1 
})
db.policy_attachments.createIndex({ policyId: 1 })
```

Use the `createIndexes()` method to create them automatically.

## License

MIT
