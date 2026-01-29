// src/controllers/paymentController.ts
import { Request, Response } from "express";
import { createPayment, updatePaymentStatus } from "../services/paymentService";
import prisma from "../prisma/client";

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
    const { id } = req.params as { id: string };
    const { status, response } = req.body;
    const payment = await updatePaymentStatus(id, status, response);
    res.json(payment);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Failed to update payment status" });
  }
};

/**
 * GET /payments/:id
 * Fetch payment details by ID
 */
export const getPaymentByIdController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const payment = await prisma.payments.findUnique({ where: { id } });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.json(payment);
  } catch (err: any) {
    console.error("Error fetching payment:", err);
    res.status(500).json({ message: "Failed to fetch payment", error: err.message });
  }
};
