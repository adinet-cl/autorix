# @autorix/express

**Express.js integration for Autorix policy-based authorization (RBAC + ABAC)**

Middleware and utilities to integrate Autorix authorization into your Express.js applications with a clean, flexible API.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org)

## ✨ Features

- 🛡️ **Middleware-based** - Simple Express.js middleware integration
- 🎯 **Route-level Authorization** - Protect specific routes with the `authorize` middleware
- 🔄 **Request Context** - Automatic context building from Express requests
- 💪 **Flexible Principal Resolution** - Custom logic for extracting user information
- 🏢 **Multi-tenant Support** - Built-in tenant isolation
- 📦 **Resource Loading** - Automatic resource resolution from route parameters
- 🚀 **TypeScript Ready** - Full type safety with Express types augmentation
- ⚡ **Zero Config** - Works out of the box with sensible defaults

## 📦 Installation

```bash
npm install @autorix/express @autorix/core @autorix/storage
# or
pnpm add @autorix/express @autorix/core @autorix/storage
# or
yarn add @autorix/express @autorix/core @autorix/storage
```

## 🚀 Quick Start

### Complete Example

```typescript
import express from 'express';
import { autorixExpress, authorize, autorixErrorHandler } from '@autorix/express';
import { evaluateAll } from '@autorix/core';
import { MemoryPolicyProvider } from '@autorix/storage';

const app = express();
app.use(express.json());

// Simple authentication middleware (replace with JWT/Passport in production)
app.use((req, res, next) => {
  // Simulate authentication - extract from header/token
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    // In production: verify JWT token, validate session, etc.
    // For demo purposes, we'll parse a simple format: "Bearer userId:role1,role2"
    const token = authHeader.replace('Bearer ', '');
    const [id, rolesStr] = token.split(':');
    const roles = rolesStr ? rolesStr.split(',') : [];
    
    req.user = {
      id,
      roles,
      tenantId: 't1' // In production: extract from token or database
    };
  }
  
  next();
});

// Initialize policy provider
const policyProvider = new MemoryPolicyProvider();
const scope = { type: 'TENANT' as const, id: 't1' };

// Mock data for demonstration
type Post = { id: string; ownerId: string };
const posts: Post[] = [
  { id: 'p1', ownerId: 'u1' },
  { id: 'p2', ownerId: 'u2' },
];

// Add policies
policyProvider.addPolicy({
  id: 'admin-policy',
  scope,
  document: {
    Version: '2025-01-01',
    Statement: [
      {
        Sid: 'AllowUserListForAdmins',
        Effect: 'Allow',
        Action: ['user:*'],
        Resource: ['*'],
      },
      {
        Sid: 'AllowPostDeleteForAuthors',
        Effect: 'Allow',
        Action: ['post:delete'],
        Resource: ['post/*'],
        Condition: {
          StringEquals: {
            'resource.ownerId': '${principal.id}',
          },
        },
      },
    ],
  },
});

// Attach policy to admin role
policyProvider.attachPolicy({
  policyId: 'admin-policy',
  scope,
  principal: { type: 'ROLE', id: 'admin' },
});

// Create enforcer
const enforcer = {
  can: async (input: { action: string; resource: string; context: any }) => {
    if (!input.context?.principal) {
      return { allowed: false, reason: 'Unauthenticated' };
    }

    const { id, roles } = input.context.principal;

    // Fetch policies from storage
    const policies = await policyProvider.getPolicies({
      scope,
      principal: { type: 'USER', id },
      roleIds: roles,
    });

    // Evaluate all policies
    const result = evaluateAll({
      policies: policies.map(p => p.document),
      action: input.action,
      resource: input.resource,
      ctx: input.context,
    });

    return { allowed: result.allowed, reason: result.reason };
  }
};

// Add the Autorix middleware (must be registered before routes)
app.use(autorixExpress({
  enforcer,
  getPrincipal: async (req) => {
    return req.user ? { id: req.user.id, roles: req.user.roles } : null;
  },
  getTenant: async (req) => {
    return req.user?.tenantId || null;
  }
}));

// Protect routes with authorize middleware
app.get(
  '/admin/users',
  authorize('user:list', { requireAuth: true }),
  (req, res) => {
    res.json({ message: 'Authorized to list users!' });
  }
);

app.post(
  '/posts',
  authorize('post:create', { requireAuth: true }),
  (req, res) => {
    res.json({ message: 'Post created!' });
  }
);

app.delete(
  '/posts/:id',
  authorize({
    action: 'post:delete',
    requireAuth: true,
    resource: {
      type: 'post',
      idFrom: (req) => req.params.id,
      loader: async (id) => {
        // Load resource to check conditions (e.g., ownerId)
        return posts.find(p => p.id === id) || null;
      },
    }
  }),
  (req, res) => {
    res.json({ message: 'Post deleted!' });
  }
);

// ✅ IMPORTANT: Register Autorix error handler at the end
// so authorization errors return clean HTTP responses (401/403) instead of stack traces.
app.use(autorixErrorHandler());

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

**Testing the example:**

```bash
# Request without auth (will get 401)
curl http://localhost:3000/admin/users

