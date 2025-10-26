import express from "express";
import {
  getBookings,
  getBookingById,
  createBooking,
  payBookingMpesa,
  updateBookingStatus,
  deleteBooking,
} from "../controllers/bookingController";
import { authMiddleware } from "../middleware/authMiddleware";
import { authorize } from "../middleware/authorize";

const router = express.Router();

// Artists can view and create bookings (artists + admins can GET)
router.get("/", authMiddleware, authorize("artist", "studio_manager", "admin"), getBookings);
router.get("/:id", authMiddleware, authorize("artist", "studio_manager", "admin"), getBookingById);

// Only artists create bookings
router.post("/", authMiddleware, authorize("artist"), createBooking);

// Trigger MPESA STK push (artist pays for their booking)
router.post("/pay", authMiddleware, authorize("artist", "admin"), payBookingMpesa);

// Admin and studio_manager can update status (studio_manager only for their studios)
router.patch("/:id/status", authMiddleware, authorize("studio_manager", "admin"), updateBookingStatus);

// Only admin deletes
router.delete("/:id", authMiddleware, authorize("admin"), deleteBooking);

export default router;
