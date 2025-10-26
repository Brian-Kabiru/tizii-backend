// src/routes/paymentsRoutes.ts
import express from "express";
import { initiatePayment, mpesaCallback, getPaymentStatus } from "../controllers/paymentController";

const router = express.Router();

router.post("/initiate", initiatePayment);
router.post("/callback", mpesaCallback);
router.get("/:id/status", getPaymentStatus);

export default router;
