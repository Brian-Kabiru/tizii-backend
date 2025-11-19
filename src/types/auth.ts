import { Request } from "express";

export type PlatformRole = "artist" | "admin" | "studio_owner" | "studio_manager" | "studio_staff";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: PlatformRole;
    email?: string;
  };
}

// Inputs
export interface SignupInput {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export interface CreateUserInput {
  full_name: string;
  email: string;
  password?: string;
  phone?: string;
}
