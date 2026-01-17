import { SetMetadata } from "@nestjs/common";
import { AUTORIX_RESOURCE_KEY } from "./autorix.constants";
import { AutorixResourceMeta } from "./autorix.interfaces";

export function ResourceParam(type: string, param = "id") {
  return SetMetadata(AUTORIX_RESOURCE_KEY, {
    mode: "param",
    type,
    param,
  } satisfies AutorixResourceMeta);
}