# Admin user can list users
curl -H "Authorization: Bearer u1:admin" http://localhost:3000/admin/users

# User u1 can delete their own post (p1)
curl -X DELETE -H "Authorization: Bearer u1:admin" http://localhost:3000/posts/p1

# User u2 cannot delete u1's post (will get 403)
curl -X DELETE -H "Authorization: Bearer u2:user" http://localhost:3000/posts/p1
```

## 📚 API Reference

### `autorixExpress(options)`

Main middleware that initializes Autorix on the Express request object.

#### Options

```typescript
type AutorixExpressOptions = {
  enforcer: {
    can: (input: {
      action: string;
      resource: string;  // Resource string for matching (e.g., 'post/123')
      context: AutorixRequestContext;  // Contains resource object in context.resource
    }) => Promise<{ allowed: boolean; reason?: string }>;
  };
  getPrincipal: (req: Request) => Principal | Promise<Principal>;
  getTenant?: (req: Request) => string | null | Promise<string | null>;
  getContext?: (req: Request) => Partial<AutorixRequestContext> | Promise<Partial<AutorixRequestContext>>;
  onDecision?: (decision: { allowed: boolean; action: string; reason?: string }, req: Request) => void;
};
```

- **`enforcer`**: The Autorix instance or compatible enforcer
- **`getPrincipal`**: Function to extract user/principal information from the request
- **`getTenant`** *(optional)*: Function to extract tenant/organization ID
- **`getContext`** *(optional)*: Additional context builder (IP, user agent, custom attributes)
- **`onDecision`** *(optional)*: Callback for logging/auditing authorization decisions

#### Request Augmentation

After this middleware runs, `req.autorix` is available with:

```typescript
req.autorix = {
  context: AutorixRequestContext,
  can: (action: string, resource?: unknown, ctxExtra?: Record<string, unknown>) => Promise<boolean>,
  enforce: (action: string, resource?: unknown, ctxExtra?: Record<string, unknown>) => Promise<void>
}
```

### `authorize(config)`

Route-level middleware for authorization checks.

#### Simple Usage

```typescript
app.get('/users', authorize('user:list'), handler);
```

#### Advanced Usage

```typescript
authorize({
  action: string;
  resource?: ResourceSpec;
  context?: Record<string, unknown> | ((req: Request) => Record<string, unknown> | Promise<Record<string, unknown>>);
  requireAuth?: boolean;
})
```

- **`action`**: The action to authorize (e.g., `'user:read'`, `'post:delete'`)
- **`resource`** *(optional)*: Resource specification
  - String: Static resource identifier
  - Object with `type`, `id`, `data`: Static resource object
  - Object with `type`, `idFrom`, `loader`: Dynamic resource loading
- **`context`** *(optional)*: Additional context attributes or function to compute them
- **`requireAuth`** *(optional)*: Whether to require authenticated principal (throws `AutorixUnauthenticatedError` if not present)

#### Resource Specification

```typescript
// Simple action - resource auto-inferred from action
// 'user:list' → resource string becomes 'user/*'
authorize('user:list')

// Static resource string
authorize({ action: 'post:read', resource: 'post/123' })

// Resource from route params with dynamic loading
authorize({
  action: 'post:delete',
  resource: {
    type: 'post',
    idFrom: (req) => req.params.id,
    loader: async (id, req) => await db.posts.findById(id)
  }
})

