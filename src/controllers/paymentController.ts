// src/controllers/paymentsController.ts
import { Request, Response } from "express";
import prisma from "../prisma/client";
import { initiateSTKPush } from "../services/mpesa";

// ✅ Initiate Mpesa STK Push
export const initiatePayment = async (req: Request, res: Response) => {
  try {
    const { booking_id, phone_number } = req.body;
    if (!booking_id || !phone_number) {
      return res.status(400).json({ error: "Missing booking_id or phone_number" });
    }

    // Fetch booking and related payment
    const booking = await prisma.bookings.findUnique({
      where: { id: booking_id },
      include: { payments: true },
    });

    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const payment = booking.payments[0];
    if (!payment) return res.status(404).json({ error: "Payment record not found" });

    // Call Mpesa STK Push API
    const result = await initiateSTKPush({
      amount: Number(payment.amount),
      phoneNumber: phone_number,
      accountReference: booking.id,
      transactionDesc: "Tizii Studio Booking",
    });

    // Save response (cast as any for Prisma JSON)
    await prisma.payments.update({
      where: { id: payment.id },
      data: {
        raw_response: result as any, // ✅ Fix: Prisma JSON accepts any valid object
        provider_reference: (result as any).CheckoutRequestID || null,
        status: "processing",
      },
    });

    res.json({
      message: "STK push initiated successfully",
      checkoutRequestId: (result as any).CheckoutRequestID,
    });
  } catch (error: any) {
    console.error("Error initiating payment:", error);
    res.status(500).json({ error: "Failed to initiate payment" });
  }
};

// ✅ Mpesa Callback Handler
export const mpesaCallback = async (req: Request, res: Response) => {
  try {
    const callback = req.body;

    const body = callback?.Body?.stkCallback;
    const checkoutRequestId = body?.CheckoutRequestID;
    const resultCode = body?.ResultCode;
    const resultDesc = body?.ResultDesc;
    const metadata = body?.CallbackMetadata;

    // Find payment record
    const payment = await prisma.payments.findFirst({
      where: { provider_reference: checkoutRequestId },
    });

    if (!payment) {
      console.warn("Payment not found for callback");
      return res.status(404).json({ error: "Payment not found" });
    }

    // Update payment status
    const status = resultCode === 0 ? "completed" : "failed";

    await prisma.payments.update({
      where: { id: payment.id },
      data: {
        status,
        raw_response: callback as any, // ✅ Fix: cast callback as any for Prisma JSON
      },
    });

    // If successful, confirm booking
    if (status === "completed") {
      await prisma.bookings.update({
        where: { id: payment.booking_id! },
        data: { status: "confirmed" },
      });
    }

    res.json({ message: "Callback received successfully" });
  } catch (error) {
    console.error("Error handling Mpesa callback:", error);
    res.status(500).json({ error: "Failed to process callback" });
  }
};

// ✅ Optional: Get payment status
export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payment = await prisma.payments.findUnique({ where: { id } });

    if (!payment) return res.status(404).json({ error: "Payment not found" });

    res.json({
      status: payment.status,
      amount: payment.amount,
      booking_id: payment.booking_id,
    });
  } catch (error) {
    console.error("Error fetching payment status:", error);
    res.status(500).json({ error: "Failed to fetch payment status" });
  }
};
