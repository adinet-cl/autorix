# @autorix/core

**Autorix Policy Evaluation Engine** - A flexible, AWS IAM-inspired policy evaluation system for Node.js applications.

## 📋 Overview

`@autorix/core` is the core evaluation engine for Autorix, providing a powerful and flexible way to implement fine-grained access control in your applications. It evaluates policies using an AWS IAM-like syntax with support for wildcards, conditions, and context-aware authorization decisions.

## ✨ Features

- 🔒 **AWS IAM-inspired policy syntax** - Familiar and battle-tested policy format
- 🎯 **Explicit Deny > Allow** - Security-first evaluation model (explicit deny always wins)
- 🌟 **Wildcard matching** - Flexible pattern matching for actions and resources
- 📊 **Conditional evaluation** - Support for StringEquals, StringLike, NumericEquals, and Bool operators
- 🔄 **Multi-policy evaluation** - Evaluate multiple policies with proper precedence
- 🚀 **Zero dependencies** - Lightweight and performant
- 📦 **TypeScript first** - Full type safety and IntelliSense support
- 🌐 **Universal** - Works in Node.js 18+

## 📦 Installation

```bash
npm install @autorix/core
```

```bash
pnpm add @autorix/core
```

```bash
yarn add @autorix/core
```

## 🚀 Quick Start

```typescript
import { evaluate, type PolicyDocument, type AutorixContext } from '@autorix/core';

// Define a policy document
const policy: PolicyDocument = {
  Version: '2024-01-01',
  Statement: [
    {
      Sid: 'AllowReadDocuments',
      Effect: 'Allow',
      Action: ['document:read', 'document:list'],
      Resource: 'arn:app:document/*',
    },
    {
      Sid: 'DenyDeleteDocuments',
      Effect: 'Deny',
      Action: 'document:delete',
      Resource: 'arn:app:document/*',
    },
  ],
};

// Create a context
const ctx: AutorixContext = {
  principal: {
    id: 'user-123',
    tenantId: 'tenant-456',
  },
};

// Evaluate a request
const decision = evaluate({
  action: 'document:read',
  resource: 'arn:app:document/doc-789',
  policy,
  ctx,
});

console.log(decision);
// {
//   allowed: true,
//   reason: 'EXPLICIT_ALLOW',
//   matchedStatements: ['AllowReadDocuments']
// }
```

## 📚 Core Concepts

### Policy Document

A policy document contains one or more statements that define permissions:

```typescript
interface PolicyDocument {
  Version?: string;
  Statement: Statement[];
}
```

### Statement

Each statement defines a specific permission:

```typescript
interface Statement {
  Sid?: string;                    // Statement ID (optional)
  Effect: 'Allow' | 'Deny';        // Permission effect
  Action: string | string[];       // Action(s) to match
  Resource: string | string[];     // Resource(s) to match
  Condition?: ConditionBlock;      // Optional conditions
}
```

### Context

The context provides information about the request:

```typescript
interface AutorixContext {
  scope?: {
    type: ScopeType;
    id?: string;
  };
  principal: {
    id: string;
    tenantId?: string;
    roles?: string[];
    groups?: string[];
    attributes?: Record<string, unknown>;
  };
  resource?: AutorixResource;
  request?: {
    method?: string;
    path?: string;
    ip?: string;
    headers?: Record<string, string | string[]>;
  };
  context?: Record<string, unknown>;
}
```

### Decision

The result of policy evaluation:

```typescript
interface Decision {
  allowed: boolean;
  reason: 'EXPLICIT_DENY' | 'EXPLICIT_ALLOW' | 'DEFAULT_DENY';
  matchedStatements: string[];
}
```

## 🔧 API Reference

### `evaluate(input: EvaluateInput): Decision`

Evaluates a single policy document against an action and resource.

**Parameters:**
- `action` (string): The action being performed (e.g., `'document:read'`)
- `resource` (string): The resource being accessed (e.g., `'arn:app:document/123'`)
- `policy` (PolicyDocument): The policy to evaluate
- `ctx` (AutorixContext): The context of the request
- `validate` (boolean, optional): Whether to validate the policy document (default: `true`)

**Returns:** `Decision` object with evaluation result

```typescript
const decision = evaluate({
  action: 'document:read',
  resource: 'arn:app:document/123',
  policy: myPolicy,
  ctx: myContext,
});
```

