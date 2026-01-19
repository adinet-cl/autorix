# @autorix/storage

**Policy Storage Interface for Autorix** - Extensible storage abstraction for managing and retrieving authorization policies.

## 📋 Overview

`@autorix/storage` provides the core `PolicyProvider` interface and types for managing Autorix policies. It defines the contract that storage adapters must implement, allowing you to use any database or storage backend.

## ✨ Features

- 🔌 **Provider Interface** - Clean abstraction for policy storage
- 💾 **Memory Provider** - Built-in in-memory storage for development and testing
- 🗄️ **Database Adapters** - Official adapters for PostgreSQL, MongoDB, and Prisma (separate packages)
- 🎯 **Scope-aware** - Multi-tenant and hierarchical scope support
- 👥 **Principal Types** - Support for users, roles, and groups
- 🔗 **Policy Attachments** - Flexible policy-to-principal binding
- 📦 **Type-safe** - Full TypeScript support
- 🚀 **Zero dependencies** - Lightweight (only depends on @autorix/core)

## 📦 Installation

### Core Package (includes MemoryPolicyProvider)

```bash
npm install @autorix/storage @autorix/core
# or
pnpm add @autorix/storage @autorix/core
```

### Database Adapters (Optional)

Choose the adapter for your database:

```bash
# PostgreSQL
npm install @autorix/storage-postgres pg

# MongoDB
npm install @autorix/storage-mongodb mongodb

# Prisma (works with PostgreSQL, MySQL, SQLite, etc.)
npm install @autorix/storage-prisma @prisma/client
```

## 🚀 Quick Start

### Using Memory Provider (Development/Testing)

```typescript
import { MemoryPolicyProvider } from '@autorix/storage';
import type { PolicyDocument } from '@autorix/core';

// Create provider
const provider = new MemoryPolicyProvider();

// Add policies
provider.addPolicy({
  id: 'policy-1',
  scope: { type: 'TENANT', id: 'tenant-123' },
  document: {
    statements: [
      {
        effect: 'allow',
        actions: ['document:*'],
        resources: ['document/*'],
      },
    ],
  },
});

// Attach policy to a user
provider.attachPolicy({
  policyId: 'policy-1',
  scope: { type: 'TENANT', id: 'tenant-123' },
  principal: { type: 'USER', id: 'user-456' },
});

// Retrieve policies for a principal
const policies = await provider.getPolicies({
  scope: { type: 'TENANT', id: 'tenant-123' },
  principal: { type: 'USER', id: 'user-456' },
});

console.log(policies);
// [{ id: 'policy-1', document: { ... } }]
```

### Using Database Adapters (Production)

For production environments, use one of the database adapters:

```typescript
// PostgreSQL
import { PostgresPolicyProvider } from '@autorix/storage-postgres';
import { Pool } from 'pg';

const pool = new Pool({ /* connection config */ });
const provider = new PostgresPolicyProvider(pool);
await provider.initSchema(); // Initialize tables

// MongoDB
import { MongoDBPolicyProvider } from '@autorix/storage-mongodb';
import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb://localhost:27017');
await client.connect();
const provider = new MongoDBPolicyProvider(client.db('myapp'));
await provider.createIndexes(); // Create indexes

// Prisma
import { PrismaPolicyProvider } from '@autorix/storage-prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const provider = new PrismaPolicyProvider(prisma);
// Run: npx prisma migrate dev

// Redis
import { RedisPolicyProvider } from '@autorix/storage-redis';
import { createClient } from 'redis';

const redis = createClient({ url: 'redis://localhost:6379' });
await redis.connect();
const provider = new RedisPolicyProvider(redis);
```

## 📚 Core Concepts

### Policy Provider Interface

The base interface that all storage providers must implement:

```typescript
interface PolicyProvider {
  getPolicies(input: GetPoliciesInput): Promise<PolicySource[]>;
}
```

