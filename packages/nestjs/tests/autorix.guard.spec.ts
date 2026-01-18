import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { Reflector } from "@nestjs/core";
import { AutorixGuard } from "../src/autorix.guard";
import { Policy } from "../src/autorix.policy.decorator";
import { MemoryPolicyProvider } from "@autorix/storage";
import type { PolicyDocument } from "@autorix/core";

function makeExecutionContext(req: any) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => handler,
    getClass: () => ({}),
  } as any;
}

class Controller {
  @Policy("erp:sale:view")
  handler() {}
}
const handler = Controller.prototype.handler;

describe("AutorixGuard", () => {
  it("allows when policy allows", async () => {
    const provider = new MemoryPolicyProvider();
    const scope = { type: "TENANT" as const, id: "t1" };

    const policy: PolicyDocument = {
      Version: "2025-01-01",
      Statement: [{ Effect: "Allow", Action: "erp:sale:view", Resource: "*" }],
    };

    provider.addPolicy({ id: "p1", scope, document: policy });
    provider.attachPolicy({
      policyId: "p1",
      scope,
      principal: { type: "USER", id: "u1" },
    });

    const reflector = new Reflector();
    const guard = new AutorixGuard(reflector as any, provider as any, {});

    const ctx = makeExecutionContext({
      method: "GET",
      url: "/sales",
      tenantId: "t1",
      user: { id: "u1", tenantId: "t1" },
    });

    const ok = await guard.canActivate(ctx);
    expect(ok).toBe(true);
  });
});