### `evaluateAll(input: EvaluateAllInput): Decision`

Evaluates multiple policies in sequence. An explicit deny in any policy will immediately return a denied decision.

**Parameters:**
- `action` (string): The action being performed
- `resource` (string): The resource being accessed
- `policies` (PolicyDocument[]): Array of policies to evaluate
- `ctx` (AutorixContext): The context of the request

**Returns:** Combined `Decision` from all policies

```typescript
const decision = evaluateAll({
  action: 'document:read',
  resource: 'arn:app:document/123',
  policies: [userPolicy, rolePolicy, tenantPolicy],
  ctx: myContext,
});
```

### `assertAllowed(decision: Decision, message?: string): void`

Throws an `AutorixForbiddenError` if the decision is not allowed. Useful for imperative authorization checks.

```typescript
const decision = evaluate({ action, resource, policy, ctx });
assertAllowed(decision, 'You cannot access this document');
```

### `wildcardMatch(pattern: string, value: string): boolean`

Matches a value against a wildcard pattern. Supports `*` (matches any sequence) and `?` (matches single character).

```typescript
wildcardMatch('document:*', 'document:read'); // true
wildcardMatch('user:?:view', 'user:1:view');  // true
```

### `validatePolicy(policy: PolicyDocument): void`

Validates a policy document structure. Throws `AutorixPolicyError` if invalid.

```typescript
import { assertValidPolicyDocument } from '@autorix/core';

try {
  assertValidPolicyDocument(policy);
  console.log('Policy is valid');
} catch (error) {
  console.error('Invalid policy:', error.message);
}
```

## 🎯 Advanced Usage

### Wildcard Patterns

Actions and resources support wildcard patterns:

```typescript
const policy: PolicyDocument = {
  Statement: [
    {
      Effect: 'Allow',
      Action: 'document:*',           // Matches all document actions
      Resource: 'arn:app:document/*', // Matches all documents
    },
    {
      Effect: 'Allow',
      Action: ['user:read', 'user:update'],
      Resource: 'arn:app:user/user-???', // Matches 3-character user IDs
    },
  ],
};
```

### Conditions

Add conditional logic to your policies:

```typescript
const policy: PolicyDocument = {
  Statement: [
    {
      Effect: 'Allow',
      Action: 'document:read',
      Resource: 'arn:app:document/*',
      Condition: {
        StringEquals: {
          'principal.tenantId': '${resource.tenantId}',
        },
        Bool: {
          'resource.attributes.published': true,
        },
      },
    },
  ],
};
```

**Supported operators:**
- `StringEquals`: Exact string matching
- `StringLike`: Wildcard pattern matching
- `NumericEquals`: Number comparison
- `Bool`: Boolean comparison

### Variable Interpolation

Use variables in condition values to reference context data:

```typescript
{
  Condition: {
    StringEquals: {
      'resource.ownerId': '${principal.id}',          // Resource owner matches principal
      'resource.tenantId': '${principal.tenantId}',   // Same tenant
    }
  }
}
```

### Multi-Policy Evaluation

Evaluate multiple policies with proper precedence:

```typescript
import { evaluateAll } from '@autorix/core';

const userPolicy: PolicyDocument = {
  Statement: [
    { Effect: 'Allow', Action: 'document:read', Resource: '*' }
  ]
};

const orgPolicy: PolicyDocument = {
  Statement: [
    { Effect: 'Deny', Action: 'document:delete', Resource: '*' }
  ]
};

const decision = evaluateAll({
  action: 'document:delete',
  resource: 'arn:app:document/123',
  policies: [userPolicy, orgPolicy], // Deny in orgPolicy takes precedence
  ctx,
});

console.log(decision.allowed); // false
console.log(decision.reason);  // 'EXPLICIT_DENY'
```

## 🛡️ Evaluation Logic

Autorix follows AWS IAM evaluation logic:

1. **Default Deny**: By default, all requests are denied
2. **Explicit Deny Wins**: If any policy explicitly denies, the request is denied
3. **Explicit Allow**: At least one policy must explicitly allow the request
4. **Final Result**: Allow only if there's an explicit allow and no explicit deny

