import { SetMetadata } from "@nestjs/common";
import { AUTORIX_ACTIONS_KEY } from "./autorix.constants";

export function Policy(...actions: string[]) {
  return SetMetadata(AUTORIX_ACTIONS_KEY, actions);
}
