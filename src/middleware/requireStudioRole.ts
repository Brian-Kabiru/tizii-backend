import { RequestHandler } from "express";
import prisma from "../prisma/client";
import { AuthenticatedRequest } from "../types/auth";

/**
 * requireStudioRole('studioIdParam', ['studio_owner','studio_manager'])
 * Checks that the current user has one of allowed roles on the studio (studio_members table),
 * OR that they are the owner of the studio (owner_id).
 */
export const requireStudioRole = (studioIdParam: string, allowedRoles: string[]): RequestHandler => {
  return async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user) return res.status(401).json({ message: "Unauthorized" });

      const studioId = String(req.params[studioIdParam] ?? req.body[studioIdParam] ?? "");
      if (!studioId) return res.status(400).json({ message: "Missing studio id" });

      // If user is platform admin, allow
      if (authReq.user.role === "admin") return next();

      // Check ownership
      const studio = await prisma.studios.findUnique({ where: { id: studioId } });
      if (!studio) return res.status(404).json({ message: "Studio not found" });

      if (studio.owner_id === authReq.user.id) return next();

      // Check membership roles
      const membership = await prisma.studio_members.findFirst({
        where: { studio_id: studioId, user_id: authReq.user.id, role: { in: allowedRoles } },
      });

      if (!membership) return res.status(403).json({ message: "Forbidden: insufficient studio role" });

      next();
    } catch (err) {
      console.error("requireStudioRole error", err);
      return res.status(500).json({ message: "Server error" });
    }
  };
};
