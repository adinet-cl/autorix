import type { Decision } from "./types";

export class AutorixForbiddenError extends Error {
  public readonly decision: Decision;

  constructor(message: string, decision: Decision) {
    super(message);
    this.name = "AutorixForbiddenError";
    this.decision = decision;
  }
}

export class AutorixPolicyValidationError extends Error {
  public readonly errors: string[];

  constructor(message: string, errors: string[]) {
    super(message);
    this.name = "AutorixPolicyValidationError";
    this.errors = errors;
  }
}

