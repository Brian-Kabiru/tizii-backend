import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not defined");

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: "artist" | "studio_manager" | "admin";
    email?: string;
  };
}

// Wrap middleware in RequestHandler type
export const authMiddleware: RequestHandler = ((
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access token missing or invalid" });
    }

    const token = authHeader.split(" ")[1];

    // Cast decoded JWT
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & { id: string; role: string; email?: string };

    if (!decoded || !decoded.id || !decoded.role) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    // Validate role
    if (!["artist", "studio_manager", "admin"].includes(decoded.role)) {
      return res.status(403).json({ error: "Forbidden: Invalid role" });
    }

    req.user = {
      id: decoded.id,
      role: decoded.role as "artist" | "studio_manager" | "admin",
      email: decoded.email,
    };

    next();
  } catch (err) {
    console.error("Token verification error:", err);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}) as RequestHandler;
