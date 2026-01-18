# @autorix/storage-postgres

PostgreSQL adapter for Autorix policy storage.

## Installation

```bash
npm install @autorix/storage-postgres pg
# or
pnpm add @autorix/storage-postgres pg
```

## Database Schema

```sql
CREATE TABLE policies (
  id VARCHAR(255) PRIMARY KEY,
  scope_type VARCHAR(50) NOT NULL,
  scope_id VARCHAR(255),
  document JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE policy_attachments (
  id SERIAL PRIMARY KEY,
  policy_id VARCHAR(255) NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  scope_type VARCHAR(50) NOT NULL,
  scope_id VARCHAR(255),
  principal_type VARCHAR(50) NOT NULL,
  principal_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(policy_id, scope_type, scope_id, principal_type, principal_id)
);

CREATE INDEX idx_attachments_lookup 
  ON policy_attachments(scope_type, scope_id, principal_type, principal_id);
```

## Usage

```typescript
import { Pool } from 'pg';
import { PostgresPolicyProvider } from '@autorix/storage-postgres';

// Create connection pool
const pool = new Pool({
  host: 'localhost',
  database: 'myapp',
  user: 'postgres',
  password: 'password',
});

const provider = new PostgresPolicyProvider(pool);

// Initialize schema (optional - for development/testing)
await provider.initSchema();

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

### `new PostgresPolicyProvider(pool: Pool)`

Create a new PostgreSQL policy provider.

**Parameters:**
- `pool`: pg Pool instance

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

Delete a policy and all its attachments (cascade).

### `initSchema(): Promise<void>`

Initialize the database schema. Useful for development/testing. In production, use migrations.

## License

MIT
