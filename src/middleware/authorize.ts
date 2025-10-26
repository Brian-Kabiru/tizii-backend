// src/middleware/authorize.ts
import { Response, NextFunction, RequestHandler } from "express";
import { AuthenticatedRequest } from "./authMiddleware";

// Middleware to check roles
export const authorize =
  (...allowedRoles: Array<"artist" | "studio_manager" | "admin">): RequestHandler =>
  ((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: Access denied" });
    }

    next();
  }) as RequestHandler;
