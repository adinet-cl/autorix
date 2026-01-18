import type { Request } from "express";
import type { Principal } from "../types";

export type GetPrincipalFn = (req: Request) => Principal | Promise<Principal>;

export async function resolvePrincipal(req: Request, getPrincipal: GetPrincipalFn): Promise<Principal> {
  return await getPrincipal(req);
}
