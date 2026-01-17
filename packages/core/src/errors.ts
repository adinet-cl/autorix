import type { Decision } from "./types";

export class AutorixForbiddenError extends Error {
  public readonly decision: Decision;

  constructor(message: string, decision: Decision) {
    super(message);
    this.name = "AutorixForbiddenError";
    this.decision = decision;
  }
}
