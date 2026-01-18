import type { NextFunction, Request, Response } from "express";
import { AutorixHttpError } from "../errors/AutorixHttpErrors";

export type AutorixErrorHandlerOptions = {
  exposeStack?: boolean; // default false
  format?: "json" | "problem+json"; // default json
};

export function autorixErrorHandler(options: AutorixErrorHandlerOptions = {}) {
  const exposeStack = options.exposeStack ?? false;
  const format = options.format ?? "json";

  return (err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);

    // Autorix typed errors
    if (err instanceof AutorixHttpError) {
      if (format === "problem+json") {
        return res.status(err.statusCode).type("application/problem+json").json({
          type: `https://autorix.dev/errors/${err.code}`,
          title: err.code,
          status: err.statusCode,
          detail: err.message,
        });
      }

      return res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    // fallback
    const status = err?.statusCode ?? err?.status ?? 500;

    return res.status(status).json({
      error: {
        code: "INTERNAL_ERROR",
        message: status === 500 ? "Internal Error" : (err?.message ?? "Error"),
        ...(exposeStack ? { stack: String(err?.stack ?? "") } : {}),
      },
    });
  };
}
