import { describe, it, expect, beforeEach } from "vitest";
import {
  PolicyEngine,
  AutorixVariableRegistry as VariableRegistry,
  ConditionEvaluator,
  InMemoryPolicyProvider,
} from "../src/";
import { PolicyStatement, PolicyEvaluationContext } from "../src/core/types";
import { ConditionOperator } from "../src/core/enums";

describe("PolicyEngine", () => {
  let variableRegistry: VariableRegistry;
  let evaluator: PolicyEngine;
  let conditionEvaluator: ConditionEvaluator;

  beforeEach(() => {
    // Registrar todas las variables necesarias para interpolación en recursos y condiciones
    variableRegistry = new VariableRegistry({
      "context.userId": (ctx) => ctx.context?.userId,
      "context.tenantId": (ctx) => ctx.context?.tenantId,
      "context.mfaAuthenticated": (ctx) => ctx.context?.mfaAuthenticated,
      "context.resourceOwnerId": (ctx) => ctx.context?.resourceOwnerId,
      "context.department": (ctx) => ctx.context?.department,
      "request.ip": (ctx) => ctx.request?.ip,
    });
    conditionEvaluator = new ConditionEvaluator(); // Usar el evaluador de condiciones real
    evaluator = new PolicyEngine({
      variableRegistry,
      conditionEvaluator,
    });
  });

  const createPolicy = (
    effect: "allow" | "deny",
    action: string[],
    resource: string,
    condition?: any // Usamos 'any' aquí para flexibilidad en las pruebas
  ): PolicyStatement => ({
    effect,
    action,
    resource,
    condition: condition as PolicyStatement["condition"], // Hacemos cast al tipo esperado
  });

  const baseContext: PolicyEvaluationContext = {
    context: {
      userId: "user-123",
      tenantId: "tenant-456",
      mfaAuthenticated: true,
      resourceOwnerId: "user-123",
      department: "engineering",
    },
    request: {
      ip: "192.168.1.10",
    },
  };

  it("should allow access when a matching allow policy exists and no deny policy conflicts", () => {
    // ¿Cómo es tu allowPolicy aquí?
    const allowPolicy = createPolicy(
      "allow",
      ["user:read"],
      `user/${baseContext.context.userId}`,
      {
        [ConditionOperator.STRING_EQUALS]: {
          "context.userId": "${context.userId}",
        },
      }
    );
    // ¿Qué contexto se usa? ¿Es baseContext?
    const result = evaluator.canAccess(
      [allowPolicy],
      "user:read",
      `user/${baseContext.context.userId}`,
      baseContext
    );
    expect(result.allowed).toBe(true);
  });

  it("should deny access when a matching deny policy exists, even if an allow policy also matches", () => {
    const allowPolicy = createPolicy("allow", ["user:read"], "user/user-123");
    const denyPolicy = createPolicy("deny", ["user:read"], "user/user-123"); // Denegación incondicional
    const result = evaluator.canAccess(
      [allowPolicy, denyPolicy],
      "user:read",
      "user/user-123",
      baseContext
    );
    expect(result.allowed).toBe(false);
  });

  it("should deny access if an applicable deny policy's conditions are met", () => {
    const denyPolicy = createPolicy("deny", ["user:read"], "user/user-123", {
      [ConditionOperator.BOOL]: { "context.mfaAuthenticated": false }, // Denegar si MFA es falso
    });
    const contextWithoutMFA = {
      ...baseContext,
      context: {
        ...baseContext.context,
        mfaAuthenticated: false,
      },
    };
    const result = evaluator.canAccess(
      [denyPolicy],
      "user:read",
      "user/user-123",
      contextWithoutMFA
    );
    expect(result.allowed).toBe(false);
  });

  it("should NOT deny access if an applicable deny policy's conditions are NOT met, and an allow policy permits", () => {
    const allowPolicy = createPolicy("allow", ["user:read"], "user/user-123");
    const denyPolicy = createPolicy("deny", ["user:read"], "user/user-123", {
      [ConditionOperator.BOOL]: { "context.mfaAuthenticated": false }, // Denegar si MFA es falso
    });
    // Contexto con MFA verdadero, por lo que la condición de denegación NO se cumple
    const result = evaluator.canAccess(
      [allowPolicy, denyPolicy],
      "user:read",
      "user/user-123",
      baseContext
    );
    expect(result.allowed).toBe(true); // El allow debe prevalecer porque el deny no aplicó
  });

  it("should deny access by default if no policies match (no allow)", () => {
    const nonMatchingPolicy = createPolicy(
      "allow",
      ["product:view"],
      "product/prod-789"
    );
    const result = evaluator.canAccess(
      [nonMatchingPolicy],
      "user:read",
      "user/user-123",
      baseContext
    );
    expect(result.allowed).toBe(false);
  });

  it("should deny access if only a non-matching deny policy exists", () => {
    const denyNonMatchingAction = createPolicy(
      "deny",
      ["admin:configure"],
      "system/config"
    );
    const result = evaluator.canAccess(
      [denyNonMatchingAction],
      "user:read",
      "user/user-123",
      baseContext
    );
    expect(result.allowed).toBe(false); // Denegado por defecto, no porque el deny aplicara
  });

  it("should allow access if action matches with wildcard '*'", () => {
    const policy = createPolicy("allow", ["*"], "user/user-123");
    const result = evaluator.canAccess(
      [policy],
      "user:anyAction",
      "user/user-123",
      baseContext
    );
    expect(result.allowed).toBe(true);
  });

  it("should allow access if action matches with trailing wildcard 'service:*'", () => {
    const policy = createPolicy("allow", ["document:*"], "docs/doc-abc");
    const result = evaluator.canAccess(
      [policy],
      "document:read",
      "docs/doc-abc",
      baseContext
    );
    expect(result.allowed).toBe(true);
  });

  it("should NOT allow access if action does not match with trailing wildcard 'service:*'", () => {
    const policy = createPolicy("allow", ["document:*"], "docs/doc-abc");
    const result = evaluator.canAccess(
      [policy],
      "image:read",
      "docs/doc-abc",
      baseContext
    );
    expect(result.allowed).toBe(false);
  });

  it("should allow access if resource matches with wildcard '*'", () => {
    const policy = createPolicy("allow", ["user:read"], "*");
    const result = evaluator.canAccess(
      [policy],
      "user:read",
      "any/resource/path",
      baseContext
    );
    expect(result.allowed).toBe(true);
  });

  it("should allow access if resource matches with trailing wildcard 'path/*'", () => {
    const policy = createPolicy(
      "allow",
      ["user:read"],
      "department/engineering/*"
    );
    const result = evaluator.canAccess(
      [policy],
      "user:read",
      "department/engineering/project-x",
      baseContext
    );
    expect(result.allowed).toBe(true);
  });

  it("should NOT allow access if resource does not match with trailing wildcard 'path/*'", () => {
    const policy = createPolicy(
      "allow",
      ["user:read"],
      "department/engineering/*"
    );
    const result = evaluator.canAccess(
      [policy],
      "user:read",
      "department/sales/report-y",
      baseContext
    );
    expect(result.allowed).toBe(false);
  });

  it("should correctly evaluate StringEquals condition from variable", () => {
    // Se asegura que tanto el recurso como la condición usan variables interpoladas desde el contexto
    const policy = createPolicy(
      "allow",
      ["user:profile"],
      `user/${baseContext.context.userId}`, // Debe coincidir con el recurso interpolado
      {
        [ConditionOperator.STRING_EQUALS]: {
          "context.resourceOwnerId": "${context.userId}",
        },
      }
    );
    const userOwnsResourceContext = {
      ...baseContext,
      context: {
        ...baseContext.context,
        resourceOwnerId: baseContext.context.userId,
      },
    };
    const result = evaluator.canAccess(
      [policy],
      "user:profile",
      `user/${baseContext.context.userId}`,
      userOwnsResourceContext
    );
    expect(result.allowed).toBe(true);
  });

  it("should deny if StringEquals condition from variable does not match", () => {
    // Se asegura que tanto el recurso como la condición usan variables interpoladas desde el contexto
    const policy = createPolicy(
      "allow",
      ["user:profile"],
      `user/${baseContext.userId}`, // Debe coincidir con el recurso interpolado
      {
        [ConditionOperator.STRING_EQUALS]: {
          "context.resourceOwnerId": "${context.userId}",
        },
      }
    );
    const userDoesNotOwnResourceContext = {
      ...baseContext,
      context: {
        ...baseContext.context,
        userId: "user-999", // Aseguramos que no coincida con resourceOwnerId
        resourceOwnerId: "another-user-id",
      },
    };
    const result = evaluator.canAccess(
      [policy],
      "user:profile",
      `user/${baseContext.userId}`,
      userDoesNotOwnResourceContext
    );
    expect(result.allowed).toBe(false);
  });

  it("should deny access when mfaAuthenticated condition is false in an allow policy", () => {
    const policy = createPolicy("allow", ["user:sensitive"], "*", {
      [ConditionOperator.BOOL]: { "context.mfaAuthenticated": true },
    });
    const contextWithoutMFA = {
      ...baseContext,
      context: {
        ...baseContext.context,
        mfaAuthenticated: false,
      },
    };
    const result = evaluator.canAccess(
      [policy],
      "user:sensitive",
      "any-resource",
      contextWithoutMFA
    );
    expect(result.allowed).toBe(false);
  });

  it("should correctly use IpMatch condition", () => {
    const policy = createPolicy("allow", ["system:login"], "console", {
      [ConditionOperator.IP_MATCH]: { "request.ip": "192.168.1.0/24" },
    });
    const result = evaluator.canAccess(
      [policy],
      "system:login",
      "console",
      baseContext
    ); // baseContext.ipAddress is 192.168.1.10
    expect(result.allowed).toBe(true);
  });

  it("should deny if IpMatch condition fails", () => {
    const policy = createPolicy("allow", ["system:login"], "console", {
      [ConditionOperator.IP_MATCH]: { "request.ip": "10.0.0.0/8" },
    });
    const result = evaluator.canAccess(
      [policy],
      "system:login",
      "console",
      baseContext
    );
    expect(result.allowed).toBe(false);
  });

  it("should allow access if action matches with leading wildcard '*.view'", () => {
    const policy = createPolicy("allow", ["*.view"], "entity/123");
    const result = evaluator.canAccess(
      [policy],
      "profile.view",
      "entity/123",
      baseContext
    );
    expect(result.allowed).toBe(true);
  });

  it("should allow access if resource matches with leading wildcard '*.tmp'", () => {
    const policy = createPolicy("allow", ["file:edit"], "*.tmp");
    const result = evaluator.canAccess(
      [policy],
      "file:edit",
      "document.tmp",
      baseContext
    );
    expect(result.allowed).toBe(true);
  });
});

