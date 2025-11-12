// src/controllers/paymentsController.ts
import { Request, Response } from "express";
import prisma from "../prisma/client";
import { initiateSTKPush } from "../services/mpesa";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * 🏦 Initiate MPESA payment for a booking
 */
export const initiatePayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { booking_id, phone_number } = req.body;

    if (!booking_id || !phone_number) {
      return res.status(400).json({ error: "Missing booking_id or phone_number" });
    }

    // Fetch booking and related studio + payments
    const booking = await prisma.bookings.findUnique({
      where: { id: booking_id },
      include: { payments: true, studios: true },
    });

    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (!booking.studios) return res.status(400).json({ error: "Booking studio not found" });

    // Role-based check: artist can only pay for their own bookings
    if (req.user?.role === "artist" && booking.artist_id !== req.user.id) {
      return res.status(403).json({ error: "You can only pay for your own bookings" });
    }

    // Use the first payment record
    const payment = booking.payments[0];
    if (!payment) return res.status(404).json({ error: "Payment record not found" });

    // Determine businessShortCode and transactionType
    const businessShortCode =
      booking.studios.payment_type === "paybill"
        ? booking.studios.paybill_number
        : booking.studios.till_number;

    if (!businessShortCode) {
      return res.status(400).json({ error: "Studio payment details not configured" });
    }

    const transactionType =
      booking.studios.payment_type === "paybill"
        ? "CustomerPayBillOnline"
        : "CustomerBuyGoodsOnline";

    // Initiate STK Push
    const result = await initiateSTKPush({
      amount: Number(payment.amount),
      phoneNumber: phone_number,
      accountReference: booking.id,
      transactionDesc: "Tizii Studio Booking",
      businessShortCode,
      transactionType,
    });

    // Update payment record
    await prisma.payments.update({
      where: { id: payment.id },
      data: {
        raw_response: result as any,
        provider_reference: result.CheckoutRequestID ?? null,
        phone_number,
        mpesa_paybill_number: booking.studios.payment_type === "paybill" ? businessShortCode : null,
        mpesa_till_number: booking.studios.payment_type === "till" ? businessShortCode : null,
        status: "processing",
      },
    });

    res.json({
      message: "STK push initiated",
      checkoutRequestId: result.CheckoutRequestID ?? null,
    });
  } catch (error) {
    console.error("Error initiating MPESA payment:", error);
    res.status(500).json({ error: "Failed to initiate payment" });
  }
};

/**
 * 📲 Handle MPESA callback
 */
export const mpesaCallback = async (req: Request, res: Response) => {
  try {
    const callback = req.body;
    const body = callback?.Body?.stkCallback;

    const checkoutRequestId = body?.CheckoutRequestID;
    const resultCode = body?.ResultCode;

    const payment = await prisma.payments.findFirst({
      where: { provider_reference: checkoutRequestId },
    });

    if (!payment) return res.status(404).json({ error: "Payment not found" });

    const status = resultCode === 0 ? "completed" : "failed";

    await prisma.payments.update({
      where: { id: payment.id },
      data: { status, raw_response: callback as any },
    });

    if (status === "completed" && payment.booking_id) {
      await prisma.bookings.update({
        where: { id: payment.booking_id },
        data: { status: "confirmed" },
      });
    }

    res.json({ message: "Callback processed successfully" });
  } catch (error) {
    console.error("Error processing MPESA callback:", error);
    res.status(500).json({ error: "Failed to process callback" });
  }
};

/**
 * 💰 Get payment status
 */
export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payments.findUnique({ where: { id } });
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    res.json({
      status: payment.status,
      amount: payment.amount,
      booking_id: payment.booking_id,
      provider_reference: payment.provider_reference,
      mpesa_paybill_number: payment.mpesa_paybill_number,
      mpesa_till_number: payment.mpesa_till_number,
    });
  } catch (error) {
    console.error("Error fetching payment status:", error);
    res.status(500).json({ error: "Failed to fetch payment status" });
  }
};
