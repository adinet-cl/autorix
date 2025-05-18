import {
  PolicyEngine,
  AutorixVariableRegistry,
  AutorixConditionEvaluator,
  InMemoryPolicyProvider,
  ConditionOperator,
  PolicyStatement,
} from "../src";
import { describe, beforeEach, it, expect } from "vitest";

describe("PolicyEngine - Advanced Scenarios", () => {
  let engine: PolicyEngine;
  let provider: InMemoryPolicyProvider;
  let variableRegistry: AutorixVariableRegistry;

  const context = {
    jwt: {
      sub: "user-123",
      tenantId: "tenant-abc",
      role: "viewer",
    },
    request: {
      ip: "192.168.1.100",
    },
  };

  beforeEach(() => {
    variableRegistry = new AutorixVariableRegistry({
      "jwt.sub": (ctx) => ctx.jwt?.sub,
      "jwt.tenantId": (ctx) => ctx.jwt?.tenantId,
      "jwt.role": (ctx) => ctx.jwt?.role,
      "request.ip": (ctx) => ctx.request?.ip,
    });

    engine = new PolicyEngine({
      variableRegistry,
      conditionEvaluator: new AutorixConditionEvaluator(),
    });

    provider = new InMemoryPolicyProvider();

    // Assign one allow and one deny for the same action/resource
    provider.setPoliciesFor("user-123", [
      {
        effect: "allow",
        action: ["user:update"],
        resource: "tenant/tenant-abc/user/*",
      },
      {
        effect: "deny",
        action: ["user:update"],
        resource: "tenant/tenant-abc/user/*",
        condition: {
          [ConditionOperator.STRING_EQUALS]: {
            "jwt.role": "viewer",
          },
        },
      },
    ]);
  });

  it("should deny access when both allow and deny match (deny wins)", async () => {
    const policies = await provider.getEffectivePolicies("user-123");

    const result = engine.canAccess(
      policies,
      "user:update",
      "tenant/tenant-abc/user/789",
      context
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("ExplicitDeny");
  });

  it("should deny access if group policy denies even when role policy allows", async () => {
    // Simular políticas para user, role y group
    provider.setPoliciesForRole("role-admin", [
      {
        effect: "allow",
        action: ["resource:delete"],
        resource: "tenant/tenant-abc/resource/*",
      },
    ]);
    provider.setPoliciesForGroup("group-limited", [
      {
        effect: "deny",
        action: ["resource:delete"],
        resource: "tenant/tenant-abc/resource/*",
        condition: {
          [ConditionOperator.STRING_EQUALS]: {
            "jwt.role": "viewer",
          },
        },
      },
    ]);

    // Asignar role y grupo al usuario
    provider.assignRoleToUser("user-123", "role-admin");
    provider.assignUserToGroup("user-123", "group-limited");

    const policies = await provider.getEffectivePolicies("user-123");

    const result = engine.canAccess(
      policies,
      "resource:delete",
      "tenant/tenant-abc/resource/42",
      {
        ...context,
        jwt: {
          ...context.jwt,
          role: "viewer", // aseguramos condición del deny
        },
      }
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("ExplicitDeny");
  });

  it("should allow access if at least one policy allows with passing condition and no deny applies", async () => {
    provider.setPoliciesFor("user-123", [
      {
        effect: "allow",
        action: ["user:update"],
        resource: "tenant/tenant-abc/user/*",
        condition: {
          [ConditionOperator.STRING_EQUALS]: {
            "jwt.role": "editor",
          },
        },
      },
    ]);

    provider.setPoliciesForRole("role-admin", [
      {
        effect: "allow",
        action: ["user:update"],
        resource: "tenant/tenant-abc/user/*",
        condition: {
          [ConditionOperator.STRING_EQUALS]: {
            "jwt.tenantId": "tenant-abc",
          },
        },
      },
    ]);

    provider.setPoliciesForGroup("group-limited", [
      {
        effect: "deny",
        action: ["user:update"],
        resource: "tenant/tenant-abc/user/*",
        condition: {
          [ConditionOperator.STRING_EQUALS]: {
            "jwt.role": "blocked",
          },
        },
      },
    ]);

    // El usuario cumple solo la condición del rol
    provider.assignRoleToUser("user-123", "role-admin");
    provider.assignUserToGroup("user-123", "group-limited");

    const result = engine.canAccess(
      await provider.getEffectivePolicies("user-123"),
      "user:update",
      "tenant/tenant-abc/user/1000",
      context
    );

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("ExplicitAllow");
  });

  it("should allow wildcard action policy if resource matches and condition passes", async () => {
    provider.setPoliciesFor("user-123", [
      {
        effect: "allow",
        action: ["*"],
        resource: "tenant/tenant-abc/project/*",
        condition: {
          [ConditionOperator.STRING_EQUALS]: {
            "jwt.role": "editor",
          },
        },
      },
    ]);

    const result = engine.canAccess(
      await provider.getEffectivePolicies("user-123"),
      "project:archive",
      "tenant/tenant-abc/project/999",
      {
        ...context,
        jwt: {
          ...context.jwt,
          role: "editor", // cumple la condición
        },
      }
    );

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("ExplicitAllow");
  });

  it("should deny wildcard action policy if condition does not pass", async () => {
    provider.setPoliciesFor("user-123", [
      {
        effect: "allow",
        action: ["*"],
        resource: "tenant/tenant-abc/project/*",
        condition: {
          [ConditionOperator.STRING_EQUALS]: {
            "jwt.role": "admin",
          },
        },
      },
    ]);

    const result = engine.canAccess(
      await provider.getEffectivePolicies("user-123"),
      "project:archive",
      "tenant/tenant-abc/project/999",
      {
        ...context,
        jwt: {
          ...context.jwt,
          role: "viewer", // no cumple la condición
        },
      }
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("DefaultDeny");
  });

  it("should allow access if array condition (includes all) passes", async () => {
    provider.setPoliciesFor("user-123", [
      {
        effect: "allow",
        action: ["report:download"],
        resource: "tenant/tenant-abc/reports/*",
        condition: {
          [ConditionOperator.ARRAY_CONTAINS]: {
            "jwt.tags": ["finance", "approved"],
          },
        },
      },
    ]);

    const result = engine.canAccess(
      await provider.getEffectivePolicies("user-123"),
      "report:download",
      "tenant/tenant-abc/reports/2024",
      {
        ...context,
        jwt: {
          ...context.jwt,
          tags: ["approved", "finance", "public"],
        },
      }
    );

    expect(result.allowed).toBe(true);
  });

  it("should deny access if isNull condition matches true", async () => {
    provider.setPoliciesFor("user-123", [
      {
        effect: "deny",
        action: ["document:read"],
        resource: "tenant/tenant-abc/documents/*",
        condition: {
          [ConditionOperator.IS_NULL]: {
            "jwt.department": true,
          },
        },
      },
    ]);

    const result = engine.canAccess(
      await provider.getEffectivePolicies("user-123"),
      "document:read",
      "tenant/tenant-abc/documents/001",
      {
        ...context,
        jwt: {
          ...context.jwt,
          department: null,
        },
      }
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("ExplicitDeny");
  });

  it("should allow access if Bool condition is true", async () => {
    provider.setPoliciesFor("user-123", [
      {
        effect: "allow",
        action: ["auth:mfa-required"],
        resource: "*",
        condition: {
          [ConditionOperator.BOOL]: {
            "jwt.mfa": true,
          },
        },
      },
    ]);

    const result = engine.canAccess(
      await provider.getEffectivePolicies("user-123"),
      "auth:mfa-required",
      "*",
      {
        ...context,
        jwt: {
          ...context.jwt,
          mfa: true,
        },
      }
    );

    expect(result.allowed).toBe(true);
  });

  it("should allow access if IpMatch passes", async () => {
    provider.setPoliciesFor("user-123", [
      {
        effect: "allow",
        action: ["admin:dashboard"],
        resource: "*",
        condition: {
          [ConditionOperator.IP_MATCH]: {
            "request.ip": "192.168.1.100",
          },
        },
      },
    ]);

    const result = engine.canAccess(
      await provider.getEffectivePolicies("user-123"),
      "admin:dashboard",
      "*",
      context
    );

    expect(result.allowed).toBe(true);
  });

  it("should allow access if date condition (greater than or equal) passes", async () => {
    provider.setPoliciesFor("user-123", [
      {
        effect: "allow",
        action: ["billing:generate"],
        resource: "tenant/tenant-abc/billing/*",
        condition: {
          [ConditionOperator.DATE_GREATER_THAN_EQUALS]: {
            "jwt.billingDate": "2024-01-01",
          },
        },
      },
    ]);

    const result = engine.canAccess(
      await provider.getEffectivePolicies("user-123"),
      "billing:generate",
      "tenant/tenant-abc/billing/1234",
      {
        ...context,
        jwt: {
          ...context.jwt,
          billingDate: "2024-05-01",
        },
      }
    );

    expect(result.allowed).toBe(true);
  });

  it("should allow access if string matches regex pattern", async () => {
    provider.setPoliciesFor("user-123", [
      {
        effect: "allow",
        action: ["support:access"],
        resource: "*",
        condition: {
          [ConditionOperator.STRING_REGEX]: {
            "jwt.email": "^.+@adinet\\.cl$",
          },
        },
      },
    ]);

    const result = engine.canAccess(
      await provider.getEffectivePolicies("user-123"),
      "support:access",
      "*",
      {
        ...context,
        jwt: {
          ...context.jwt,
          email: "soporte@adinet.cl",
        },
      }
    );

    expect(result.allowed).toBe(true);
  });
});
