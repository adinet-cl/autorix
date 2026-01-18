import type { Request } from "express";
import type { AutorixExpressOptions, AutorixRequestContext } from "../types";
import { resolvePrincipal } from "./principal";

export async function buildRequestContext(req: Request, opts: AutorixExpressOptions): Promise<AutorixRequestContext> {
  const principal = await resolvePrincipal(req, opts.getPrincipal);
  const tenantId = opts.getTenant ? await opts.getTenant(req) : null;
  const extra = opts.getContext ? await opts.getContext(req) : {};

  const context: AutorixRequestContext = {
    principal,
    tenantId: tenantId ?? undefined,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    requestId: req.headers["x-request-id"] as string | undefined,
    attributes: (extra as any)?.attributes,
    resource: undefined,
    ...extra,
  };

  return context;
}