```
┌─────────────────┐
│  Start Request  │
└────────┬────────┘
         │
         ▼
┌────────────────────┐
│  Explicit Deny?    │───Yes──▶ DENIED
└────────┬───────────┘
         │ No
         ▼
┌────────────────────┐
│  Explicit Allow?   │───Yes──▶ ALLOWED
└────────┬───────────┘
         │ No
         ▼
       DENIED
    (Default Deny)
```

## 🔍 Examples

### Example 1: Document Management System

```typescript
import { evaluate } from '@autorix/core';

const policy: PolicyDocument = {
  Statement: [
    {
      Sid: 'AllowOwnDocuments',
      Effect: 'Allow',
      Action: ['document:*'],
      Resource: 'arn:app:document/*',
      Condition: {
        StringEquals: {
          'resource.ownerId': '${principal.id}',
        },
      },
    },
    {
      Sid: 'AllowPublicRead',
      Effect: 'Allow',
      Action: 'document:read',
      Resource: 'arn:app:document/*',
      Condition: {
        Bool: {
          'resource.attributes.isPublic': true,
        },
      },
    },
  ],
};

const ctx: AutorixContext = {
  principal: { id: 'user-123' },
  resource: {
    type: 'document',
    id: 'doc-456',
    ownerId: 'user-789',
    attributes: { isPublic: true },
  },
};

const decision = evaluate({
  action: 'document:read',
  resource: 'arn:app:document/doc-456',
  policy,
  ctx,
});

console.log(decision.allowed); // true (matches AllowPublicRead)
```

### Example 2: Multi-tenant Application

```typescript
const policy: PolicyDocument = {
  Statement: [
    {
      Sid: 'SameTenantOnly',
      Effect: 'Allow',
      Action: '*',
      Resource: '*',
      Condition: {
        StringEquals: {
          'principal.tenantId': '${resource.tenantId}',
        },
      },
    },
    {
      Sid: 'DenyProd',
      Effect: 'Deny',
      Action: '*',
      Resource: 'arn:app:*/prod-*',
      Condition: {
        StringEquals: {
          'principal.attributes.environment': 'dev',
        },
      },
    },
  ],
};
```

### Example 3: Role-based Access

```typescript
const policy: PolicyDocument = {
  Statement: [
    {
      Sid: 'AdminFullAccess',
      Effect: 'Allow',
      Action: '*',
      Resource: '*',
      Condition: {
        StringLike: {
          'principal.roles': '*admin*',
        },
      },
    },
    {
      Sid: 'ViewerReadOnly',
      Effect: 'Allow',
      Action: ['*:read', '*:list', '*:get'],
      Resource: '*',
      Condition: {
        StringEquals: {
          'principal.roles': 'viewer',
        },
      },
    },
  ],
};
```

## 🚨 Error Handling

Autorix provides typed errors for different scenarios:

```typescript
import { evaluate, assertAllowed, AutorixForbiddenError } from '@autorix/core';

try {
  const decision = evaluate({ action, resource, policy, ctx });
  assertAllowed(decision);
  
  // Proceed with authorized action
} catch (error) {
  if (error instanceof AutorixForbiddenError) {
    console.error('Access denied:', error.message);
    console.error('Reason:', error.decision.reason);
    console.error('Matched statements:', error.decision.matchedStatements);
  }
}
```

## 🧪 Testing

Test your policies thoroughly:

```typescript
import { describe, it, expect } from 'vitest';
import { evaluate } from '@autorix/core';

describe('Document Policy', () => {
  it('should allow owner to delete their documents', () => {
    const decision = evaluate({
      action: 'document:delete',
      resource: 'arn:app:document/123',
      policy: myPolicy,
      ctx: {
        principal: { id: 'user-123' },
        resource: { ownerId: 'user-123' },
      },
    });
    
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('EXPLICIT_ALLOW');
  });
  
  it('should deny non-owners from deleting documents', () => {
    const decision = evaluate({
      action: 'document:delete',
      resource: 'arn:app:document/123',
      policy: myPolicy,
      ctx: {
        principal: { id: 'user-456' },
        resource: { ownerId: 'user-123' },
      },
    });
    
    expect(decision.allowed).toBe(false);
  });
});
```

## 🔗 Related Packages

- **[@autorix/nestjs](../nestjs)** - NestJS integration with decorators and guards
- **[@autorix/storage](../storage)** - Policy storage providers

## 📄 License

MIT © Autorix

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions, please use the [GitHub Issues](https://github.com/yourusername/autorix/issues) page.
