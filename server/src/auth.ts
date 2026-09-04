import type { Request, Response, NextFunction } from "express";
import { auth } from "./firebase.js";

export interface AuthedRequest extends Request {
  uid?: string;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ error: "Missing bearer token." });
    return;
  }
  try {
    const decoded = await auth.verifyIdToken(token);
    (req as AuthedRequest).uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}
