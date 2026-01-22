// src/routes/paymentRoutes.ts
import { Router } from "express";
import {
  createPaymentController,
  updatePaymentStatusController,
  getPaymentByIdController,
} from "../controllers/paymentController";
import { mpesaCallbackController } from "../controllers/mpesaController";

const router = Router();

router.post("/payments", createPaymentController);
router.put("/payments/:id/status", updatePaymentStatusController);
router.get("/payments/:id", getPaymentByIdController); // Fetch payment details by ID

// Mpesa callback from Safaricom
router.post("/mpesa/callback", mpesaCallbackController);

export default router;
