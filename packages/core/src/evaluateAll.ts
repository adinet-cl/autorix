import type { AutorixContext, Decision, EvaluateInput, PolicyDocument } from "./types";
import { evaluate } from "./evaluate";

export type EvaluateAllInput = {
  action: string;
  resource: string;
  policies: Array<PolicyDocument | undefined | null>;
  ctx: AutorixContext;
};

export function evaluateAll(input: EvaluateAllInput): Decision {
  const { action, resource, policies, ctx } = input;

  let sawAllow = false;
  const matchedStatements: string[] = [];

  for (const policy of policies) {
    if (!policy) continue;

    const d = evaluate({ action, resource, policy, ctx });

    if (d.matchedStatements?.length) matchedStatements.push(...d.matchedStatements);

    if (d.reason === "EXPLICIT_DENY") {
      return { allowed: false, reason: "EXPLICIT_DENY", matchedStatements };
    }

    if (d.reason === "EXPLICIT_ALLOW") {
      sawAllow = true;
    }
  }

  if (sawAllow) {
    return { allowed: true, reason: "EXPLICIT_ALLOW", matchedStatements };
  }

  return { allowed: false, reason: "DEFAULT_DENY", matchedStatements };
}
