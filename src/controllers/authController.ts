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

// JWT config
const JWT_EXPIRES_IN = "1h";
const RESET_PASSWORD_EXPIRES_IN = "15m";

// Generate JWT token
const generateToken = (id: string, role: PlatformRole, email?: string) =>
  jwt.sign({ id, role, email }, process.env.JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN });

// Generate reset token
const generateResetToken = (id: string) =>
  jwt.sign({ id }, process.env.JWT_SECRET!, { expiresIn: RESET_PASSWORD_EXPIRES_IN });

// -----------------
// Public signup for artists
export const signupArtist = async (req: Request, res: Response) => {
  const input: SignupInput = req.body;

  const existing = await prisma.users.findUnique({ where: { email: input.email } });
  if (existing) return res.status(400).json({ message: "Email already exists" });

  const hashed = await bcrypt.hash(input.password, 10);
  const user = await prisma.users.create({
    data: { ...input, password_hash: hashed, platform_role: "artist" },
  });

  const token = generateToken(user.id, user.platform_role as PlatformRole, user.email ?? undefined);

  res.status(201).json({
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email ?? undefined,
      role: user.platform_role as PlatformRole,
    },
    token,
  });
};

// -----------------
// Login
export const login = async (req: Request, res: Response) => {
  const input: LoginInput = req.body;
  const user = await prisma.users.findUnique({ where: { email: input.email } });
  if (!user || !user.password_hash) return res.status(400).json({ message: "Invalid credentials" });

  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) return res.status(400).json({ message: "Invalid credentials" });

  const token = generateToken(user.id, user.platform_role as PlatformRole, user.email ?? undefined);

  res.json({
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email ?? undefined,
      role: user.platform_role as PlatformRole,
    },
    token,
  });
};

// -----------------
// Admin creates studio_owner
export const createStudioOwner = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) return res.status(401).json({ message: "Unauthorized" });

  const input: CreateUserInput = req.body;
  const existing = await prisma.users.findUnique({ where: { email: input.email } });
  if (existing) return res.status(400).json({ message: "Email already exists" });

  const hashed = input.password ? await bcrypt.hash(input.password, 10) : undefined;
  const user = await prisma.users.create({
    data: { ...input, password_hash: hashed, platform_role: "studio_owner" },
  });

  res.status(201).json({
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email ?? undefined,
      role: user.platform_role as PlatformRole,
    },
  });
};

// -----------------
// Studio owner creates studio manager
export const createStudioManager = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) return res.status(401).json({ message: "Unauthorized" });

  const { full_name, email, phone }: { full_name: string; email: string; phone?: string } = req.body;

  // Get studio owned by this user
  const studio = await prisma.studios.findFirst({ where: { owner_id: authReq.user.id } });
  if (!studio) return res.status(400).json({ message: "Studio not found" });

  // Create or find user
  let user = await prisma.users.findUnique({ where: { email } });
  if (!user) {
    const hashed = await bcrypt.hash("defaultManager123", 10);
    user = await prisma.users.create({
      data: { full_name, email, phone, password_hash: hashed, platform_role: "artist" },
    });
  }

  // Add to studio_members as manager
  const member = await prisma.studio_members.create({
    data: { studio_id: studio.id, user_id: user.id, role: "studio_manager", invited_by: authReq.user.id },
  });

  res.status(201).json({ member });
};

// -----------------
// Studio owner creates studio staff
export const createStudioStaff = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) return res.status(401).json({ message: "Unauthorized" });

  const { full_name, email, phone }: { full_name: string; email: string; phone?: string } = req.body;

  const studio = await prisma.studios.findFirst({ where: { owner_id: authReq.user.id } });
  if (!studio) return res.status(400).json({ message: "Studio not found" });

  let user = await prisma.users.findUnique({ where: { email } });
  if (!user) {
    const hashed = await bcrypt.hash("defaultStaff123", 10);
    user = await prisma.users.create({
      data: { full_name, email, phone, password_hash: hashed, platform_role: "artist" },
    });
  }

  const member = await prisma.studio_members.create({
    data: { studio_id: studio.id, user_id: user.id, role: "studio_staff", invited_by: authReq.user.id },
  });

  res.status(201).json({ member });
};

// -----------------
// Forgot password
export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await prisma.users.findUnique({ where: { email } });

  if (!user) return res.status(200).json({ message: "If that email exists, a reset link has been sent" });

  const token = generateResetToken(user.id);
  console.log(`Send reset token: ${token}`);
  // TODO: send email with token link

  res.json({ message: "Reset password link sent to your email" });
};

// -----------------
// Reset password
export const resetPassword = async (req: Request, res: Response) => {
  const input: ResetPasswordInput = req.body;
  try {
    const decoded = jwt.verify(input.token, process.env.JWT_SECRET!) as { id: string };
    const hashed = await bcrypt.hash(input.newPassword, 10);
    await prisma.users.update({ where: { id: decoded.id }, data: { password_hash: hashed } });
    res.json({ message: "Password reset successful" });
  } catch {
    res.status(400).json({ message: "Invalid or expired token" });
  }
};
