import type { Request } from "express";
import type { ResourceSpec } from "../types";

export async function resolveResource(spec: ResourceSpec, req: Request): Promise<unknown> {
  if (typeof spec === "string") return { type: spec };

  if ("loader" in spec && typeof spec.loader === "function" && typeof spec.idFrom === "function") {
    const id = spec.idFrom(req);
    const data = await spec.loader(id, req);
    
    // Flatten the data into the resource object
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return { type: spec.type, id, ...data };
    }
    
    return { type: spec.type, id, data };
  }

  return spec;
}
