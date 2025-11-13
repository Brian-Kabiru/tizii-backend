// src/routes/index.ts
import { Router } from "express";
import authRoutes from "./authRoutes";
import studioRoutes from "./studioRoutes";
import bookingRoutes from "./bookingRoutes";
import paymentRoutes from "./paymentRoutes";

const router = Router();

// Mount auth routes under /auth
router.use("/auth", authRoutes);

// Mount studio routes under /studios
router.use("/studios", studioRoutes);

// Mount booking routes under /bookings
router.use("/bookings", bookingRoutes);

// Mount payment routes under /payments
router.use("/payments", paymentRoutes);

export default router; // ✅ default export
