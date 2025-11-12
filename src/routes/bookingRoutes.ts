// src/routes/bookingRoutes.ts
import express, { Request, Response } from "express";
import {
  getBookings,
  getBookingById,
  createBooking,
  updateBookingStatus,
  deleteBooking,
} from "../controllers/bookingController";
import { initiatePayment } from "../controllers/paymentController";
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

// GET /bookings - role-based list
router.get(
  "/",
  authMiddleware,
  authorize("artist", "studio_manager", "admin"),
  authHandler(getBookings)
);

// GET /bookings/:id - single booking
router.get(
  "/:id",
  authMiddleware,
  authorize("artist", "studio_manager", "admin"),
  authHandler(getBookingById)
);

// POST /bookings - create multi-slot/multi-day booking (artists only)
router.post(
  "/",
  authMiddleware,
  authorize("artist"),
  authHandler(createBooking)
);

// POST /bookings/pay - trigger MPESA STK push for a booking
router.post(
  "/pay",
  authMiddleware,
  authorize("artist", "admin"),
  authHandler(initiatePayment)
);

// PATCH /bookings/:id/status - update booking status
router.patch(
  "/:id/status",
  authMiddleware,
  authorize("studio_manager", "admin"),
  authHandler(updateBookingStatus)
);

// DELETE /bookings/:id - admin only
router.delete(
  "/:id",
  authMiddleware,
  authorize("admin"),
  authHandler(deleteBooking)
);

export default router;