All database adapters implement this interface, allowing you to switch between storage backends without changing your application code.

### Scope

Defines the organizational boundary for policies:

```typescript
type ScopeType = 'PLATFORM' | 'TENANT' | 'WORKSPACE' | 'APP';

interface AutorixScope {
  type: ScopeType;
  id?: string;
}
```

**Scope Examples:**
- `{ type: 'PLATFORM' }` - Global/platform-wide policies
- `{ type: 'TENANT', id: 'tenant-123' }` - Tenant-specific policies
- `{ type: 'WORKSPACE', id: 'ws-456' }` - Workspace-specific policies
- `{ type: 'APP', id: 'app-789' }` - Application-specific policies

### Principal

Represents an entity that can have policies attached:

```typescript
type PrincipalType = 'USER' | 'ROLE' | 'GROUP';

interface PrincipalRef {
  type: PrincipalType;
  id: string;
}
```

**Principal Examples:**
- `{ type: 'USER', id: 'user-123' }` - Individual user
- `{ type: 'ROLE', id: 'admin' }` - Role-based
- `{ type: 'GROUP', id: 'engineering' }` - Group-based

### Policy Source

The stored policy with its document:

```typescript
interface PolicySource {
  id: string;
  document: PolicyDocument;
}
```

### Get Policies Input

Parameters for retrieving policies:

```typescript
interface GetPoliciesInput {
  scope: AutorixScope;
  principal: PrincipalRef;
  roleIds?: string[];
  groupIds?: string[];
}
```

## 🔧 Memory Provider API

### Constructor

```typescript
const provider = new MemoryPolicyProvider();
```

### `addPolicy(policy: PolicyRecord): this`

Adds a policy to the provider.

```typescript
provider.addPolicy({
  id: 'read-policy',
  scope: { type: 'TENANT', id: 'tenant-123' },
  document: {
    Statement: [
      {
        Effect: 'Allow',
        Action: ['document:read', 'document:list'],
        Resource: '*',
      },
    ],
  },
});
```

### `attachPolicy(params): this`

Attaches a policy to a principal within a scope.

```typescript
provider.attachPolicy({
  policyId: 'read-policy',
  scope: { type: 'TENANT', id: 'tenant-123' },
  principal: { type: 'USER', id: 'user-456' },
});
```

### `getPolicies(input: GetPoliciesInput): Promise<PolicySource[]>`

Retrieves all policies applicable to a principal.

```typescript
const policies = await provider.getPolicies({
  scope: { type: 'TENANT', id: 'tenant-123' },
  principal: { type: 'USER', id: 'user-456' },
  roleIds: ['admin', 'editor'],
  groupIds: ['engineering'],
});
```

## 🎯 Available Storage Adapters

### Built-in: Memory Provider

Perfect for development, testing, and small applications. Included in this package.

```typescript
import { MemoryPolicyProvider } from '@autorix/storage';

const provider = new MemoryPolicyProvider();
```

**Use cases:** Development, testing, prototyping, serverless functions with ephemeral state

### PostgreSQL Adapter

Production-ready adapter for PostgreSQL databases.

```typescript
import { Pool } from 'pg';
import { PostgresPolicyProvider } from '@autorix/storage-postgres';

const pool = new Pool({ /* config */ });
const provider = new PostgresPolicyProvider(pool);
```

