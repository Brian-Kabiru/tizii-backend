// src/controllers/authController.ts
import { Request, Response } from "express";
import prisma from "../prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  AuthenticatedRequest,
  SignupInput,
  LoginInput,
  ResetPasswordInput,
  CreateUserInput,
  PlatformRole,
} from "../types/auth";

/**
 * IMPORTANT: ensure process.env.JWT_SECRET is set in your runtime env.
 */
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Fail fast in dev so you don't forget to set the secret.
  throw new Error("JWT_SECRET must be set in environment variables");
}

const JWT_EXPIRES_IN = "1h";
const RESET_PASSWORD_EXPIRES_IN = "15m";

const generateToken = (id: string, role: PlatformRole, email?: string) =>
  jwt.sign({ id, role, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const generateResetToken = (id: string) =>
  jwt.sign({ id }, JWT_SECRET, { expiresIn: RESET_PASSWORD_EXPIRES_IN });

/** Helper: sanitize user object before returning to client */
const sanitizeUser = (u: any) => ({
  id: u.id,
  full_name: u.full_name,
  email: u.email ?? undefined,
  phone: u.phone ?? undefined,
  role: u.platform_role as PlatformRole,
  profile_img: u.profile_img ?? undefined,
  verified: u.verified ?? false,
});

/* -----------------
   Signup (artist - public)
   ----------------- */
export const signupArtist = async (req: Request, res: Response) => {
  const input: SignupInput = req.body;

  try {
    if (!input || !input.email || !input.password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const existing = await prisma.users.findUnique({ where: { email: input.email } });
    if (existing) return res.status(400).json({ message: "Email already exists" });

    const hashed = await bcrypt.hash(input.password, 10);
    const newUser = await prisma.users.create({
      data: {
        full_name: input.full_name ?? undefined,
        email: input.email,
        phone: input.phone ?? undefined,
        password_hash: hashed,
        platform_role: "artist",
      },
    });

    const token = generateToken(newUser.id, newUser.platform_role as PlatformRole, newUser.email ?? undefined);

    return res.status(201).json({
      user: sanitizeUser(newUser),
      token,
    });
  } catch (err) {
    console.error("signupArtist error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* -----------------
   Login
   ----------------- */
export const login = async (req: Request, res: Response) => {
  const input: LoginInput = req.body;
  try {
    if (!input || !input.email || !input.password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const user = await prisma.users.findUnique({ where: { email: input.email } });
    if (!user || !user.password_hash) return res.status(400).json({ message: "Invalid credentials" });

    const valid = await bcrypt.compare(input.password, user.password_hash);
    if (!valid) return res.status(400).json({ message: "Invalid credentials" });

    const token = generateToken(user.id, user.platform_role as PlatformRole, user.email ?? undefined);

    return res.json({
      user: sanitizeUser(user),
      token,
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* -----------------
   Admin: create studio owner (admin-only)
   Accepts CreateUserInput (password optional). If password absent, creates account with a random temporary password
   ----------------- */
const randomTempPassword = () => {
  // simple random password; consider emailing or forcing reset on first login
  return `TempPass!${Math.random().toString(36).slice(2, 10)}`;
};

export const createStudioOwner = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.user) return res.status(401).json({ message: "Unauthorized" });

    // Simple RBAC: only admins can create owners (adjust as needed)
    if (authReq.user.role !== ("admin" as PlatformRole)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const input: CreateUserInput = req.body;
    if (!input || !input.email || !input.full_name) {
      return res.status(400).json({ message: "email and full_name are required" });
    }

    const existing = await prisma.users.findUnique({ where: { email: input.email } });
    if (existing) return res.status(400).json({ message: "Email already exists" });

    const passwordToHash = input.password ?? randomTempPassword();
    const hashed = await bcrypt.hash(passwordToHash, 10);

    const newUser = await prisma.users.create({
      data: {
        full_name: input.full_name,
        email: input.email,
        phone: input.phone ?? undefined,
        password_hash: hashed,
        platform_role: "studio_owner",
      },
    });

    // TODO: send email with passwordToHash or reset link (do NOT log password in production)
    return res.status(201).json({ user: sanitizeUser(newUser) });
  } catch (err) {
    console.error("createStudioOwner error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* -----------------
   Studio owner: create studio manager (invites)
   - Invoker must be authenticated and owner of a studio
   - Creates a user if not exists (keeps platform_role default 'artist'), then creates studio_members entry with role 'studio_manager'
   ----------------- */
export const createStudioManager = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.user) return res.status(401).json({ message: "Unauthorized" });

    const { full_name, email, phone } = req.body as { full_name: string; email: string; phone?: string };
    if (!email || !full_name) return res.status(400).json({ message: "full_name and email required" });

    // Get studio owned by this user
    const studio = await prisma.studios.findFirst({ where: { owner_id: authReq.user.id } });
    if (!studio) return res.status(400).json({ message: "Studio not found for this owner" });

    // Create or find user
    let user = await prisma.users.findUnique({ where: { email } });
    let tempPassword: string | undefined;
    if (!user) {
      tempPassword = randomTempPassword();
      const hashed = await bcrypt.hash(tempPassword, 10);
      user = await prisma.users.create({
        data: {
          full_name,
          email,
          phone: phone ?? undefined,
          password_hash: hashed,
          // keep top-level platform_role as 'artist' to represent a normal user; studio role is per-studio in studio_members
          platform_role: "artist",
        },
      });
      // TODO: send invite email with tempPassword OR invite token and force reset
    }

    // Ensure membership unique constraint: studio_members has unique(studio_id, user_id)
    const existingMember = await prisma.studio_members.findUnique({
      where: { studio_id_user_id: { studio_id: studio.id, user_id: user.id } } as any, // composite unique
    }).catch(() => null);

    if (existingMember) {
      return res.status(400).json({ message: "User already a member of this studio" });
    }

    const member = await prisma.studio_members.create({
      data: {
        studio_id: studio.id,
        user_id: user.id,
        role: "studio_manager",
        invited_by: authReq.user.id,
      },
    });

    return res.status(201).json({ member });
  } catch (err) {
    console.error("createStudioManager error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* -----------------
   Studio owner: create studio staff (similar to manager)
   ----------------- */
export const createStudioStaff = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.user) return res.status(401).json({ message: "Unauthorized" });

    const { full_name, email, phone } = req.body as { full_name: string; email: string; phone?: string };
    if (!email || !full_name) return res.status(400).json({ message: "full_name and email required" });

    const studio = await prisma.studios.findFirst({ where: { owner_id: authReq.user.id } });
    if (!studio) return res.status(400).json({ message: "Studio not found for this owner" });

    let user = await prisma.users.findUnique({ where: { email } });
    let tempPassword: string | undefined;
    if (!user) {
      tempPassword = randomTempPassword();
      const hashed = await bcrypt.hash(tempPassword, 10);
      user = await prisma.users.create({
        data: {
          full_name,
          email,
          phone: phone ?? undefined,
          password_hash: hashed,
          platform_role: "artist",
        },
      });
      // TODO: send invite email with tempPassword or reset link
    }

    const existingMember = await prisma.studio_members.findUnique({
      where: { studio_id_user_id: { studio_id: studio.id, user_id: user.id } } as any,
    }).catch(() => null);

    if (existingMember) {
      return res.status(400).json({ message: "User already a member of this studio" });
    }

    const member = await prisma.studio_members.create({
      data: {
        studio_id: studio.id,
        user_id: user.id,
        role: "studio_staff",
        invited_by: authReq.user.id,
      },
    });

    return res.status(201).json({ member });
  } catch (err) {
    console.error("createStudioStaff error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* -----------------
   Forgot password (sends reset token)
   - returns 200 regardless to avoid user enumeration
   ----------------- */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "email required" });

    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) {
      // don't reveal whether the email exists
      return res.status(200).json({ message: "If that email exists, a reset link has been sent" });
    }

    const token = generateResetToken(user.id);
    // TODO: send email with reset link (do NOT log token in production)
    console.log(`Reset token (DEV ONLY): ${token}`);

    return res.json({ message: "Reset password link sent to your email" });
  } catch (err) {
    console.error("forgotPassword error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* -----------------
   Reset password
   ----------------- */
export const resetPassword = async (req: Request, res: Response) => {
  const input: ResetPasswordInput = req.body;
  try {
    if (!input || !input.token || !input.newPassword) {
      return res.status(400).json({ message: "token and newPassword are required" });
    }

    const decoded = jwt.verify(input.token, JWT_SECRET) as { id: string };
    const hashed = await bcrypt.hash(input.newPassword, 10);

    await prisma.users.update({ where: { id: decoded.id }, data: { password_hash: hashed } });

    return res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(400).json({ message: "Invalid or expired token" });
  }
};
