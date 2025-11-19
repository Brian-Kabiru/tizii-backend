// src/controllers/paymentController.ts
import { Request, Response } from "express";
import { createPayment, updatePaymentStatus } from "../services/paymentService";

/**
 * POST /payments
 */
export const createPaymentController = async (req: Request, res: Response) => {
  try {
    const payment = await createPayment(req.body);
    res.status(201).json(payment);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Failed to create payment" });
  }
};

/**
 * PUT /payments/:id/status
 */
export const updatePaymentStatusController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, response } = req.body;
    const payment = await updatePaymentStatus(id, status, response);
    res.json(payment);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Failed to update payment status" });
  }
};
