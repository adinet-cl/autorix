# @autorix/storage-redis

Redis adapter for Autorix policy storage. Perfect for high-performance, distributed systems and as a cache layer.

## Installation

```bash
npm install @autorix/storage-redis redis
# or
pnpm add @autorix/storage-redis redis
```

## Data Structure

Redis uses key-value pairs with JSON serialization and Sets for efficient lookups:

### Keys Pattern

```
autorix:policy:{scopeType}:{scopeId}:{policyId} → JSON(PolicyDocument)
autorix:attachment:{scopeType}:{scopeId}:{principalType}:{principalId} → Set[policyIds]
```

### Example

```
autorix:policy:TENANT:t1:admin-policy → {"statements": [...]}
autorix:attachment:TENANT:t1:USER:u1 → ["admin-policy", "editor-policy"]
autorix:attachment:TENANT:t1:ROLE:admin → ["admin-policy"]
```

## Usage

```typescript
import { createClient } from 'redis';
import { RedisPolicyProvider } from '@autorix/storage-redis';

// Create Redis client
const redis = createClient({
  url: 'redis://localhost:6379',
  // or for Redis Cloud:
  // url: 'redis://username:password@host:port'
});

await redis.connect();

const provider = new RedisPolicyProvider(redis, {
  keyPrefix: 'autorix' // optional, defaults to 'autorix'
});

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

// Add policy with TTL (expires in 1 hour)
await provider.addPolicy({
  id: 'temp-policy',
  scope: { type: 'TENANT', id: 't1' },
  document: { /* ... */ }
}, 3600); // 3600 seconds = 1 hour

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

### `new RedisPolicyProvider(redis: RedisClientType, options?)`

Create a new Redis policy provider.

**Parameters:**
- `redis`: Redis client instance (from `redis` package)
- `options.keyPrefix`: Optional key prefix (default: `'autorix'`)

### `getPolicies(input: GetPoliciesInput): Promise<PolicySource[]>`

Get all policies attached to a principal within a scope. Called by the enforcer.

**Performance:** Uses `SUNION` for efficient set operations and `MGET` for batch policy retrieval.

### `addPolicy(params, ttl?): Promise<void>`

Add or update a policy.

**Parameters:**
- `id`: Unique policy identifier
- `scope`: Policy scope (tenant/workspace/etc)
- `document`: Policy document
- `ttl`: Optional TTL in seconds (for auto-expiring policies)

### `attachPolicy(params): Promise<void>`

Attach a policy to a principal (user, role, or group).

**Parameters:**
- `policyId`: Policy ID to attach
- `scope`: Scope for the attachment
- `principal`: Principal to attach to (user/role/group)

### `detachPolicy(params): Promise<void>`

Remove a policy attachment.

### `deletePolicy(params): Promise<void>`

Delete a policy and remove it from all attachments.

**Note:** Uses `SCAN` to find all attachment keys, so it may be slower for large datasets.

### `attachPolicies(attachments[]): Promise<void>`

Batch attach multiple policies using Redis pipeline for better performance.

### `detachPolicies(attachments[]): Promise<void>`

Batch detach multiple policies using Redis pipeline.

### `getAllPoliciesInScope(scope): Promise<PolicySource[]>`

Get all policies in a scope (useful for admin/debugging).

### `clearScope(scope): Promise<void>`

Clear all policies and attachments in a scope.

## Use Cases

### 1. High-Performance Cache Layer

Use Redis as a fast cache in front of your primary database:

```typescript
import { RedisPolicyProvider } from '@autorix/storage-redis';
import { PostgresPolicyProvider } from '@autorix/storage-postgres';

class CachedPolicyProvider implements PolicyProvider {
  constructor(
    private cache: RedisPolicyProvider,
    private database: PostgresPolicyProvider,
    private cacheTTL = 300 // 5 minutes
  ) {}

  async getPolicies(input: GetPoliciesInput): Promise<PolicySource[]> {
    // Try cache first
    const cached = await this.cache.getPolicies(input);
    if (cached.length > 0) return cached;

    // Fallback to database
    const fromDb = await this.database.getPolicies(input);
    
    // Warm cache
    for (const policy of fromDb) {
      await this.cache.addPolicy({
        id: policy.id,
        scope: input.scope,
        document: policy.document
      }, this.cacheTTL);
      
      await this.cache.attachPolicy({
        policyId: policy.id,
        scope: input.scope,
        principal: input.principal
      });
    }

    return fromDb;
  }
}
```

### 2. Temporary/Session-Based Policies

Create policies that auto-expire:

```typescript
// Grant temporary access for 1 hour
await provider.addPolicy({
  id: 'temp-access-session-123',
  scope: { type: 'TENANT', id: 't1' },
  document: {
    statements: [
      { effect: 'allow', actions: ['document:read'], resources: ['document/xyz'] }
    ]
  }
}, 3600); // expires in 1 hour

await provider.attachPolicy({
  policyId: 'temp-access-session-123',
  scope: { type: 'TENANT', id: 't1' },
  principal: { type: 'USER', id: 'guest-user' }
});
```

### 3. Distributed Systems

Perfect for microservices architecture with shared authorization:

```typescript
// Service A adds policy
await provider.addPolicy({ /* ... */ });

// Service B immediately sees the policy
const policies = await provider.getPolicies({ /* ... */ });
```

## Performance Characteristics

- **Read Operations**: O(1) for policy lookups, O(N) for multiple principals (using SUNION)
- **Write Operations**: O(1) for adding/attaching policies
- **Delete Operations**: O(N) for finding attachments (uses SCAN)
- **Memory**: Efficient with JSON serialization, uses Redis Sets for deduplication
- **Scalability**: Horizontal scaling with Redis Cluster

## Redis Cluster Support

Works with Redis Cluster. Use hash tags to ensure related keys are on the same shard:

```typescript
const provider = new RedisPolicyProvider(redis, {
  keyPrefix: '{autorix}' // hash tag ensures all keys on same shard
});
```

## Connection Management

```typescript
// Graceful shutdown
process.on('SIGTERM', async () => {
  await redis.quit();
});

// Health check
const isHealthy = redis.isOpen;
```

## License

MIT
