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

    // Validate callback data
    const checkoutRequestID = data?.Body?.stkCallback?.CheckoutRequestID;
    const resultCode = data?.Body?.stkCallback?.ResultCode;
    const callbackMetadata = data?.Body?.stkCallback?.CallbackMetadata;

    if (!checkoutRequestID) {
      console.warn("Missing CheckoutRequestID in callback");
      return res.status(400).json({ message: "No CheckoutRequestID" });
    }

    const payment = await prisma.payments.findFirst({ where: { provider_reference: checkoutRequestID } });
    if (!payment) {
      console.warn(`Payment not found for CheckoutRequestID: ${checkoutRequestID}`);
      return res.status(404).json({ message: "Payment not found" });
    }

    const status = resultCode === 0 ? "success" : "failed";

    // Update payment record
    await prisma.payments.update({
      where: { id: payment.id },
      data: { status, raw_response: data },
    });

    // Confirm booking if payment succeeded
    if (status === "success" && payment.booking_id) {
      await prisma.bookings.update({
        where: { id: payment.booking_id },
        data: { status: "confirmed" },
      });
      console.log(`Booking ${payment.booking_id} confirmed after successful payment.`);
    } else if (status === "failed") {
      console.warn(`Payment failed for CheckoutRequestID: ${checkoutRequestID}`);
    }

    res.json({ message: "Callback processed successfully" });
  } catch (err: any) {
    console.error("Error processing Mpesa callback:", err);
    res.status(500).json({ message: "Failed to process callback", error: err.message });
  }
};
