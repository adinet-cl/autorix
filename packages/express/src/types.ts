import type { Request } from "express";

export type Principal = {
  id: string;
  roles?: string[];
  [k: string]: unknown;
} | null;

export type AutorixRequestContext = {
  principal: Principal;
  tenantId?: string | null;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  attributes?: Record<string, unknown>; // ABAC extra
  resource?: unknown; // si lo cargaste
};

export type ResourceSpec =
  | string
  | { type: string; id?: string; data?: unknown }
  | {
      type: string;
      idFrom: (req: Request) => string;
      loader: (id: string, req: Request) => Promise<unknown>;
    };

export type GetContextFn = (req: Request) => Partial<AutorixRequestContext> | Promise<Partial<AutorixRequestContext>>;

export type AutorixExpressOptions = {
  enforcer: {
    can: (input: { action: string; context: AutorixRequestContext; resource?: unknown }) => Promise<{ allowed: boolean; reason?: string }>;
  };
  getPrincipal: (req: Request) => Principal | Promise<Principal>;
  getTenant?: (req: Request) => string | null | Promise<string | null>;
  getContext?: GetContextFn;
  onDecision?: (d: { allowed: boolean; action: string; reason?: string }, req: Request) => void;
};
