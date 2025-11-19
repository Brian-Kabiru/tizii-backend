// src/routes/bookingRoutes.ts
import express, { RequestHandler } from "express";
import {
  getBookings,
  getBookingById,
  createBooking,
  updateBooking,
  updateBookingStatus,
  deleteBooking,
} from "../controllers/bookingController";
import { authMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// GET all bookings (artist / studio manager / admin)
router.get("/", getBookings as RequestHandler);

// GET a single booking by ID
router.get("/:id", getBookingById as RequestHandler);

// POST a new booking
router.post("/", createBooking as RequestHandler);

// PATCH booking general fields (e.g., notes, duration)
router.patch("/:id", updateBooking as RequestHandler);

// PATCH booking status only
router.patch("/:id/status", updateBookingStatus as RequestHandler);

// DELETE booking (admin only)
router.delete("/:id", deleteBooking as RequestHandler);

export default router;
