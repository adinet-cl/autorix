# @autorix/nestjs

**NestJS Integration for Autorix** - Seamless authorization for your NestJS applications with decorators and guards.

## 📋 Overview

`@autorix/nestjs` provides a complete NestJS integration for the Autorix policy evaluation engine. Protect your routes and controllers with simple decorators while maintaining fine-grained, policy-based access control.

## ✨ Features

- 🎨 **Decorator-based API** - Clean and intuitive route protection
- 🛡️ **Global Guard** - Apply authorization across your entire application
- 🔧 **Highly Customizable** - Custom resolvers for principal, scope, and context
- 🎯 **Resource-aware** - ABAC support with resource attributes and metadata
- 🚀 **Zero-config Defaults** - Works out of the box with sensible defaults
- 📦 **Type-safe** - Full TypeScript support
- 🔄 **Multi-tenant Ready** - Built-in tenant isolation support

## 📦 Installation

```bash
npm install @autorix/nestjs @autorix/core @autorix/storage
```

```bash
pnpm add @autorix/nestjs @autorix/core @autorix/storage
```

```bash
yarn add @autorix/nestjs @autorix/core @autorix/storage
```

## 🚀 Quick Start

### 1. Setup Module

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AutorixModule, AutorixGuard } from '@autorix/nestjs';
import { MemoryPolicyProvider } from '@autorix/storage';

