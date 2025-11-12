// src/routes/paymentsRoutes.ts
import express, { Request, Response } from "express";
import {
  initiatePayment,
  mpesaCallback,
  getPaymentStatus,
} from "../controllers/paymentController";
import { authMiddleware } from "../middleware/authMiddleware";
import { authorize } from "../middleware/authorize";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

const router = express.Router();

/**
 * Helper to wrap handlers using AuthenticatedRequest
 */
const authHandler = (
  handler: (req: AuthenticatedRequest, res: Response) => any
) => (req: Request, res: Response) => handler(req as AuthenticatedRequest, res);

// 🔹 Initiate MPESA payment for a booking
// Only the booking owner (artist) or admin can trigger payment
router.post(
  "/initiate",
  authMiddleware,
  authorize("artist", "admin"),
  authHandler(initiatePayment)
);

// 🔹 MPESA callback URL (no auth, Safaricom will call this endpoint)
router.post("/callback", mpesaCallback);

// 🔹 Get payment status by payment ID
// Authenticated users can check their own payment or admins can check any
router.get(
  "/:id/status",
  authMiddleware,
  authorize("artist", "admin"),
  authHandler(getPaymentStatus)
);

export default router;
