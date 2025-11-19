import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest, PlatformRole } from "../types/auth";

export const authorize = (roles: PlatformRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) return res.status(401).json({ message: "Unauthorized" });

    if (!roles.includes(authReq.user.role))
      return res.status(403).json({ message: "Forbidden" });

    next();
  };
};
