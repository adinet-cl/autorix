// src/errors/AutorixHttpErrors.ts
export type AutorixErrorCode =
  | "AUTORIX_FORBIDDEN"
  | "AUTORIX_UNAUTHENTICATED"
  | "AUTORIX_MISSING_MIDDLEWARE"
  | "AUTORIX_INTERNAL";

export class AutorixHttpError extends Error {
  public readonly statusCode: number;
  public readonly code: AutorixErrorCode;
  public readonly details?: unknown;

  constructor(params: {
    message: string;
    statusCode: number;
    code: AutorixErrorCode;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "AutorixHttpError";
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.details = params.details;
  }
}

export class AutorixForbiddenError extends AutorixHttpError {
  constructor(reason?: string, details?: unknown) {
    super({
      message: reason ?? "Forbidden",
      statusCode: 403,
      code: "AUTORIX_FORBIDDEN",
      details,
    });
    this.name = "AutorixForbiddenError";
  }
}

export class AutorixUnauthenticatedError extends AutorixHttpError {
  constructor(details?: unknown) {
    super({
      message: "Unauthenticated",
      statusCode: 401,
      code: "AUTORIX_UNAUTHENTICATED",
      details,
    });
    this.name = "AutorixUnauthenticatedError";
  }
}

export class AutorixMissingMiddlewareError extends AutorixHttpError {
  constructor(details?: unknown) {
    super({
      message: "Autorix middleware not registered",
      statusCode: 500,
      code: "AUTORIX_MISSING_MIDDLEWARE",
      details,
    });
    this.name = "AutorixMissingMiddlewareError";
  }
}
