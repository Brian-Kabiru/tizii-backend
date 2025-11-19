import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { AuthenticatedRequest, PlatformRole } from "../types/auth";

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res.status(401).json({ message: "Unauthorized" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload & { id: string; role: string; email?: string };

    // Type-safe assignment
    (req as AuthenticatedRequest).user = {
      id: decoded.id,
      role: decoded.role as PlatformRole, // cast string -> PlatformRole
      email: decoded.email ?? undefined,
    };

    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
