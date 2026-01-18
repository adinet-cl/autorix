import type { Request } from "express";
import type { ResourceSpec } from "../types";

export async function resolveResource(spec: ResourceSpec, req: Request): Promise<unknown> {
  if (typeof spec === "string") return { type: spec };

  if ("loader" in spec) {
    const id = spec.idFrom(req);
    const data = await spec.loader(id, req);
    return { type: spec.type, id, data };
  }

  return spec;
}
