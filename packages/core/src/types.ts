export type Effect = 'Allow' | 'Deny';

export type StringMap<T = unknown> = Record<string, T>;

export type ConditionOperator = 'StringEquals' | 'StringLike' | 'NumericEquals' | 'Bool';

export type ConditionBlock = Partial<Record<ConditionOperator, Record<string, unknown>>>;

export interface Statement {
  /** Optional statement id for debugging/auditing */
  Sid?: string;
  Effect: Effect;
  Action: string | string[];
  Resource: string | string[];
  Condition?: ConditionBlock;
}

export interface PolicyDocument {
  Version?: string;
  Statement: Statement[];
}

export type ScopeType = 'GLOBAL' | 'TENANT' | 'LEGAL_ENTITY' | 'WORKSPACE' | 'APP' | string;

export interface AutorixContext {
  principal: {
    id: string;
    tenantId?: string;
    roles?: string[];
    groups?: string[];
    attributes?: StringMap;
    [key: string]: unknown;
  };
  resource?: {
    type?: string;
    id?: string;
    tenantId?: string;
    ownerId?: string;
    attributes?: StringMap;
    [key: string]: unknown;
  };
  request?: {
    method?: string;
    path?: string;
    ip?: string;
    headers?: Record<string, string | string[] | undefined>;
    [key: string]: unknown;
  };
  context?: {
    scope?: {
      type: ScopeType;
      id?: string;
    };
    now?: Date;
    [key: string]: unknown;
  };
}

export interface EvaluateInput {
  action: string;
  resource: string;
  policy: PolicyDocument;
  ctx: AutorixContext;
}

export type DecisionReason = 'EXPLICIT_DENY' | 'EXPLICIT_ALLOW' | 'DEFAULT_DENY';

export interface Decision {
  allowed: boolean;
  reason: DecisionReason;
  /** Sids (or generated indexes) of statements that matched (action+resource+condition) */
  matchedStatements: string[];
}