@Module({
  imports: [
    AutorixModule.forRoot({
      policyProvider: new MemoryPolicyProvider([
        {
          id: 'policy-1',
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
        },
      ]),
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
```

### 2. Protect Your Routes

```typescript
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

  @Post()
  @Policy('document:create')
  async createDocument(@Body() dto: CreateDocumentDto) {
    return this.documentService.create(dto);
  }

  @Delete(':id')
  @Policy('document:delete')
  @ResourceParam('document')
  async deleteDocument(@Param('id') id: string) {
    return this.documentService.delete(id);
  }
}
```

## 📚 Core Concepts

### Decorators

#### `@Policy(...actions: string[])`

Defines the actions required to access a route. Multiple actions can be specified.

```typescript
@Policy('document:read')
@Get(':id')
getDocument() { }

@Policy('document:read', 'document:update')
@Get(':id')
viewAndEdit() { }
```

#### `@ResourceParam(type: string, param?: string)`

Extracts resource information from route parameters. By default, uses the `id` parameter.

```typescript
@ResourceParam('document')           // Uses :id param
@Get(':id')

@ResourceParam('user', 'userId')     // Uses :userId param
@Get(':userId')
```

#### `@Resource(meta: AutorixResourceMeta)`

Advanced resource resolution with custom resolvers for ID, attributes, and tenant.

```typescript
@Resource({
  type: 'document',
  id: async ({ req }) => req.params.id,
  attributes: async ({ req }) => {
    const doc = await getDocument(req.params.id);
    return { 
      ownerId: doc.ownerId,
      isPublic: doc.isPublic 
    };
  },
  tenantId: async ({ req }) => req.user.tenantId,
})
@Get(':id')
```

## 🔧 Configuration

### Module Options

Configure Autorix behavior with custom resolvers:

```typescript
AutorixModule.forRoot({
  policyProvider: myPolicyProvider,
  options: {
    scopeResolver: async (ctx: ExecutionContext) => {
      const req = ctx.switchToHttp().getRequest();
      return {
        type: 'TENANT',
        id: req.headers['x-tenant-id'],
      };
    },
    
    principalResolver: async (ctx: ExecutionContext) => {
      const req = ctx.switchToHttp().getRequest();
      return {
        principalId: req.user.id,
        roleIds: req.user.roles,
        groupIds: req.user.groups,
        principalAttributes: {
          email: req.user.email,
          department: req.user.department,
        },
      };
    },
    
    contextResolver: async (ctx, scope, principal, resource) => {
      const req = ctx.switchToHttp().getRequest();
      return {
        principal: {
          id: principal.principalId,
          tenantId: scope?.id,
          roles: principal.roleIds,
          ...principal.principalAttributes,
        },
        resource,
        request: {
          method: req.method,
          path: req.url,
          ip: req.ip,
        },
        scope,
      };
    },
  },
})
```

### Options Interface

```typescript
interface AutorixNestjsOptions {
  // Determines the scope (tenant/workspace/etc) for loading policies
  scopeResolver?: (ctx: ExecutionContext) => 
    Promise<AutorixScope> | AutorixScope;
  
  // Determines who the principal (user) is + roles/groups
  principalResolver?: (ctx: ExecutionContext) => 
    Promise<PrincipalResolverResult> | PrincipalResolverResult;
  
  // Builds the canonical AutorixContext for ABAC
  contextResolver?: (
    ctx: ExecutionContext,
    scope: AutorixScope,
    principal: PrincipalResolverResult,
    resource?: Record<string, any>
  ) => Promise<AutorixContext> | AutorixContext;
}
```

## 🎯 Advanced Usage

### Multi-Action Policies

Require multiple actions to be allowed:

```typescript
@Controller('admin')
export class AdminController {
  @Policy('admin:access', 'user:manage')
  @Get('users')
  manageUsers() {
    // Requires BOTH actions to be allowed
  }
}
```

### Class-level Policies

Apply policies to all routes in a controller:

```typescript
@Controller('documents')
@Policy('document:access')  // Required for all routes
export class DocumentController {
  @Get()
  @Policy('document:list')  // Requires BOTH document:access AND document:list
  list() { }
  
  @Get(':id')
  @Policy('document:read')  // Requires BOTH document:access AND document:read
  get() { }
}
```

### Resource with Custom Attributes

Use resource attributes in policy conditions:

```typescript
@Controller('documents')
export class DocumentController {
  @Get(':id')
  @Policy('document:read')
  @Resource({
    type: 'document',
    id: async ({ req }) => req.params.id,
    attributes: async ({ req }) => {
      const document = await this.service.findOne(req.params.id);
      return {
        ownerId: document.ownerId,
        isPublic: document.isPublic,
        status: document.status,
      };
    },
  })
  async getDocument(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
```

**Policy Example:**
```typescript
{
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
    {
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
}
```

### Custom Scope Resolver

Implement custom scoping logic:

```typescript
AutorixModule.forRoot({
  policyProvider: myProvider,
  options: {
    scopeResolver: async (ctx) => {
      const req = ctx.switchToHttp().getRequest();
      
      // Workspace-level scoping
      if (req.headers['x-workspace-id']) {
        return {
          type: 'WORKSPACE',
          id: req.headers['x-workspace-id'],
        };
      }
      
      // Tenant-level scoping
      if (req.user?.tenantId) {
        return {
          type: 'TENANT',
          id: req.user.tenantId,
        };
      }
      
      // Global scope
      return { type: 'GLOBAL' };
    },
  },
})
```

### Custom Principal Resolver

Extract principal information from different sources:

```typescript
AutorixModule.forRoot({
  policyProvider: myProvider,
  options: {
    principalResolver: async (ctx) => {
      const req = ctx.switchToHttp().getRequest();
      
      // From JWT token
      const user = req.user;
      
      // Fetch additional attributes from database
      const userDetails = await userService.getDetails(user.id);
      
      return {
        principalId: user.id,
        roleIds: userDetails.roles.map(r => r.id),
        groupIds: userDetails.groups.map(g => g.id),
        principalAttributes: {
          email: user.email,
          department: userDetails.department,
          level: userDetails.level,
          isVerified: userDetails.emailVerified,
        },
      };
    },
  },
})
```

## 🔍 Examples

### Example 1: Basic CRUD with Authorization

```typescript
import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { Policy, ResourceParam } from '@autorix/nestjs';

@Controller('articles')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get()
  @Policy('article:list')
  async list() {
    return this.articleService.findAll();
  }

  @Get(':id')
  @Policy('article:read')
  @ResourceParam('article')
  async get(@Param('id') id: string) {
    return this.articleService.findOne(id);
  }

  @Post()
  @Policy('article:create')
  async create(@Body() dto: CreateArticleDto) {
    return this.articleService.create(dto);
  }

  @Put(':id')
  @Policy('article:update')
  @ResourceParam('article')
  async update(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.articleService.update(id, dto);
  }

  @Delete(':id')
  @Policy('article:delete')
  @ResourceParam('article')
  async delete(@Param('id') id: string) {
    return this.articleService.delete(id);
  }
}
```

**Corresponding Policy:**
```typescript
{
  Statement: [
    {
      Sid: 'AllowReadPublic',
      Effect: 'Allow',
      Action: ['article:list', 'article:read'],
      Resource: 'article/*',
    },
    {
      Sid: 'AllowOwnArticleManagement',
      Effect: 'Allow',
      Action: ['article:*'],
      Resource: 'article/*',
      Condition: {
        StringEquals: {
          'resource.ownerId': '${principal.id}',
        },
      },
    },
    {
      Sid: 'AdminFullAccess',
      Effect: 'Allow',
      Action: 'article:*',
      Resource: 'article/*',
      Condition: {
        StringLike: {
          'principal.roles': '*admin*',
        },
      },
    },
  ],
}
```

### Example 2: Multi-tenant Application

```typescript
@Controller('projects')
export class ProjectController {
  @Get()
  @Policy('project:list')
  async list(@Req() req: Request) {
    // Policy ensures user can only see projects in their tenant
    return this.projectService.findAll(req.user.tenantId);
  }

  @Post()
  @Policy('project:create')
  async create(@Body() dto: CreateProjectDto) {
    return this.projectService.create(dto);
  }

  @Get(':id')
  @Policy('project:read')
  @Resource({
    type: 'project',
    id: ({ req }) => req.params.id,
    tenantId: async ({ req }) => {
      const project = await this.projectService.findOne(req.params.id);
      return project.tenantId;
    },
  })
  async get(@Param('id') id: string) {
    return this.projectService.findOne(id);
  }
}
```

**Multi-tenant Policy:**
```typescript
{
  Statement: [
    {
      Sid: 'SameTenantOnly',
      Effect: 'Allow',
      Action: 'project:*',
      Resource: 'project/*',
      Condition: {
        StringEquals: {
          'principal.tenantId': '${resource.tenantId}',
        },
      },
    },
  ],
}
```

### Example 3: Role-based with ABAC

```typescript
@Controller('reports')
export class ReportController {
  @Get()
  @Policy('report:list')
  async list() {
    return this.reportService.findAll();
  }

  @Get(':id')
  @Policy('report:read')
  @Resource({
    type: 'report',
    id: ({ req }) => req.params.id,
    attributes: async ({ req }) => {
      const report = await this.reportService.findOne(req.params.id);
      return {
        ownerId: report.ownerId,
        department: report.department,
        sensitivity: report.sensitivity,
      };
    },
  })
  async get(@Param('id') id: string) {
    return this.reportService.findOne(id);
  }

  @Post()
  @Policy('report:create')
  async create(@Body() dto: CreateReportDto) {
    return this.reportService.create(dto);
  }
}
```

**ABAC Policy:**
```typescript
{
  Statement: [
    {
      Sid: 'OwnReports',
      Effect: 'Allow',
      Action: 'report:*',
      Resource: 'report/*',
      Condition: {
        StringEquals: {
          'resource.ownerId': '${principal.id}',
        },
      },
    },
    {
      Sid: 'DepartmentReports',
      Effect: 'Allow',
      Action: ['report:read', 'report:list'],
      Resource: 'report/*',
      Condition: {
        StringEquals: {
          'resource.department': '${principal.department}',
        },
      },
    },
    {
      Sid: 'DenySensitive',
      Effect: 'Deny',
      Action: 'report:read',
      Resource: 'report/*',
      Condition: {
        StringEquals: {
          'resource.sensitivity': 'high',
        },
      },
    },
  ],
}
```

## 🔐 Default Behavior

### Default Scope Resolver
Extracts tenant from `req.tenantId` or `req.user.tenantId`:
```typescript
{ type: 'TENANT', id: req.user.tenantId }
```

### Default Principal Resolver
Extracts principal from `req.user`:
```typescript
{
  principalId: req.user.id ?? req.user.sub,
  roleIds: req.user.roles ?? [],
  groupIds: req.user.groups ?? [],
  principalAttributes: req.user,
}
```

### Default Context Resolver
Builds context with principal, request info, and resource:
```typescript
{
  principal: {
    id: principalId,
    tenantId: scope?.id,
    roles: roleIds,
    ...principalAttributes,
  },
  resource: resource ?? undefined,
  request: {
    method: req.method,
    path: req.url,
  },
  scope: { type: scope.type, id: scope.id },
}
```

## 🚨 Error Handling

The guard throws standard NestJS exceptions:

- **`UnauthorizedException`** - When principal cannot be resolved (no `req.user`)
- **`ForbiddenException`** - When policy evaluation denies access or resource resolution fails

```typescript
@Controller('documents')
export class DocumentController {
  @Get(':id')
  @Policy('document:read')
  @ResourceParam('document')
  async get(@Param('id') id: string) {
    // If denied: throws ForbiddenException
    // If no user: throws UnauthorizedException
    return this.service.findOne(id);
  }
}
```

Handle exceptions globally:

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, ForbiddenException } from '@nestjs/common';

@Catch(ForbiddenException)
export class AutorixExceptionFilter implements ExceptionFilter {
  catch(exception: ForbiddenException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    
    response.status(403).json({
      statusCode: 403,
      message: 'Access Denied',
      error: 'Forbidden',
      details: exception.message,
    });
  }
}
```

## 🧪 Testing

### Testing Controllers with Autorix

```typescript
import { Test } from '@nestjs/testing';
import { AutorixGuard } from '@autorix/nestjs';
import { DocumentController } from './document.controller';

describe('DocumentController', () => {
  let controller: DocumentController;
  let guard: AutorixGuard;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DocumentController],
      providers: [
        {
          provide: AutorixGuard,
          useValue: {
            canActivate: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(DocumentController);
    guard = moduleRef.get(AutorixGuard);
  });

  it('should allow access when authorized', async () => {
    const result = await controller.list();
    expect(guard.canActivate).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should deny access when unauthorized', async () => {
    jest.spyOn(guard, 'canActivate').mockResolvedValue(false);
    
    await expect(controller.list()).rejects.toThrow(ForbiddenException);
  });
});
```

### Integration Testing

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './app.module';

describe('Authorization (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  it('GET /documents - should allow with valid token', () => {
    return request(app.getHttpServer())
      .get('/documents')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);
  });

  it('GET /documents - should deny without token', () => {
    return request(app.getHttpServer())
      .get('/documents')
      .expect(401);
  });

  afterAll(async () => {
    await app.close();
  });
});
```

## 📊 Best Practices

1. **Use Class-level policies for common requirements**
   ```typescript
   @Controller('admin')
   @Policy('admin:access')  // All routes require this
   export class AdminController { }
   ```

2. **Combine @Policy with @ResourceParam for resource-specific checks**
   ```typescript
   @Delete(':id')
   @Policy('document:delete')
   @ResourceParam('document')
   async delete(@Param('id') id: string) { }
   ```

3. **Use @Resource for complex ABAC scenarios**
   ```typescript
   @Resource({
     type: 'document',
     id: ({ req }) => req.params.id,
     attributes: async ({ req }) => await fetchAttributes(req.params.id),
   })
   ```

4. **Keep policies in a centralized location**
   - Store policies in a database
   - Version control your policy definitions
   - Use policy templates for common patterns

5. **Test your authorization logic thoroughly**
   - Test both allow and deny scenarios
   - Test with different roles and contexts
   - Use integration tests for critical paths

## 🔗 Related Packages

- **[@autorix/core](../core)** - Core policy evaluation engine
- **[@autorix/storage](../storage)** - Policy storage providers

## 📄 License

MIT © Autorix

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions, please use the [GitHub Issues](https://github.com/yourusername/autorix/issues) page.