📦 **Package:** `@autorix/storage-postgres`  
📖 **[Full Documentation](https://www.npmjs.com/package/@autorix/storage-postgres)**

### MongoDB Adapter

NoSQL adapter for MongoDB databases.

```typescript
import { MongoClient } from 'mongodb';
import { MongoDBPolicyProvider } from '@autorix/storage-mongodb';

const client = new MongoClient('mongodb://localhost:27017');
await client.connect();
const db = client.db('myapp');
const provider = new MongoDBPolicyProvider(db);
```

📦 **Package:** `@autorix/storage-mongodb`  
📖 **[Full Documentation](https://www.npmjs.com/package/@autorix/storage-mongodb)**

### Prisma Adapter

Type-safe ORM adapter that works with PostgreSQL, MySQL, SQLite, SQL Server, MongoDB, and CockroachDB.

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaPolicyProvider } from '@autorix/storage-prisma';

const prisma = new PrismaClient();
const provider = new PrismaPolicyProvider(prisma);
```

📦 **Package:** `@autorix/storage-prisma`  
📖 **[Full Documentation](https://www.npmjs.com/package/@autorix/storage-prisma)**

### Redis Adapter

High-performance in-memory adapter for distributed systems. Perfect as a cache layer or for temporary policies.

```typescript
import { createClient } from 'redis';
import { RedisPolicyProvider } from '@autorix/storage-redis';

const redis = createClient({ url: 'redis://localhost:6379' });
await redis.connect();
const provider = new RedisPolicyProvider(redis);
```

📦 **Package:** `@autorix/storage-redis`  
📖 **[Full Documentation](https://www.npmjs.com/package/@autorix/storage-redis)**

**Features:** TTL support, Redis Cluster compatible, batch operations, cache layer patterns

### Custom Adapters

You can create your own adapter for any database by implementing the `PolicyProvider` interface:

```typescript
import type { PolicyProvider, GetPoliciesInput, PolicySource } from '@autorix/storage';

class MyCustomProvider implements PolicyProvider {
  async getPolicies(input: GetPoliciesInput): Promise<PolicySource[]> {
    // Your implementation here
    // Query your database and return policies
  }
}
```

## 🔧 Memory Provider API

The built-in `MemoryPolicyProvider` includes additional methods for managing policies:

### Constructor

```typescript
const provider = new MemoryPolicyProvider();
```

### `addPolicy(policy: PolicyRecord): this`

Adds a policy to the provider.

```typescript
provider.addPolicy({
  id: 'read-policy',
  scope: { type: 'TENANT', id: 'tenant-123' },
  document: {
    Statement: [
      {
        Effect: 'Allow',
        Action: ['document:read', 'document:list'],
        Resource: '*',
      },
    ],
  },
});
```

### `attachPolicy(params): this`

Attaches a policy to a principal within a scope.

```typescript
provider.attachPolicy({
  policyId: 'read-policy',
  scope: { type: 'TENANT', id: 'tenant-123' },
  principal: { type: 'USER', id: 'user-456' },
});
```

### `getPolicies(input: GetPoliciesInput): Promise<PolicySource[]>`

Retrieves all policies applicable to a principal.

```typescript
const policies = await provider.getPolicies({
  scope: { type: 'TENANT', id: 'tenant-123' },
  principal: { type: 'USER', id: 'user-456' },
  roleIds: ['admin', 'editor'],
  groupIds: ['engineering'],
});
```

## 🎯 Usage Examples

### Role-based Policies

```typescript
const provider = new MemoryPolicyProvider();

// Add admin policy
provider.addPolicy({
  id: 'admin-policy',
  scope: { type: 'TENANT', id: 'tenant-123' },
  document: {
    Statement: [
      {
        Effect: 'Allow',
        Action: '*',
        Resource: '*',
      },
    ],
  },
});

// Attach to admin role
provider.attachPolicy({
  policyId: 'admin-policy',
  scope: { type: 'TENANT', id: 'tenant-123' },
  principal: { type: 'ROLE', id: 'admin' },
});

// Get policies for a user with admin role
const policies = await provider.getPolicies({
  scope: { type: 'TENANT', id: 'tenant-123' },
  principal: { type: 'USER', id: 'user-123' },
  roleIds: ['admin'], // User has admin role
});

// Returns: [{ id: 'admin-policy', document: { ... } }]
```

### Group-based Policies

```typescript
const provider = new MemoryPolicyProvider();

// Add engineering group policy
provider.addPolicy({
  id: 'eng-policy',
  scope: { type: 'TENANT', id: 'tenant-123' },
  document: {
    Statement: [
      {
        Effect: 'Allow',
        Action: ['repo:*', 'deploy:*'],
        Resource: '*',
      },
    ],
  },
});

// Attach to engineering group
provider.attachPolicy({
  policyId: 'eng-policy',
  scope: { type: 'TENANT', id: 'tenant-123' },
  principal: { type: 'GROUP', id: 'engineering' },
});

// Get policies for a user in engineering group
const policies = await provider.getPolicies({
  scope: { type: 'TENANT', id: 'tenant-123' },
  principal: { type: 'USER', id: 'user-456' },
  groupIds: ['engineering'],
});
```

### Multiple Policy Attachments

```typescript
const provider = new MemoryPolicyProvider();

// Add policies
provider
  .addPolicy({
    id: 'base-user-policy',
    scope: { type: 'TENANT', id: 'tenant-123' },
    document: {
      Statement: [
        {
          Effect: 'Allow',
          Action: ['document:read', 'document:list'],
          Resource: '*',
        },
      ],
    },
  })
  .addPolicy({
    id: 'editor-policy',
    scope: { type: 'TENANT', id: 'tenant-123' },
    document: {
      Statement: [
        {
          Effect: 'Allow',
          Action: ['document:create', 'document:update'],
          Resource: '*',
        },
      ],
    },
  })
  .addPolicy({
    id: 'team-policy',
    scope: { type: 'TENANT', id: 'tenant-123' },
    document: {
      Statement: [
        {
          Effect: 'Allow',
          Action: 'project:*',
          Resource: 'project/*',
        },
      ],
    },
  });

// Attach to user directly
provider.attachPolicy({
  policyId: 'base-user-policy',
  scope: { type: 'TENANT', id: 'tenant-123' },
  principal: { type: 'USER', id: 'user-123' },
});

// Attach to editor role
provider.attachPolicy({
  policyId: 'editor-policy',
  scope: { type: 'TENANT', id: 'tenant-123' },
  principal: { type: 'ROLE', id: 'editor' },
});

// Attach to team group
provider.attachPolicy({
  policyId: 'team-policy',
  scope: { type: 'TENANT', id: 'tenant-123' },
  principal: { type: 'GROUP', id: 'team-alpha' },
});

// Get all policies for user with role and group
const policies = await provider.getPolicies({
  scope: { type: 'TENANT', id: 'tenant-123' },
  principal: { type: 'USER', id: 'user-123' },
  roleIds: ['editor'],
  groupIds: ['team-alpha'],
});

// Returns 3 policies: base-user-policy, editor-policy, team-policy
```

### Hierarchical Scopes

```typescript
const provider = new MemoryPolicyProvider();

// Platform-wide policy
provider
  .addPolicy({
    id: 'platform-policy',
    scope: { type: 'PLATFORM' },
    document: {
      Statement: [
        {
          Effect: 'Deny',
          Action: 'system:delete',
          Resource: '*',
        },
      ],
    },
  })
  .attachPolicy({
    policyId: 'platform-policy',
    scope: { type: 'PLATFORM' },
    principal: { type: 'USER', id: 'user-123' },
  });

// Tenant-specific policy
provider
  .addPolicy({
    id: 'tenant-policy',
    scope: { type: 'TENANT', id: 'tenant-123' },
    document: {
      Statement: [
        {
          Effect: 'Allow',
          Action: 'document:*',
          Resource: '*',
        },
      ],
    },
  })
  .attachPolicy({
    policyId: 'tenant-policy',
    scope: { type: 'TENANT', id: 'tenant-123' },
    principal: { type: 'USER', id: 'user-123' },
  });

// Get tenant policies only (platform policies need separate query)
const tenantPolicies = await provider.getPolicies({
  scope: { type: 'TENANT', id: 'tenant-123' },
  principal: { type: 'USER', id: 'user-123' },
});
```

## 🔍 Examples

### Example 1: Simple User Permissions

```typescript
import { MemoryPolicyProvider } from '@autorix/storage';

const provider = new MemoryPolicyProvider();

// Create read-only policy
provider.addPolicy({
  id: 'readonly',
  scope: { type: 'TENANT', id: 'acme-corp' },
  document: {
    Statement: [
      {
        Effect: 'Allow',
        Action: ['*:read', '*:list'],
        Resource: '*',
      },
    ],
  },
});

// Assign to user
provider.attachPolicy({
  policyId: 'readonly',
  scope: { type: 'TENANT', id: 'acme-corp' },
  principal: { type: 'USER', id: 'viewer-1' },
});

// Query policies
const policies = await provider.getPolicies({
  scope: { type: 'TENANT', id: 'acme-corp' },
  principal: { type: 'USER', id: 'viewer-1' },
});
```

### Example 2: Role-based Access Control

```typescript
const provider = new MemoryPolicyProvider();

// Admin policy
provider
  .addPolicy({
    id: 'admin-full-access',
    scope: { type: 'TENANT', id: 'acme-corp' },
    document: {
      Statement: [{ Effect: 'Allow', Action: '*', Resource: '*' }],
    },
  })
  .attachPolicy({
    policyId: 'admin-full-access',
    scope: { type: 'TENANT', id: 'acme-corp' },
    principal: { type: 'ROLE', id: 'admin' },
  });

// Editor policy
provider
  .addPolicy({
    id: 'editor-access',
    scope: { type: 'TENANT', id: 'acme-corp' },
    document: {
      Statement: [
        {
          Effect: 'Allow',
          Action: ['document:*', 'file:*'],
          Resource: '*',
        },
      ],
    },
  })
  .attachPolicy({
    policyId: 'editor-access',
    scope: { type: 'TENANT', id: 'acme-corp' },
    principal: { type: 'ROLE', id: 'editor' },
  });

// Viewer policy
provider
  .addPolicy({
    id: 'viewer-access',
    scope: { type: 'TENANT', id: 'acme-corp' },
    document: {
      Statement: [
        {
          Effect: 'Allow',
          Action: ['*:read', '*:list'],
          Resource: '*',
        },
      ],
    },
  })
  .attachPolicy({
    policyId: 'viewer-access',
    scope: { type: 'TENANT', id: 'acme-corp' },
    principal: { type: 'ROLE', id: 'viewer' },
  });

// Get policies for editor
const editorPolicies = await provider.getPolicies({
  scope: { type: 'TENANT', id: 'acme-corp' },
  principal: { type: 'USER', id: 'user-123' },
  roleIds: ['editor'],
});
```

### Example 3: Multi-tenant with Workspace Isolation

```typescript
const provider = new MemoryPolicyProvider();

// Tenant A workspace policy
provider
  .addPolicy({
    id: 'workspace-policy-a',
    scope: { type: 'WORKSPACE', id: 'ws-tenant-a' },
    document: {
      Statement: [
        {
          Effect: 'Allow',
          Action: 'project:*',
          Resource: 'project/*',
        },
      ],
    },
  })
  .attachPolicy({
    policyId: 'workspace-policy-a',
    scope: { type: 'WORKSPACE', id: 'ws-tenant-a' },
    principal: { type: 'USER', id: 'user-tenant-a' },
  });

// Tenant B workspace policy
provider
  .addPolicy({
    id: 'workspace-policy-b',
    scope: { type: 'WORKSPACE', id: 'ws-tenant-b' },
    document: {
      Statement: [
        {
          Effect: 'Allow',
          Action: 'project:read',
          Resource: 'project/*',
        },
      ],
    },
  })
  .attachPolicy({
    policyId: 'workspace-policy-b',
    scope: { type: 'WORKSPACE', id: 'ws-tenant-b' },
    principal: { type: 'USER', id: 'user-tenant-b' },
  });

// Each user only sees their workspace policies
const policiesA = await provider.getPolicies({
  scope: { type: 'WORKSPACE', id: 'ws-tenant-a' },
  principal: { type: 'USER', id: 'user-tenant-a' },
});

const policiesB = await provider.getPolicies({
  scope: { type: 'WORKSPACE', id: 'ws-tenant-b' },
  principal: { type: 'USER', id: 'user-tenant-b' },
});
```

## 🔌 Custom Provider Implementation

Implement the `PolicyProvider` interface for custom storage backends:

```typescript
import { PolicyProvider, PolicySource, GetPoliciesInput } from '@autorix/storage';
import type { PolicyDocument } from '@autorix/core';

export class DatabasePolicyProvider implements PolicyProvider {
  constructor(private db: Database) {}

  async getPolicies(input: GetPoliciesInput): Promise<PolicySource[]> {
    const { scope, principal, roleIds = [], groupIds = [] } = input;

    // Query your database for policies
    const policies = await this.db.query(`
      SELECT p.id, p.document
      FROM policies p
      JOIN policy_attachments pa ON p.id = pa.policy_id
      WHERE p.scope_type = $1
        AND p.scope_id = $2
        AND (
          (pa.principal_type = 'USER' AND pa.principal_id = $3)
          OR (pa.principal_type = 'ROLE' AND pa.principal_id = ANY($4))
          OR (pa.principal_type = 'GROUP' AND pa.principal_id = ANY($5))
        )
    `, [scope.type, scope.id, principal.id, roleIds, groupIds]);

    return policies.map(row => ({
      id: row.id,
      document: JSON.parse(row.document) as PolicyDocument,
    }));
  }
}
```

### MongoDB Provider Example

```typescript
import { PolicyProvider, PolicySource, GetPoliciesInput } from '@autorix/storage';
import { MongoClient, Db } from 'mongodb';

export class MongoPolicyProvider implements PolicyProvider {
  constructor(private db: Db) {}

  async getPolicies(input: GetPoliciesInput): Promise<PolicySource[]> {
    const { scope, principal, roleIds = [], groupIds = [] } = input;

    const principals = [
      { type: 'USER', id: principal.id },
      ...roleIds.map(id => ({ type: 'ROLE', id })),
      ...groupIds.map(id => ({ type: 'GROUP', id })),
    ];

    const attachments = await this.db.collection('policy_attachments')
      .find({
        'scope.type': scope.type,
        'scope.id': scope.id,
        $or: principals.map(p => ({
          'principal.type': p.type,
          'principal.id': p.id,
        })),
      })
      .toArray();

    const policyIds = [...new Set(attachments.map(a => a.policyId))];

    const policies = await this.db.collection('policies')
      .find({ _id: { $in: policyIds } })
      .toArray();

    return policies.map(p => ({
      id: p._id.toString(),
      document: p.document,
    }));
  }
}
```

## 🧪 Testing

### Testing with Memory Provider

```typescript
import { describe, it, expect } from 'vitest';
import { MemoryPolicyProvider } from '@autorix/storage';

describe('MemoryPolicyProvider', () => {
  it('should return policies for user', async () => {
    const provider = new MemoryPolicyProvider();
    
    provider
      .addPolicy({
        id: 'test-policy',
        scope: { type: 'TENANT', id: 'test-tenant' },
        document: {
          Statement: [
            { Effect: 'Allow', Action: 'test:action', Resource: '*' },
          ],
        },
      })
      .attachPolicy({
        policyId: 'test-policy',
        scope: { type: 'TENANT', id: 'test-tenant' },
        principal: { type: 'USER', id: 'test-user' },
      });

    const policies = await provider.getPolicies({
      scope: { type: 'TENANT', id: 'test-tenant' },
      principal: { type: 'USER', id: 'test-user' },
    });

    expect(policies).toHaveLength(1);
    expect(policies[0].id).toBe('test-policy');
  });

  it('should return policies from roles', async () => {
    const provider = new MemoryPolicyProvider();
    
    provider
      .addPolicy({
        id: 'role-policy',
        scope: { type: 'TENANT', id: 'test-tenant' },
        document: {
          Statement: [
            { Effect: 'Allow', Action: 'admin:*', Resource: '*' },
          ],
        },
      })
      .attachPolicy({
        policyId: 'role-policy',
        scope: { type: 'TENANT', id: 'test-tenant' },
        principal: { type: 'ROLE', id: 'admin' },
      });

    const policies = await provider.getPolicies({
      scope: { type: 'TENANT', id: 'test-tenant' },
      principal: { type: 'USER', id: 'test-user' },
      roleIds: ['admin'],
    });

    expect(policies).toHaveLength(1);
    expect(policies[0].id).toBe('role-policy');
  });

  it('should respect scope isolation', async () => {
    const provider = new MemoryPolicyProvider();
    
    provider
      .addPolicy({
        id: 'tenant-1-policy',
        scope: { type: 'TENANT', id: 'tenant-1' },
        document: {
          Statement: [
            { Effect: 'Allow', Action: '*', Resource: '*' },
          ],
        },
      })
      .attachPolicy({
        policyId: 'tenant-1-policy',
        scope: { type: 'TENANT', id: 'tenant-1' },
        principal: { type: 'USER', id: 'user-1' },
      });

    const policies = await provider.getPolicies({
      scope: { type: 'TENANT', id: 'tenant-2' }, // Different tenant
      principal: { type: 'USER', id: 'user-1' },
    });

    expect(policies).toHaveLength(0);
  });
});
```

## 📊 Best Practices

1. **Use appropriate scope types**
   - `PLATFORM` for global policies
   - `TENANT` for multi-tenant isolation
   - `WORKSPACE` for workspace-level permissions
   - `APP` for application-specific policies

2. **Organize policies by role**
   - Create role-based policies for common permission sets
   - Attach policies to roles rather than individual users when possible
   - Use groups for team-based permissions

3. **Keep policy documents focused**
   - One policy per logical permission set
   - Avoid overly complex policy documents
   - Use multiple policies instead of one large policy

4. **Implement caching for production**
   - Cache policy lookups to reduce database queries
   - Invalidate cache when policies are modified
   - Consider using Redis or similar for distributed caching

5. **Monitor policy performance**
   - Track policy retrieval times
   - Optimize database queries for large datasets
   - Consider indexing strategy for your storage backend

## 🔗 Integration with Other Packages

### With @autorix/core

```typescript
import { evaluate } from '@autorix/core';
import { MemoryPolicyProvider } from '@autorix/storage';

const provider = new MemoryPolicyProvider();
// ... setup policies

const policies = await provider.getPolicies({
  scope: { type: 'TENANT', id: 'tenant-123' },
  principal: { type: 'USER', id: 'user-456' },
});

const decision = evaluate({
  action: 'document:read',
  resource: 'document/123',
  policy: policies[0].document,
  ctx: { principal: { id: 'user-456' } },
});
```

### With @autorix/nestjs

```typescript
import { AutorixModule } from '@autorix/nestjs';
import { MemoryPolicyProvider } from '@autorix/storage';

@Module({
  imports: [
    AutorixModule.forRoot({
      policyProvider: new MemoryPolicyProvider()
        .addPolicy({ ... })
        .attachPolicy({ ... }),
    }),
  ],
})
export class AppModule {}
```

## 🔗 Related Packages

- **[@autorix/core](../core)** - Core policy evaluation engine
- **[@autorix/nestjs](../nestjs)** - NestJS integration

## 📄 License

MIT © Autorix

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions, please use the [GitHub Issues](https://github.com/yourusername/autorix/issues) page.
