import type { Decision } from "./types";
import { AutorixForbiddenError } from "./errors";

export function assertAllowed(decision: Decision, message = "Forbidden by policy") {
  if (!decision.allowed) {
    throw new AutorixForbiddenError(`${message} (${decision.reason})`, decision);
  }
}
