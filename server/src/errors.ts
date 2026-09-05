import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";

interface BodyError extends Error {
  type?: string;
  status?: number;
}

/** Express 4 does not catch a rejected promise, so an async route must hand it on. */
export const route =
  (handler: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    handler(req, res).catch(next);
  };

/** Every failure leaves as JSON, and never carries the underlying cause. */
export const errorHandler: ErrorRequestHandler = (
  err: BodyError,
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (res.headersSent) return next(err);

  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "Request body is too large." });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Request body is not valid JSON." });
    return;
  }

  console.error("airlock: unhandled request failure", err);
  res.status(500).json({ error: "AIRLOCK hit an internal error. Please try again." });
};
