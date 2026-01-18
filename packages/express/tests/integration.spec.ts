import express from "express";
import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import { autorixExpress } from "../src/middleware/autorixExpress";
import { authorize } from "../src/middleware/authorize";
import { AutorixHttpError } from "../src/errors/AutorixHttpErrors";
import { evaluateAll } from "@autorix/core";
import { AutorixScope, MemoryPolicyProvider } from "@autorix/storage";

function errorHandler(err: any, _req: any, res: any, _next: any) {
  if (err instanceof AutorixHttpError) {
    return res.status(err.statusCode).json({ code: err.code, message: err.message });
  }
  const status = err?.status ?? 500;
  return res.status(status).json({ message: err?.message ?? "Internal Error" });
}

describe("Express Integration with Real Policies", () => {
  let policyProvider: MemoryPolicyProvider;

  beforeEach(() => {
    policyProvider = new MemoryPolicyProvider();
  });

  function createEnforcer() {
    return {
      can: async (input: { action: string; resource: string; context: any }) => {
        if (!input.context?.principal) {
          return { allowed: false, reason: "Unauthenticated" };
        }

        const scope:AutorixScope = { type: "TENANT", id: input.context.tenantId || "default" };

        const policies = await policyProvider.getPolicies({
          scope,
          principal: { type: "USER", id: input.context.principal.id },
          roleIds: input.context.principal?.roles,
        });

        // Debug log for policy lookup
        if (process.env.DEBUG && policies.length === 0) {
          console.log('No policies found for:', { 
            scope,
            principal: { type: "USER", id: input.context.principal.id },
            roleIds: input.context.principal?.roles,
          });
        }

        // Transform Express context to Core context
        const coreContext = {
          scope,
          principal: input.context.principal,
          resource: input.context.resource,
          request: {
            ip: input.context.ip,
            headers: { "user-agent": input.context.userAgent },
          },
          context: {
            scope,
            ...input.context.attributes,
          },
        };

        const result = evaluateAll({
          policies: policies.map((p) => p.document),
          action: input.action,
          resource: input.resource,
          ctx: coreContext,
        });

        // Debug log
        if (!result.allowed && process.env.DEBUG) {
          console.log('Decision:', { 
            action: input.action, 
            resource: input.resource,
            principal: coreContext.principal,
            resourceData: coreContext.resource,
            policies: policies.length,
            reason: result.reason 
          });
        }

        return { allowed: result.allowed, reason: result.reason };
      },
    };
  }

  describe("RBAC - Role-Based Access Control", () => {
    it("should allow admin to access all resources", async () => {
      // Setup policy
      policyProvider.addPolicy({
        id: "admin-policy",
        scope: { type: "TENANT", id: "t1" },
        document: {
          Statement: [
            {
              Sid: "AdminFullAccess",
              Effect: "Allow",
              Action: ["*"],
              Resource: ["*"],
            },
          ],
        },
      });

      policyProvider.attachPolicy({
        policyId: "admin-policy",
        scope: { type: "TENANT", id: "t1" },
        principal: { type: "ROLE", id: "admin" },
      });

      const app = express();
      app.use(
        autorixExpress({
          enforcer: createEnforcer(),
          getPrincipal: async () => ({ id: "u1", roles: ["admin"] }),
          getTenant: async () => "t1",
        }),
      );

      app.get("/users", authorize("user:list"), (_req, res) => res.json({ users: [] }));
      app.delete("/users/:id", authorize("user:delete"), (_req, res) => res.json({ deleted: true }));
      app.use(errorHandler);

      const r1 = await request(app).get("/users");
      expect(r1.status).toBe(200);

      const r2 = await request(app).delete("/users/123");
      expect(r2.status).toBe(200);
    });

    it("should deny user without proper role", async () => {
      policyProvider.addPolicy({
        id: "viewer-policy",
        scope: { type: "TENANT", id: "t1" },
        document: {
          Statement: [
            {
              Effect: "Allow",
              Action: ["user:read", "user:list"],
              Resource: ["user/*"],
            },
          ],
        },
      });

      policyProvider.attachPolicy({
        policyId: "viewer-policy",
        scope: { type: "TENANT", id: "t1" },
        principal: { type: "ROLE", id: "viewer" },
      });

      const app = express();
      app.use(
        autorixExpress({
          enforcer: createEnforcer(),
          getPrincipal: async () => ({ id: "u2", roles: ["viewer"] }),
          getTenant: async () => "t1",
        }),
      );

      app.get("/users", authorize("user:list"), (_req, res) => res.json({ users: [] }));
      app.delete("/users/:id", authorize("user:delete"), (_req, res) => res.json({ deleted: true }));
      app.use(errorHandler);

      const r1 = await request(app).get("/users");
      expect(r1.status).toBe(200); // Can list

      const r2 = await request(app).delete("/users/123");
      expect(r2.status).toBe(403); // Cannot delete
      expect(r2.body.code).toBe("AUTORIX_FORBIDDEN");
    });
  });

  describe("ABAC - Attribute-Based Access Control", () => {
    it("should allow user to delete own posts only", async () => {
      policyProvider.addPolicy({
        id: "post-owner-policy",
        scope: { type: "TENANT", id: "t1" },
        document: {
          Statement: [
            {
              Sid: "AllowPostDeleteForOwner",
              Effect: "Allow",
              Action: ["post:delete"],
              Resource: ["post/*"],
              Condition: {
                StringEquals: {
                  "resource.authorId": "${principal.id}",
                },
              },
            },
          ],
        },
      });

      policyProvider.attachPolicy({
        policyId: "post-owner-policy",
        scope: { type: "TENANT", id: "t1" },
        principal: { type: "USER", id: "u1" },
      });

      // Mock database
      const posts = {
        p1: { id: "p1", title: "My Post", authorId: "u1" },
        p2: { id: "p2", title: "Other Post", authorId: "u2" },
      };

      const app = express();
      app.use(
        autorixExpress({
          enforcer: createEnforcer(),
          getPrincipal: async () => ({ id: "u1" }),
          getTenant: async () => "t1",
        }),
      );

      app.delete(
        "/posts/:id",
        authorize({
          action: "post:delete",
          resource: {
            type: "post",
            idFrom: (req) => req.params.id,
            loader: async (id) => posts[id as keyof typeof posts],
          },
        }),
        (_req, res) => res.json({ deleted: true }),
      );

      app.use(errorHandler);

      // Can delete own post
      const r1 = await request(app).delete("/posts/p1");
      expect(r1.status).toBe(200);

      // Cannot delete other's post
      const r2 = await request(app).delete("/posts/p2");
      expect(r2.status).toBe(403);
    });

    it("should allow manager to edit posts in their department", async () => {
      policyProvider.addPolicy({
        id: "manager-policy",
        scope: { type: "TENANT", id: "t1" },
        document: {
          Statement: [
            {
              Sid: "ManagerEditDepartmentPosts",
              Effect: "Allow",
              Action: ["post:update"],
              Resource: ["post/*"],
              Condition: {
                StringEquals: {
                  "resource.department": "${principal.department}",
                },
              },
            },
          ],
        },
      });

      policyProvider.attachPolicy({
        policyId: "manager-policy",
        scope: { type: "TENANT", id: "t1" },
        principal: { type: "ROLE", id: "manager" },
      });

      const posts = {
        p1: { id: "p1", department: "engineering" },
        p2: { id: "p2", department: "marketing" },
      };

      const app = express();
      app.use(
        autorixExpress({
          enforcer: createEnforcer(),
          getPrincipal: async () => ({ id: "u1", roles: ["manager"], department: "engineering" }),
          getTenant: async () => "t1",
        }),
      );

      app.put(
        "/posts/:id",
        authorize({
          action: "post:update",
          resource: {
            type: "post",
            idFrom: (req) => req.params.id,
            loader: async (id) => posts[id as keyof typeof posts],
          },
        }),
        (_req, res) => res.json({ updated: true }),
      );

      app.use(errorHandler);

      // Can edit in own department
      const r1 = await request(app).put("/posts/p1");
      expect(r1.status).toBe(200);

      // Cannot edit in other department
      const r2 = await request(app).put("/posts/p2");
      expect(r2.status).toBe(403);
    });
  });

  describe("Explicit Deny Wins", () => {
    it("should deny even when there's an allow if explicit deny exists", async () => {
      policyProvider.addPolicy({
        id: "allow-all-policy",
        scope: { type: "TENANT", id: "t1" },
        document: {
          Statement: [
            {
              Sid: "AllowAll",
              Effect: "Allow",
              Action: ["*"],
              Resource: ["*"],
            },
          ],
        },
      });

      policyProvider.addPolicy({
        id: "deny-sensitive-policy",
        scope: { type: "TENANT", id: "t1" },
        document: {
          Statement: [
            {
              Sid: "DenySensitive",
              Effect: "Deny",
              Action: ["document:delete"],
              Resource: ["document/*"],
              Condition: {
                StringEquals: {
                  "resource.sensitive": "true",
                },
              },
            },
          ],
        },
      });

      policyProvider.attachPolicy({
        policyId: "allow-all-policy",
        scope: { type: "TENANT", id: "t1" },
        principal: { type: "USER", id: "u1" },
      });

      policyProvider.attachPolicy({
        policyId: "deny-sensitive-policy",
        scope: { type: "TENANT", id: "t1" },
        principal: { type: "USER", id: "u1" },
      });

      const documents = {
        d1: { id: "d1", sensitive: "false" },
        d2: { id: "d2", sensitive: "true" },
      };

      const app = express();
      app.use(
        autorixExpress({
          enforcer: createEnforcer(),
          getPrincipal: async () => ({ id: "u1" }),
          getTenant: async () => "t1",
        }),
      );

      app.delete(
        "/documents/:id",
        authorize({
          action: "document:delete",
          resource: {
            type: "document",
            idFrom: (req) => req.params.id,
            loader: async (id) => documents[id as keyof typeof documents],
          },
        }),
        (_req, res) => res.json({ deleted: true }),
      );

      app.use(errorHandler);

      // Can delete non-sensitive
      const r1 = await request(app).delete("/documents/d1");
      expect(r1.status).toBe(200);

      // Cannot delete sensitive (deny wins)
      const r2 = await request(app).delete("/documents/d2");
      expect(r2.status).toBe(403);
    });
  });

  describe("Multi-Tenancy", () => {
    it("should isolate policies by tenant", async () => {
      // Tenant 1 policy
      policyProvider.addPolicy({
        id: "t1-policy",
        scope: { type: "TENANT", id: "t1" },
        document: {
          Statement: [
            {
              Effect: "Allow",
              Action: ["document:read"],
              Resource: ["document/*"],
            },
          ],
        },
      });

      policyProvider.attachPolicy({
        policyId: "t1-policy",
        scope: { type: "TENANT", id: "t1" },
        principal: { type: "USER", id: "u1" },
      });

      // Tenant 2 policy
      policyProvider.addPolicy({
        id: "t2-policy",
        scope: { type: "TENANT", id: "t2" },
        document: {
          Statement: [
            {
              Effect: "Allow",
              Action: ["document:write"],
              Resource: ["document/*"],
            },
          ],
        },
      });

      policyProvider.attachPolicy({
        policyId: "t2-policy",
        scope: { type: "TENANT", id: "t2" },
        principal: { type: "USER", id: "u1" },
      });

      // Tenant 1 user
      const app1 = express();
      app1.use(
        autorixExpress({
          enforcer: createEnforcer(),
          getPrincipal: async () => ({ id: "u1" }),
          getTenant: async () => "t1",
        }),
      );
      app1.get("/documents", authorize("document:read"), (_req, res) => res.json({ ok: true }));
      app1.post("/documents", authorize("document:write"), (_req, res) => res.json({ ok: true }));
      app1.use(errorHandler);

      const r1 = await request(app1).get("/documents");
      expect(r1.status).toBe(200); // Has read in t1

      const r2 = await request(app1).post("/documents");
      expect(r2.status).toBe(403); // No write in t1

      // Tenant 2 user
      const app2 = express();
      app2.use(
        autorixExpress({
          enforcer: createEnforcer(),
          getPrincipal: async () => ({ id: "u1" }),
          getTenant: async () => "t2",
        }),
      );
      app2.get("/documents", authorize("document:read"), (_req, res) => res.json({ ok: true }));
      app2.post("/documents", authorize("document:write"), (_req, res) => res.json({ ok: true }));
      app2.use(errorHandler);

      const r3 = await request(app2).get("/documents");
      expect(r3.status).toBe(403); // No read in t2

      const r4 = await request(app2).post("/documents");
      expect(r4.status).toBe(200); // Has write in t2
    });
  });

  describe("Wildcard Patterns", () => {
    it("should match wildcard actions", async () => {
      policyProvider.addPolicy({
        id: "wildcard-policy",
        scope: { type: "TENANT", id: "t1" },
        document: {
          Statement: [
            {
              Effect: "Allow",
              Action: ["user:*"], // All user actions
              Resource: ["user/*"],
            },
          ],
        },
      });

      policyProvider.attachPolicy({
        policyId: "wildcard-policy",
        scope: { type: "TENANT", id: "t1" },
        principal: { type: "USER", id: "u1" },
      });

      const app = express();
      app.use(
        autorixExpress({
          enforcer: createEnforcer(),
          getPrincipal: async () => ({ id: "u1" }),
          getTenant: async () => "t1",
        }),
      );

      app.get("/users", authorize("user:list"), (_req, res) => res.json({ ok: true }));
      app.get("/users/:id", authorize("user:read"), (_req, res) => res.json({ ok: true }));
      app.post("/users", authorize("user:create"), (_req, res) => res.json({ ok: true }));
      app.delete("/users/:id", authorize("user:delete"), (_req, res) => res.json({ ok: true }));
      app.use(errorHandler);

      const r1 = await request(app).get("/users");
      expect(r1.status).toBe(200);

      const r2 = await request(app).get("/users/123");
      expect(r2.status).toBe(200);

      const r3 = await request(app).post("/users");
      expect(r3.status).toBe(200);

      const r4 = await request(app).delete("/users/123");
      expect(r4.status).toBe(200);
    });

    it("should match wildcard resources", async () => {
      policyProvider.addPolicy({
        id: "all-docs-policy",
        scope: { type: "TENANT", id: "t1" },
        document: {
          Statement: [
            {
              Effect: "Allow",
              Action: ["read"],
              Resource: ["*"], // All resources
            },
          ],
        },
      });

      policyProvider.attachPolicy({
        policyId: "all-docs-policy",
        scope: { type: "TENANT", id: "t1" },
        principal: { type: "USER", id: "u1" },
      });

      const app = express();
      app.use(
        autorixExpress({
          enforcer: createEnforcer(),
          getPrincipal: async () => ({ id: "u1" }),
          getTenant: async () => "t1",
        }),
      );

      app.get("/documents", authorize("read"), (_req, res) => res.json({ ok: true }));
      app.get("/files", authorize("read"), (_req, res) => res.json({ ok: true }));
      app.get("/images", authorize("read"), (_req, res) => res.json({ ok: true }));
      app.use(errorHandler);

      expect((await request(app).get("/documents")).status).toBe(200);
      expect((await request(app).get("/files")).status).toBe(200);
      expect((await request(app).get("/images")).status).toBe(200);
    });
  });

  describe("Complex Conditions", () => {
    it("should evaluate numeric conditions", async () => {
      policyProvider.addPolicy({
        id: "price-limit-policy",
        scope: { type: "TENANT", id: "t1" },
        document: {
          Statement: [
            {
              Sid: "ApproveUnder1000",
              Effect: "Allow",
              Action: ["invoice:approve"],
              Resource: ["invoice/*"],
              Condition: {
                NumericEquals: {
                  "resource.amount": 500,
                },
              },
            },
          ],
        },
      });

      policyProvider.attachPolicy({
        policyId: "price-limit-policy",
        scope: { type: "TENANT", id: "t1" },
        principal: { type: "USER", id: "u1" },
      });

      const invoices = {
        i1: { id: "i1", amount: 500 },
        i2: { id: "i2", amount: 1500 },
      };

      const app = express();
      app.use(
        autorixExpress({
          enforcer: createEnforcer(),
          getPrincipal: async () => ({ id: "u1" }),
          getTenant: async () => "t1",
        }),
      );

      app.post(
        "/invoices/:id/approve",
        authorize({
          action: "invoice:approve",
          resource: {
            type: "invoice",
            idFrom: (req) => req.params.id,
            loader: async (id) => invoices[id as keyof typeof invoices],
          },
        }),
        (_req, res) => res.json({ approved: true }),
      );

      app.use(errorHandler);

      const r1 = await request(app).post("/invoices/i1/approve");
      expect(r1.status).toBe(200); // 500 allowed

      const r2 = await request(app).post("/invoices/i2/approve");
      expect(r2.status).toBe(403); // 1500 not allowed
    });

    it("should evaluate boolean conditions", async () => {
      policyProvider.addPolicy({
        id: "published-only-policy",
        scope: { type: "TENANT", id: "t1" },
        document: {
          Statement: [
            {
              Effect: "Allow",
              Action: ["post:view"],
              Resource: ["post/*"],
              Condition: {
                Bool: {
                  "resource.published": true,
                },
              },
            },
          ],
        },
      });

      policyProvider.attachPolicy({
        policyId: "published-only-policy",
        scope: { type: "TENANT", id: "t1" },
        principal: { type: "USER", id: "u1" },
      });

      const posts = {
        p1: { id: "p1", published: true },
        p2: { id: "p2", published: false },
      };

      const app = express();
      app.use(
        autorixExpress({
          enforcer: createEnforcer(),
          getPrincipal: async () => ({ id: "u1" }),
          getTenant: async () => "t1",
        }),
      );

      app.get(
        "/posts/:id",
        authorize({
          action: "post:view",
          resource: {
            type: "post",
            idFrom: (req) => req.params.id,
            loader: async (id) => posts[id as keyof typeof posts],
          },
        }),
        (_req, res) => res.json({ ok: true }),
      );

      app.use(errorHandler);

      const r1 = await request(app).get("/posts/p1");
      expect(r1.status).toBe(200); // Published

      const r2 = await request(app).get("/posts/p2");
      expect(r2.status).toBe(403); // Not published
    });

    it("should evaluate StringLike with wildcards", async () => {
      policyProvider.addPolicy({
        id: "email-domain-policy",
        scope: { type: "TENANT", id: "t1" },
        document: {
          Statement: [
            {
              Effect: "Allow",
              Action: ["user:invite"],
              Resource: ["user/*"],
              Condition: {
                StringLike: {
                  "resource.email": "*@company.com",
                },
              },
            },
          ],
        },
      });

      policyProvider.attachPolicy({
        policyId: "email-domain-policy",
        scope: { type: "TENANT", id: "t1" },
        principal: { type: "USER", id: "u1" },
      });

      const invitations = {
        inv1: { email: "john@company.com" },
        inv2: { email: "jane@external.com" },
      };

      const app = express();
      app.use(
        autorixExpress({
          enforcer: createEnforcer(),
          getPrincipal: async () => ({ id: "u1" }),
          getTenant: async () => "t1",
        }),
      );

      app.post(
        "/invitations/:id",
        authorize({
          action: "user:invite",
          resource: {
            type: "user",
            idFrom: (req) => req.params.id,
            loader: async (id) => invitations[id as keyof typeof invitations],
          },
        }),
        (_req, res) => res.json({ invited: true }),
      );

      app.use(errorHandler);

      const r1 = await request(app).post("/invitations/inv1");
      expect(r1.status).toBe(200); // company.com allowed

      const r2 = await request(app).post("/invitations/inv2");
      expect(r2.status).toBe(403); // external.com denied
    });
  });

  describe("Manual Authorization Checks", () => {
    it("should allow manual can() checks without throwing", async () => {
      policyProvider.addPolicy({
        id: "read-policy",
        scope: { type: "TENANT", id: "t1" },
        document: {
          Statement: [
            {
              Effect: "Allow",
              Action: ["document:read"],
              Resource: ["document/*"],
            },
          ],
        },
      });

      policyProvider.attachPolicy({
        policyId: "read-policy",
        scope: { type: "TENANT", id: "t1" },
        principal: { type: "USER", id: "u1" },
      });

      const app = express();
      app.use(
        autorixExpress({
          enforcer: createEnforcer(),
          getPrincipal: async () => ({ id: "u1" }),
          getTenant: async () => "t1",
        }),
      );

      app.get("/documents/:id", async (req, res) => {
        const canRead = await req.autorix!.can("document:read", { type: "document", id: req.params.id });
        const canWrite = await req.autorix!.can("document:write", { type: "document", id: req.params.id });

        res.json({
          id: req.params.id,
          canRead,
          canWrite,
        });
      });

      const r = await request(app).get("/documents/123");
      expect(r.status).toBe(200);
      expect(r.body.canRead).toBe(true);
      expect(r.body.canWrite).toBe(false);
    });
  });

  describe("Multiple Roles", () => {
    it("should combine permissions from multiple roles", async () => {
      // Editor can write
      policyProvider.addPolicy({
        id: "editor-policy",
        scope: { type: "TENANT", id: "t1" },
        document: {
          Statement: [
            {
              Effect: "Allow",
              Action: ["document:write"],
              Resource: ["document/*"],
            },
          ],
        },
      });

      policyProvider.attachPolicy({
        policyId: "editor-policy",
        scope: { type: "TENANT", id: "t1" },
        principal: { type: "ROLE", id: "editor" },
      });

      // Reviewer can approve
      policyProvider.addPolicy({
        id: "reviewer-policy",
        scope: { type: "TENANT", id: "t1" },
        document: {
          Statement: [
            {
              Effect: "Allow",
              Action: ["document:approve"],
              Resource: ["document/*"],
            },
          ],
        },
      });

      policyProvider.attachPolicy({
        policyId: "reviewer-policy",
        scope: { type: "TENANT", id: "t1" },
        principal: { type: "ROLE", id: "reviewer" },
      });

      const app = express();
      app.use(
        autorixExpress({
          enforcer: createEnforcer(),
          getPrincipal: async () => ({ id: "u1", roles: ["editor", "reviewer"] }),
          getTenant: async () => "t1",
        }),
      );

      app.post("/documents", authorize("document:write"), (_req, res) => res.json({ ok: true }));
      app.post("/documents/:id/approve", authorize("document:approve"), (_req, res) => res.json({ ok: true }));
      app.use(errorHandler);

      const r1 = await request(app).post("/documents");
      expect(r1.status).toBe(200); // Can write (from editor)

      const r2 = await request(app).post("/documents/123/approve");
      expect(r2.status).toBe(200); // Can approve (from reviewer)
    });
  });

  describe("Static Resources", () => {
    it("should work with string resource spec", async () => {
      policyProvider.addPolicy({
        id: "settings-policy",
        scope: { type: "TENANT", id: "t1" },
        document: {
          Statement: [
            {
              Effect: "Allow",
              Action: ["settings:read"],
              Resource: ["settings/*"],
            },
          ],
        },
      });

      policyProvider.attachPolicy({
        policyId: "settings-policy",
        scope: { type: "TENANT", id: "t1" },
        principal: { type: "USER", id: "u1" },
      });

      const app = express();
      app.use(
        autorixExpress({
          enforcer: createEnforcer(),
          getPrincipal: async () => ({ id: "u1" }),
          getTenant: async () => "t1",
        }),
      );

      app.get("/settings", authorize({ action: "settings:read", resource: "settings" }), (_req, res) =>
        res.json({ ok: true }),
      );
      app.use(errorHandler);

      const r = await request(app).get("/settings");
      expect(r.status).toBe(200);
    });

    it("should work with static object resource spec", async () => {
      policyProvider.addPolicy({
        id: "config-policy",
        scope: { type: "TENANT", id: "t1" },
        document: {
          Statement: [
            {
              Effect: "Allow",
              Action: ["config:update"],
              Resource: ["config/*"],
            },
          ],
        },
      });

      policyProvider.attachPolicy({
        policyId: "config-policy",
        scope: { type: "TENANT", id: "t1" },
        principal: { type: "USER", id: "u1" },
      });

      const app = express();
      app.use(
        autorixExpress({
          enforcer: createEnforcer(),
          getPrincipal: async () => ({ id: "u1" }),
          getTenant: async () => "t1",
        }),
      );

      app.put(
        "/config",
        authorize({ action: "config:update", resource: { type: "config", id: "main" } }),
        (_req, res) => res.json({ ok: true }),
      );
      app.use(errorHandler);

      const r = await request(app).put("/config");
      expect(r.status).toBe(200);
    });
  });
});
