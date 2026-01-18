# 🔐 Autorix

**AWS IAM-inspired Policy Evaluation Engine for Node.js and NestJS**

A powerful, flexible, and type-safe authorization framework that brings AWS IAM-style policy evaluation to your applications. Perfect for implementing fine-grained access control (ABAC/RBAC) in modern Node.js and NestJS applications.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org)

## ✨ Features

- 🔒 **AWS IAM-inspired** - Battle-tested policy syntax and evaluation logic
- 🎯 **Explicit Deny Wins** - Security-first evaluation model
- 🌟 **Wildcard Support** - Flexible pattern matching for actions and resources
- 📊 **Conditional Policies** - StringEquals, StringLike, NumericEquals, Bool operators
- 🎨 **NestJS Integration** - Clean decorator-based API for route protection
- 💾 **Flexible Storage** - Built-in memory provider, easy to extend
- 🔄 **Multi-tenant Ready** - Scope-based policy isolation
- 📦 **Monorepo Architecture** - Modular packages for different use cases
- 🚀 **Zero Dependencies** - Core engine is dependency-free
- 📘 **TypeScript First** - Full type safety and IntelliSense

## 📦 Packages

Autorix is organized as a monorepo with three main packages:

| Package | Description | Version |
|---------|-------------|---------|
| [@autorix/core](./packages/core) | Core policy evaluation engine | ![npm](https://img.shields.io/npm/v/@autorix/core) |
| [@autorix/nestjs](./packages/nestjs) | NestJS integration with decorators and guards | ![npm](https://img.shields.io/npm/v/@autorix/nestjs) |
| [@autorix/storage](./packages/storage) | Policy storage providers and abstractions | ![npm](https://img.shields.io/npm/v/@autorix/storage) |

## 🚀 Quick Start

### Installation

```bash
# For NestJS projects
npm install @autorix/nestjs @autorix/core @autorix/storage

# For standalone Node.js projects
npm install @autorix/core
```

### Basic Usage with NestJS

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AutorixModule, AutorixGuard } from '@autorix/nestjs';
import { MemoryPolicyProvider } from '@autorix/storage';

@Module({
  imports: [
    AutorixModule.forRoot({
      policyProvider: new MemoryPolicyProvider()
        .addPolicy({
          id: 'user-policy',
          scope: { type: 'TENANT', id: 'tenant-123' },
          document: {
            Statement: [
              {
                Effect: 'Allow',
                Action: ['document:read', 'document:list'],
                Resource: 'document/*',
              },
            ],
          },
        })
        .attachPolicy({
          policyId: 'user-policy',
          scope: { type: 'TENANT', id: 'tenant-123' },
          principal: { type: 'USER', id: 'user-456' },
        }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AutorixGuard,
    },
  ],
})
export class AppModule {}

// document.controller.ts
import { Controller, Get, Post, Delete, Param } from '@nestjs/common';
import { Policy, ResourceParam } from '@autorix/nestjs';

@Controller('documents')
export class DocumentController {
  @Get()
  @Policy('document:list')
  async listDocuments() {
    return this.documentService.findAll();
  }

  @Get(':id')
  @Policy('document:read')
  @ResourceParam('document')
  async getDocument(@Param('id') id: string) {
    return this.documentService.findOne(id);
  }

  @Delete(':id')
  @Policy('document:delete')
  @ResourceParam('document')
  async deleteDocument(@Param('id') id: string) {
    return this.documentService.delete(id);
  }
}
```

### Standalone Usage (Core Only)

```typescript
import { evaluate } from '@autorix/core';

const policy = {
  Statement: [
    {
      Effect: 'Allow',
      Action: 'document:read',
      Resource: 'document/*',
      Condition: {
        StringEquals: {
          'resource.ownerId': '${principal.id}',
        },
      },
    },
  ],
};

const decision = evaluate({
  action: 'document:read',
  resource: 'document/123',
  policy,
  ctx: {
    principal: { id: 'user-456' },
    resource: { ownerId: 'user-456' },
  },
});

console.log(decision);
// { allowed: true, reason: 'EXPLICIT_ALLOW', matchedStatements: ['stmt#0'] }
```

## 📚 Documentation

Each package has comprehensive documentation:

- **[@autorix/core](./packages/core/README.md)** - Core evaluation engine, policy syntax, conditions
- **[@autorix/nestjs](./packages/nestjs/README.md)** - NestJS decorators, guards, configuration
- **[@autorix/storage](./packages/storage/README.md)** - Storage providers, custom implementations

## 🎯 Use Cases

### 1. Multi-tenant SaaS Applications

```typescript
const policy = {
  Statement: [
    {
      Effect: 'Allow',
      Action: '*',
      Resource: '*',
      Condition: {
        StringEquals: {
          'principal.tenantId': '${resource.tenantId}',
        },
      },
    },
  ],
};
```

### 2. Document Management with Ownership

```typescript
const policy = {
  Statement: [
    {
      Sid: 'OwnDocuments',
      Effect: 'Allow',
      Action: 'document:*',
      Resource: 'document/*',
      Condition: {
        StringEquals: {
          'resource.ownerId': '${principal.id}',
        },
      },
    },
    {
      Sid: 'PublicRead',
      Effect: 'Allow',
      Action: 'document:read',
      Resource: 'document/*',
      Condition: {
        Bool: {
          'resource.isPublic': true,
        },
      },
    },
  ],
};
```

### 3. Role-based Access Control

```typescript
const policy = {
  Statement: [
    {
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
      Effect: 'Allow',
      Action: ['*:read', '*:list'],
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

### 4. Department-based Permissions

```typescript
const policy = {
  Statement: [
    {
      Effect: 'Allow',
      Action: ['report:read', 'report:list'],
      Resource: 'report/*',
      Condition: {
        StringEquals: {
          'resource.department': '${principal.department}',
        },
      },
    },
  ],
};
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Application                      │
└───────────────────┬─────────────────────────────────────┘
                    │
        ┌───────────┴────────────┐
        │                        │
┌───────▼────────┐      ┌────────▼────────┐
│ @autorix/nestjs│      │  @autorix/core  │
│   (Optional)   │      │   (Required)    │
│                │      │                 │
│ • Decorators   │      │ • Evaluation    │
│ • Guards       │      │ • Matching      │
│ • Resolvers    │      │ • Conditions    │
└───────┬────────┘      └────────┬────────┘
        │                        │
        │         ┌──────────────┘
        │         │
    ┌───▼─────────▼──┐
    │ @autorix/storage│
    │                 │
    │ • Providers     │
    │ • Memory        │
    │ • Database      │
    └─────────────────┘
```

## 🔧 Development

### Prerequisites

- Node.js >= 18
- pnpm >= 10.10.0

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/autorix.git
cd autorix

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Monorepo Scripts

```bash
# Build all packages
pnpm build

# Run tests for all packages
pnpm test

# Clean build artifacts
pnpm clean

# Commit with conventional commits
pnpm co
```

### Package Structure

```
autorix/
├── packages/
│   ├── core/           # Core evaluation engine
│   ├── nestjs/         # NestJS integration
│   └── storage/        # Storage providers
├── package.json        # Root package.json
├── pnpm-workspace.yaml # Workspace configuration
├── tsconfig.base.json  # Shared TypeScript config
└── vitest.config.ts    # Shared test configuration
```

## 🧪 Testing

Each package includes comprehensive test coverage:

```bash
# Test specific package
cd packages/core
pnpm test

# Test all packages
pnpm test
```

## 🔐 Policy Evaluation Logic

Autorix follows AWS IAM evaluation logic:

1. **Default Deny**: By default, all requests are denied
2. **Explicit Deny Wins**: If any statement explicitly denies, the request is denied
3. **Explicit Allow Required**: At least one statement must explicitly allow
4. **Final Decision**: Allow only if there's an allow and no deny

```
Start
  ↓
Is there an explicit Deny?
  ├─ Yes → DENIED
  └─ No → Continue
         ↓
    Is there an explicit Allow?
      ├─ Yes → ALLOWED
      └─ No → DENIED (Default)
```

## 📊 Policy Structure

```typescript
interface PolicyDocument {
  Version?: string;
  Statement: Statement[];
}

interface Statement {
  Sid?: string;                    // Statement ID
  Effect: 'Allow' | 'Deny';        // Permission effect
  Action: string | string[];       // Actions to match
  Resource: string | string[];     // Resources to match
  Condition?: ConditionBlock;      // Optional conditions
}
```

### Supported Condition Operators

- **StringEquals** - Exact string match
- **StringLike** - Wildcard pattern match
- **NumericEquals** - Number comparison
- **Bool** - Boolean comparison

### Variable Interpolation

Reference context values in conditions:

```typescript
{
  Condition: {
    StringEquals: {
      'resource.ownerId': '${principal.id}',
      'resource.tenantId': '${principal.tenantId}',
    }
  }
}
```

## 🌟 Examples

### Complete NestJS Application

Check out the [examples](./examples) directory for complete working examples:

- **Basic CRUD** - Simple resource protection
- **Multi-tenant** - Tenant isolation with policies
- **RBAC** - Role-based access control
- **ABAC** - Attribute-based access control

### Custom Storage Provider

```typescript
import { PolicyProvider, PolicySource, GetPoliciesInput } from '@autorix/storage';

class PostgresPolicyProvider implements PolicyProvider {
  constructor(private pool: Pool) {}

  async getPolicies(input: GetPoliciesInput): Promise<PolicySource[]> {
    const result = await this.pool.query(
      `SELECT p.id, p.document
       FROM policies p
       JOIN policy_attachments pa ON p.id = pa.policy_id
       WHERE p.scope_type = $1 AND p.scope_id = $2
         AND (pa.principal_type = $3 AND pa.principal_id = $4)`,
      [input.scope.type, input.scope.id, input.principal.type, input.principal.id]
    );

    return result.rows.map(row => ({
      id: row.id,
      document: row.document,
    }));
  }
}
```

## 📖 API Overview

### Core Package (@autorix/core)

```typescript
import { evaluate, evaluateAll, assertAllowed, wildcardMatch } from '@autorix/core';

// Evaluate single policy
const decision = evaluate({ action, resource, policy, ctx });

// Evaluate multiple policies
const decision = evaluateAll({ action, resource, policies, ctx });

// Assert allowed or throw
assertAllowed(decision);

// Wildcard matching
wildcardMatch('document:*', 'document:read'); // true
```

### NestJS Package (@autorix/nestjs)

```typescript
import { AutorixModule, AutorixGuard, Policy, ResourceParam, Resource } from '@autorix/nestjs';

// Decorators
@Policy('document:read')
@ResourceParam('document')
@Resource({ type: 'document', id: ({ req }) => req.params.id })
```

### Storage Package (@autorix/storage)

```typescript
import { MemoryPolicyProvider } from '@autorix/storage';

const provider = new MemoryPolicyProvider()
  .addPolicy({ id, scope, document })
  .attachPolicy({ policyId, scope, principal });

const policies = await provider.getPolicies({ scope, principal, roleIds, groupIds });
```

## 🛣️ Roadmap

- [ ] Additional storage providers (PostgreSQL, MongoDB, Redis)
- [ ] Policy editor UI
- [ ] Audit logging and compliance
- [ ] Policy testing utilities
- [ ] Policy migration tools
- [ ] Performance benchmarks
- [ ] GraphQL integration
- [ ] Express.js middleware
- [ ] Fastify plugin

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for your changes
5. Ensure all tests pass (`pnpm test`)
6. Commit using conventional commits (`pnpm co`)
7. Push to your fork
8. Open a Pull Request

## 📄 License

MIT © Autorix

See [LICENSE](./LICENSE) for details.

## 👥 Authors

- **Sergio Galaz** - [@chechooxd](https://github.com/chechooxd) - [sergiogalaz60@gmail.com](mailto:sergiogalaz60@gmail.com)

## 🙏 Acknowledgments

- Inspired by AWS IAM policy evaluation
- Built with ❤️ for the Node.js and NestJS community

## 📞 Support

- 📧 Email: sergiogalaz60@gmail.com
- 🐛 Issues: [GitHub Issues](https://github.com/chechooxd/autorix/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/chechooxd/autorix/discussions)

## 🔗 Links

- [Documentation](https://autorix.dev)
- [NPM Organization](https://www.npmjs.com/org/autorix)
- [GitHub Repository](https://github.com/chechooxd/autorix)

---

Made with ❤️ by the Autorix team