describe("getEffectivePolicies (user + roles + groups)", () => {
  it("should evaluate access from combined direct, role, and group policies", async () => {
    const provider = new InMemoryPolicyProvider();

    provider.setPoliciesFor("user-1", [
      {
        effect: "allow",
        action: ["invoice:view"],
        resource: "billing/*",
      },
    ]);

    provider.setPoliciesForRole("admin-role", [
      {
        effect: "allow",
        action: ["user:*"],
        resource: "user/*",
      },
    ]);

    provider.setPoliciesForGroup("team-sales", [
      {
        effect: "allow",
        action: ["sales:report"],
        resource: "sales/*",
      },
    ]);

    provider.assignRoleToUser("user-1", "admin-role");
    provider.assignUserToGroup("user-1", "team-sales");

    const policies = await provider.getEffectivePolicies("user-1");

    const engine = new PolicyEngine({
      variableRegistry: new VariableRegistry(),
      conditionEvaluator: new ConditionEvaluator(),
    });

    const ctx = { userId: "user-1" };

    const result1 = engine.canAccess(
      policies,
      "invoice:view",
      "billing/2024",
      ctx
    );
    const result2 = engine.canAccess(policies, "user:delete", "user/xyz", ctx);
    const result3 = engine.canAccess(policies, "sales:report", "sales/q1", ctx);

    expect(result1.allowed).toBe(true); // Direct policy
    expect(result2.allowed).toBe(true); // Role policy
    expect(result3.allowed).toBe(true); // Group policy
  });
});
