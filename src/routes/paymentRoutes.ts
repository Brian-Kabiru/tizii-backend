// src/routes/paymentRoutes.ts
import { Router } from "express";
import {
  createPaymentController,
  updatePaymentStatusController,
} from "../controllers/paymentController";
import { mpesaCallbackController } from "../controllers/mpesaController";

const router = Router();

router.post("/payments", createPaymentController);
router.put("/payments/:id/status", updatePaymentStatusController);

// Mpesa callback from Safaricom
router.post("/mpesa/callback", mpesaCallbackController);

export default router;
