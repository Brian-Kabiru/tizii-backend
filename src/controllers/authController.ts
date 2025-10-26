import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import prisma from "../prisma/client";

// -------------------- CONFIG --------------------
const JWT_SECRET: Secret = process.env.JWT_SECRET as Secret;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not defined");

const JWT_EXPIRES_IN: SignOptions["expiresIn"] =
  (process.env.JWT_EXPIRES_IN as SignOptions["expiresIn"]) ?? "7d";


// -------------------- TYPES --------------------
interface SignupRequestBody {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
  role?: "artist" | "studio_manager" | "admin";
}

interface LoginRequestBody {
  email: string;
  password: string;
}

// -------------------- SIGNUP --------------------
export const signup = async (
  req: Request<{}, {}, SignupRequestBody>,
  res: Response
) => {
  try {
    const { email, password, full_name, phone, role } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required" });
    }

    const existingUser = await prisma.users.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.users.create({
      data: {
        email,
        phone: phone ?? null,
        full_name: full_name ?? null,
        password_hash: hashedPassword,
        role: role ?? "artist",
      },
    });

    return res.status(201).json({
      message: "User created successfully",
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Signup failed" });
  }
};

// -------------------- LOGIN --------------------
export const login = async (
  req: Request<{}, {}, LoginRequestBody>,
  res: Response
) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required" });
    }

    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const isPasswordValid = await bcrypt.compare(password, user.password_hash!);
    if (!isPasswordValid)
      return res.status(401).json({ error: "Invalid credentials" });

    const payload = { id: user.id, email: user.email, role: user.role };
    const options: SignOptions = { expiresIn: JWT_EXPIRES_IN };

    const token = jwt.sign(payload, JWT_SECRET as Secret, options);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
};
