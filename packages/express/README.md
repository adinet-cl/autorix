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

### Basic Setup

```typescript
import express from 'express';
import { autorixExpress, authorize, autorixErrorHandler } from '@autorix/express';
import { evaluateAll } from '@autorix/core';
import { MemoryPolicyProvider } from '@autorix/storage';

const app = express();
app.use(express.json());

// Initialize policy provider
const policyProvider = new MemoryPolicyProvider();

// Create enforcer
const enforcer = {
  can: async (input: { action: string; context: any; resource?: unknown }) => {
    // ✅ IMPORTANT: If your app allows unauthenticated requests, guard here
    // to avoid storage/providers crashing when principal is null.
    if (!input.context?.principal) {
      return { allowed: false, reason: 'Unauthenticated' };
    }

    const policies = await policyProvider.getPolicies({
      scope: input.context.tenantId || 'default',
      principal: input.context.principal,
      roleIds: input.context.principal?.roles,
    });

    const result = evaluateAll({
      policies: policies.map(p => p.document),
      action: input.action,
      resource: input.resource,
      context: input.context,
    });

    return { allowed: result.allowed, reason: result.reason };
  }
};

// Add the Autorix middleware (must be registered before routes)
app.use(autorixExpress({
  enforcer,
  getPrincipal: async (req) => {
    // Extract user from your auth middleware (e.g., JWT/Passport/session)
    return req.user ? { id: req.user.id, roles: req.user.roles } : null;
  },
  getTenant: async (req) => {
    // Extract tenant/organization ID
    return req.user?.tenantId || null;
  }
}));

// Protect routes with authorize middleware
app.get(
  '/admin/users',
  authorize('user:list', { requireAuth: true }),
  (req, res) => {
    res.json({ message: 'Authorized!' });
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
      loader: async (id) => await db.posts.findById(id),
    }
  }),
  (req, res) => {
    res.json({ message: 'Post deleted!' });
  }
);

// ✅ IMPORTANT: Register Autorix error handler at the end
// so authorization errors return clean HTTP responses (401/403) instead of stack traces.
app.use(autorixErrorHandler());

app.listen(3000);
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
      context: AutorixRequestContext;
      resource?: unknown;
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
// Static resource
authorize({ action: 'post:read', resource: 'post/123' })

// Resource from route params
authorize({
  action: 'post:delete',
  resource: {
    type: 'post',
    idFrom: (req) => req.params.id,
    loader: async (id, req) => await db.posts.findById(id)
  }
})

// Pre-loaded resource
authorize({
  action: 'user:update',
  resource: { type: 'user', id: '123', data: { ownerId: 'u1' } }
})
```

## 🎯 Usage Examples

### Role-Based Access Control (RBAC)

```typescript
import { autorixExpress, authorize } from '@autorix/express';
import { Autorix } from '@autorix/core';
import { MemoryPolicyProvider } from '@autorix/storage';

const provider = new MemoryPolicyProvider();
const autorix = new Autorix(provider);

// Add policies
await provider.attachPolicy({
  scope: { type: 'TENANT', id: 't1' },
  policyId: 'admin-policy',
  principals: [{ type: 'ROLE', id: 'admin' }]
});

await provider.setPolicy('admin-policy', {
  Version: '2024-01-01',
  Statement: [{
    Effect: 'Allow',
    Action: ['*'],
    Resource: ['*']
  }]
});

app.use(autorixExpress({
  enforcer: autorix,
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
// Policy with conditions
await provider.setPolicy('owner-only', {
  Version: '2024-01-01',
  Statement: [{
    Effect: 'Allow',
    Action: ['post:update', 'post:delete'],
    Resource: ['post/*'],
    Condition: {
      StringEquals: {
        'principal.id': '${resource.ownerId}'
      }
    }
  }]
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
        return { ...post, ownerId: post.userId };
      }
    }
  }),
  (req, res) => {
    // Only post owner can update
    res.json({ message: 'Post updated!' });
  }
);
```

### Custom Context Attributes

```typescript
app.use(autorixExpress({
  enforcer: autorix,
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
await provider.setPolicy('business-hours', {
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
  enforcer: autorix,
  getPrincipal: (req) => req.user,
  getTenant: (req) => {
    // Extract from subdomain
    const subdomain = req.subdomains[0];
    return subdomain || req.user?.tenantId;
  }
}));

// Each tenant has isolated policies
await provider.attachPolicy({
  scope: { type: 'TENANT', id: 'acme-corp' },
  policyId: 'acme-admins',
  principals: [{ type: 'USER', id: 'alice' }]
});

await provider.attachPolicy({
  scope: { type: 'TENANT', id: 'other-corp' },
  policyId: 'other-admins',
  principals: [{ type: 'USER', id: 'bob' }]
});
```

### Audit Logging

```typescript
app.use(autorixExpress({
  enforcer: autorix,
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

- [@autorix/core](../core) - Core policy evaluation engine
- [@autorix/storage](../storage) - Policy storage providers
- [@autorix/nestjs](../nestjs) - NestJS integration

## 📝 License

MIT © [Chechooxd](https://github.com/chechooxd)

## 🤝 Contributing

Contributions are welcome! Please check the [main repository](https://github.com/chechooxd/autorix) for guidelines.

## 📖 Documentation

For more information, visit the [Autorix documentation](https://github.com/chechooxd/autorix).
