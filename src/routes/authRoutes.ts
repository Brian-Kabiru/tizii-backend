import { Router } from "express";
import {
  signupArtist,
  login,
  createStudioOwner,
  createStudioManager,
  createStudioStaff,
  forgotPassword,
  resetPassword,
} from "../controllers/authController";
import { authMiddleware } from "../middleware/authMiddleware";
import { authorize } from "../middleware/authorize";

const router = Router();

// Public routes
router.post("/signup", signupArtist);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Admin-only
router.post("/create-studio-owner", authMiddleware, authorize(["admin"]), createStudioOwner);

// Studio-owner-only
router.post("/create-studio-manager", authMiddleware, authorize(["studio_owner"]), createStudioManager);
router.post("/create-studio-staff", authMiddleware, authorize(["studio_owner"]), createStudioStaff);

export default router;
