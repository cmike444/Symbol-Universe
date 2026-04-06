import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const token = process.env["INTERNAL_API_TOKEN"];

export function requireInternalToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!token) {
    res.status(503).json({ error: "Service not configured (auth token missing)" });
    return;
  }

  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  const provided = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);

  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  next();
}
