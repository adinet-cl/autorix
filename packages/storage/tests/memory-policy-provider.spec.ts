import { describe, it, expect } from "vitest";
import { MemoryPolicyProvider } from "../src/memory/memory-policy-provider";
import type { PolicyDocument } from "@autorix/core";

describe("MemoryPolicyProvider", () => {
  it("returns policies attached to USER within TENANT scope", async () => {
    const provider = new MemoryPolicyProvider();

    const tenantScope = { type: "TENANT" as const, id: "tenant-a" };
    const policy: PolicyDocument = {
      Version: "2025-01-01",
      Statement: [
        { Effect: "Allow", Action: "erp:sale:view", Resource: "sale/*" },
      ],
    };

    provider.addPolicy({ id: "p1", scope: tenantScope, document: policy });
    provider.attachPolicy({
      policyId: "p1",
      scope: tenantScope,
      principal: { type: "USER", id: "user-1" },
    });

    const res = await provider.getPolicies({
      scope: tenantScope,
      principal: { type: "USER", id: "user-1" },
    });

    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("p1");
  });

  it("does NOT leak policies across tenants", async () => {
    const provider = new MemoryPolicyProvider();

    const scopeA = { type: "TENANT" as const, id: "tenant-a" };
    const scopeB = { type: "TENANT" as const, id: "tenant-b" };

    const policyA: PolicyDocument = {
      Version: "2025-01-01",
      Statement: [{ Effect: "Allow", Action: "a:*", Resource: "*" }],
    };

    provider.addPolicy({ id: "pA", scope: scopeA, document: policyA });
    provider.attachPolicy({
      policyId: "pA",
      scope: scopeA,
      principal: { type: "USER", id: "user-1" },
    });

    const resB = await provider.getPolicies({
      scope: scopeB,
      principal: { type: "USER", id: "user-1" },
    });

    expect(resB).toHaveLength(0);
  });

  it("returns policies attached via ROLE and GROUP", async () => {
    const provider = new MemoryPolicyProvider();
    const scope = { type: "TENANT" as const, id: "tenant-a" };

    const policyRole: PolicyDocument = {
      Version: "2025-01-01",
      Statement: [{ Effect: "Allow", Action: "erp:sale:create", Resource: "*" }],
    };
    const policyGroup: PolicyDocument = {
      Version: "2025-01-01",
      Statement: [{ Effect: "Allow", Action: "erp:sale:view", Resource: "*" }],
    };

    provider.addPolicy({ id: "pR", scope, document: policyRole });
    provider.addPolicy({ id: "pG", scope, document: policyGroup });

    provider.attachPolicy({
      policyId: "pR",
      scope,
      principal: { type: "ROLE", id: "role-vendedor" },
    });

    provider.attachPolicy({
      policyId: "pG",
      scope,
      principal: { type: "GROUP", id: "group-ventas" },
    });

    const res = await provider.getPolicies({
      scope,
      principal: { type: "USER", id: "user-1" },
      roleIds: ["role-vendedor"],
      groupIds: ["group-ventas"],
    });

    expect(res.map((x) => x.id).sort()).toEqual(["pG", "pR"]);
  });
});
