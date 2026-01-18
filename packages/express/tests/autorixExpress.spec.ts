import express from "express";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { autorixExpress } from "../src/middleware/autorixExpress";

describe("autorixExpress middleware", () => {
  it("should attach req.autorix with context and can/enforce functions", async () => {
    const enforcer = {
      can: vi.fn(async () => ({ allowed: true })),
    };

    const app = express();
    app.use(
      autorixExpress({
        enforcer,
        getPrincipal: async () => ({ id: "u1", roles: ["admin"] }),
        getTenant: async () => "t1",
        getContext: async () => ({ attributes: { foo: "bar" } }),
      }),
    );

    app.get("/ok", async (req, res) => {
      const allowed = await req.autorix!.can("test:read", { type: "x" });
      res.json({
        hasAutorix: Boolean(req.autorix),
        tenantId: req.autorix?.context.tenantId,
        principalId: (req.autorix?.context.principal as any)?.id,
        allowed,
      });
    });

    const r = await request(app).get("/ok");
    expect(r.status).toBe(200);
    expect(r.body.hasAutorix).toBe(true);
    expect(r.body.tenantId).toBe("t1");
    expect(r.body.principalId).toBe("u1");
    expect(r.body.allowed).toBe(true);
    expect(enforcer.can).toHaveBeenCalledTimes(1);
  });
});
