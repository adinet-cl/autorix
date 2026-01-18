import express from "express";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { autorixExpress } from "../src/middleware/autorixExpress";
import { authorize } from "../src/middleware/authorize";
import { AutorixHttpError } from "../src/errors/AutorixHttpErrors";

function errorHandler(err: any, _req: any, res: any, _next: any) {
  if (err instanceof AutorixHttpError) {
    return res.status(err.statusCode).json({ code: err.code, message: err.message });
  }
  const status = err?.status ?? 500;
  return res.status(status).json({ message: err?.message ?? "Internal Error" });
}

describe("authorize middleware", () => {
  it("should return 401 when requireAuth and principal is null", async () => {
    const enforcer = { can: vi.fn(async () => ({ allowed: true })) };

    const app = express();
    app.use(
      autorixExpress({
        enforcer,
        getPrincipal: async () => null,
      }),
    );

    app.get("/secure", authorize("x:y:z", { requireAuth: true }), (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const r = await request(app).get("/secure");
    expect(r.status).toBe(401);
    expect(r.body.code).toBe("AUTORIX_UNAUTHENTICATED");
  });

  it("should call resource loader and deny with 403 when enforcer denies", async () => {
    const enforcer = { can: vi.fn(async () => ({ allowed: false, reason: "nope" })) };

    const loader = vi.fn(async (id: string) => ({ id, ownerId: "u2" }));

    const app = express();
    app.use(
      autorixExpress({
        enforcer,
        getPrincipal: async () => ({ id: "u1" }),
      }),
    );

    app.get(
      "/invoices/:id",
      authorize("erp:invoice:read", {
        requireAuth: true,
        resource: {
          type: "invoice",
          idFrom: (req) => req.params.id,
          loader: async (id, req) => loader(id, req),
        },
      }),
      (_req, res) => res.json({ ok: true }),
    );

    app.use(errorHandler);

    const r = await request(app).get("/invoices/abc");
    expect(loader).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledWith("abc", expect.anything());
    expect(enforcer.can).toHaveBeenCalledTimes(1);
    expect(r.status).toBe(403);
    expect(r.body.code).toBe("AUTORIX_FORBIDDEN");
  });
});
