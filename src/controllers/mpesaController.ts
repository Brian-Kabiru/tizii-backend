// src/controllers/mpesaController.ts
import { Request, Response } from "express";
import prisma from "../prisma/client";

/**
 * POST /mpesa/callback
 * Called by Safaricom when STK Push completes
 */
export const mpesaCallbackController = async (req: Request, res: Response) => {
  try {
    const data = req.body;

    const checkoutRequestID = data?.Body?.stkCallback?.CheckoutRequestID;
    const resultCode = data?.Body?.stkCallback?.ResultCode;

    if (!checkoutRequestID) return res.status(400).send("No CheckoutRequestID");

    const payment = await prisma.payments.findFirst({ where: { provider_reference: checkoutRequestID } });
    if (!payment) return res.status(404).send("Payment not found");

    const status = resultCode === 0 ? "success" : "failed";

    await prisma.payments.update({
      where: { id: payment.id },
      data: { status, raw_response: data },
    });

    // Confirm booking if success
    if (status === "success" && payment.booking_id) {
      await prisma.bookings.update({
        where: { id: payment.booking_id },
        data: { status: "confirmed" },
      });
    }

    res.json({ message: "Callback processed" });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Failed to process callback", error: err.message });
  }
};