// Pre-loaded static resource object
authorize({
  action: 'user:update',
  resource: { type: 'user', id: '123', ownerId: 'u1' }
})
```

## 🔑 Understanding Resources

Autorix uses **two separate concepts** for resources:

1. **Resource String** (for pattern matching in policies)
   - Format: `type/id` or `type/*`
   - Used in policy `Resource` field
   - Example: `'post/123'`, `'document/*'`
   - **Auto-inferred**: If not specified, extracted from action (e.g., `'user:list'` → `'user/*'`)

2. **Resource Object** (for attribute-based conditions)
   - Contains resource properties/attributes
   - Used in policy `Condition` blocks
   - Example: `{ type: 'post', id: '123', authorId: 'u1' }`

**How they work together:**

```typescript
// Policy matches by string pattern
Statement: [{
  Effect: 'Allow',
  Action: ['post:delete'],
  Resource: 'post/*',  // ← Matches 'post/123'
  Condition: {
    StringEquals: {
      'resource.authorId': '${principal.id}'  // ← Uses resource object
    }
  }
}]

// Middleware automatically handles both
authorize({
  action: 'post:delete',
  resource: {
    type: 'post',
    idFrom: (req) => req.params.id,  // → Builds string: 'post/123'
    loader: async (id) => {
      const post = await db.posts.findById(id);
      return { authorId: post.authorId };  // → Object for conditions
    }
  }
})

// Result:
// - Resource string: 'post/123' (for policy Resource matching)
// - Resource object: { type: 'post', id: '123', authorId: 'u1' } (for Condition checks)
```

### ⚠️ Important Notes

**1. PolicyProvider Principal Format**

When calling `policyProvider.getPolicies()`, the principal **must include a `type`**:

```typescript
// ✅ Correct
principal: { type: 'USER', id: 'user-123' }

// ❌ Wrong - will not find policies
principal: { id: 'user-123' }
```

**2. Context Transformation**

Express context differs from Core context. Always transform when calling `evaluateAll()`:

```typescript
// Express context
const expressContext = {
  principal: { id: 'u1', roles: ['admin'] },
  tenantId: 't1',
  ip: '192.168.1.1'
};

// Core context (required by evaluateAll)
const coreContext = {
  scope: { type: 'TENANT', id: expressContext.tenantId },
  principal: expressContext.principal,
  resource: expressContext.resource,
  request: { ip: expressContext.ip }
};
```

**3. Resource Auto-Inference**

When no resource is specified, it's inferred from the action:
- `'user:list'` → `'user/*'`
- `'post:delete'` → `'post/*'`
- `'document:read'` → `'document/*'`

This works well with wildcard policies but requires your actions follow the `<resource>:<action>` pattern.

## 🎯 Usage Examples

### Role-Based Access Control (RBAC)

```typescript
import { autorixExpress, authorize } from '@autorix/express';
import { evaluateAll } from '@autorix/core';
import { MemoryPolicyProvider } from '@autorix/storage';

const provider = new MemoryPolicyProvider();

// Add policy
provider.addPolicy({
  id: 'admin-policy',
  scope: { type: 'TENANT', id: 't1' },
  document: {
    Version: '2024-01-01',
    Statement: [{
      Effect: 'Allow',
      Action: ['*'],
      Resource: ['*']
    }]
  }
});

// Attach to admin role
provider.attachPolicy({
  policyId: 'admin-policy',
  scope: { type: 'TENANT', id: 't1' },
  principal: { type: 'ROLE', id: 'admin' }
});

// Create enforcer
const enforcer = {
  can: async (input: { action: string; resource: string; context: any }) => {
    if (!input.context?.principal) {
      return { allowed: false, reason: 'Unauthenticated' };
    }

    const scope = { type: 'TENANT', id: input.context.tenantId || 't1' };

    const policies = await provider.getPolicies({
      scope,
      principal: { type: 'USER', id: input.context.principal.id },
      roleIds: input.context.principal?.roles,
    });

    const result = evaluateAll({
      policies: policies.map(p => p.document),
      action: input.action,
      resource: input.resource,
      ctx: { scope, principal: input.context.principal },
    });

    return { allowed: result.allowed, reason: result.reason };
  }
};

app.use(autorixExpress({
  enforcer,
  getPrincipal: (req) => req.user || null,
  getTenant: (req) => req.user?.tenantId || 't1'
}));

// Only admins can access
app.get('/admin/settings',
  authorize('admin:settings:read'),
  (req, res) => res.json({ settings: {} })
);
```

### Attribute-Based Access Control (ABAC)

```typescript
// Policy with conditions - checks resource attributes
provider.addPolicy({
  id: 'owner-only',
  scope: { type: 'TENANT', id: 'my-org' },
  document: {
    Version: '2024-01-01',
    Statement: [{
      Effect: 'Allow',
      Action: ['post:update', 'post:delete'],
      Resource: ['post/*'],  // ← Matches 'post/123' string pattern
      Condition: {
        StringEquals: {
          'resource.authorId': '${principal.id}'  // ← Checks resource object property
        }
      }
    }]
  }
});

// Attach to all authenticated users
provider.attachPolicy({
  policyId: 'owner-only',
  scope: { type: 'TENANT', id: 'my-org' },
  principal: { type: 'ROLE', id: 'user' }
});

// Route with resource loading
app.put('/posts/:id',
  authorize({
    action: 'post:update',
    resource: {
      type: 'post',
      idFrom: (req) => req.params.id,
      loader: async (id) => {
        const post = await db.posts.findById(id);
        // Return object with properties for conditions
        return { 
          authorId: post.authorId,  // ← This becomes resource.authorId in conditions
          status: post.status 
        };
      }
    }
  }),
  (req, res) => {
    // Only post author can update
    res.json({ message: 'Post updated!' });
  }
);
```

### Custom Context Attributes

```typescript
app.use(autorixExpress({
  enforcer,  // ← Use the enforcer object created earlier
  getPrincipal: (req) => req.user,
  getContext: (req) => ({
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id,
    attributes: {
      timeOfDay: new Date().getHours(),
      department: req.user?.department
    }
  })
}));

// Policy can check custom attributes
provider.addPolicy({
  id: 'business-hours',
  scope: { type: 'TENANT', id: 'my-org' },
  document: {
    Version: '2024-01-01',
    Statement: [{
      Effect: 'Allow',
      Action: ['report:generate'],
      Resource: ['*'],
      Condition: {
        NumericGreaterThanEquals: { 'context.attributes.timeOfDay': 9 },
        NumericLessThanEquals: { 'context.attributes.timeOfDay': 17 }
      }
    }]
  }
});

// Attach to users who need reports
provider.attachPolicy({
  policyId: 'business-hours',
  scope: { type: 'TENANT', id: 'my-org' },
  principal: { type: 'ROLE', id: 'analyst' }
});
```

### Manual Authorization Checks

```typescript
app.get('/mixed-access', async (req, res) => {
  // Check without throwing
  const canRead = await req.autorix.can('document:read', { type: 'document', id: '123' });
  const canEdit = await req.autorix.can('document:edit', { type: 'document', id: '123' });

  res.json({
    document: canRead ? await loadDocument('123') : null,
    editable: canEdit
  });
});

app.post('/critical-action', async (req, res) => {
  // Enforce (throws on deny)
  await req.autorix.enforce('admin:critical:execute');
  
  // This code only runs if authorized
  await performCriticalAction();
  res.json({ success: true });
});
```

### Multi-tenant Isolation

```typescript
app.use(autorixExpress({
  enforcer,  // ← Use the enforcer defined earlier
  getPrincipal: (req) => req.user,
  getTenant: (req) => {
    // Extract from subdomain
    const subdomain = req.subdomains[0];
    return subdomain || req.user?.tenantId;
  }
}));

// Each tenant has isolated policies
provider.attachPolicy({
  policyId: 'acme-admins',
  scope: { type: 'TENANT', id: 'acme-corp' },
  principal: { type: 'USER', id: 'alice' }
});

provider.attachPolicy({
  policyId: 'other-admins',
  scope: { type: 'TENANT', id: 'other-corp' },
  principal: { type: 'USER', id: 'bob' }
});
```

### Audit Logging

```typescript
app.use(autorixExpress({
  enforcer,  // ← Use the enforcer defined earlier
  getPrincipal: (req) => req.user,
  onDecision: (decision, req) => {
    // Log all authorization decisions
    logger.info('Authorization decision', {
      userId: req.user?.id,
      action: decision.action,
      allowed: decision.allowed,
      reason: decision.reason,
      path: req.path,
      method: req.method,
      timestamp: new Date()
    });
  }
}));
```

---

## 🔧 Error Handling

`@autorix/express` provides an official error handler middleware to ensure authorization errors
are returned as clean HTTP responses (`401`, `403`) instead of unhandled stack traces.

### ✅ Recommended (default)

```ts
import { autorixErrorHandler } from '@autorix/express';

// Register at the end (after routes)
app.use(autorixErrorHandler());
```

This middleware automatically handles all `AutorixHttpError` instances and formats them as JSON responses.

**Always register this middleware after all routes.**

---

### 🧩 Custom error handling (optional)

If you want full control over the error response format or logging, you can implement
your own handler using the exported error classes.

```ts
import { AutorixHttpError } from '@autorix/express';

app.use((err, req, res, next) => {
  if (err instanceof AutorixHttpError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message
      }
    });
  }

  next(err);
});
```

---

### ⚠️ Important notes

* If no error handler is registered, Express will print authorization errors as stack traces.
* Using `autorixErrorHandler()` is strongly recommended to avoid this behavior.
* For protected routes, use `requireAuth: true` in `authorize()` to return a clean `401 Unauthenticated`
  response when no principal is present.

---

## 🧠 Why is this required?

Express does not support automatic global error handling inside normal middleware.
For this reason, error handlers must be registered explicitly at the application level.

This design follows the same pattern used by mature Express libraries
(e.g. `passport`, `express-rate-limit`, `celebrate`).

---

## 🔗 Related Packages

- [@autorix/core](/packages/core) - Core policy evaluation engine
- [@autorix/storage](/packages/storage) - Policy storage providers
- [@autorix/nestjs](/packages/nestjs) - NestJS integration

## 📝 License

MIT © [Chechooxd](https://github.com/chechooxd)

## 🤝 Contributing

Contributions are welcome! Please check the [main repository](https://github.com/chechooxd/autorix) for guidelines.

## 📖 Documentation

For more information, visit the [Autorix documentation](https://github.com/chechooxd/autorix).
