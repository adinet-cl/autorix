import { SetMetadata } from "@nestjs/common";
import { AUTORIX_RESOURCE_KEY } from "./autorix.constants";
import type { AutorixResourceMeta } from "./autorix.interfaces";

export function Resource(meta: AutorixResourceMeta) {
  return SetMetadata(AUTORIX_RESOURCE_KEY, meta);
}
