// src/services/paymentService.ts
import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import { initiateSTKPush, STKPushResponse } from "./mpesa";

interface CreatePaymentInput {
  booking_id: string;
  provider: "tizii_paybill" | "offline";
  amount: number | Prisma.Decimal;
  phone_number?: string;
  reference?: string;
}

/**
 * Create a payment record and trigger STK Push if online
 */
export const createPayment = async (input: CreatePaymentInput) => {
  const { booking_id, provider, amount, phone_number, reference } = input;

  // Create DB record first
  const payment = await prisma.payments.create({
    data: {
      booking_id,
      provider,
      amount: typeof amount === "number" ? new Prisma.Decimal(amount) : amount,
      status: "pending",
      phone_number: phone_number ?? null,
      provider_reference: reference ?? null,
    },
  });

  // Add logging to debug STK Push issues
  console.log("Creating payment with input:", input);

  if (provider === "tizii_paybill") {
    if (!phone_number) {
      console.error("Phone number is required for Mpesa payment");
      throw new Error("Phone number required for Mpesa payment");
    }

    const booking = await prisma.bookings.findUnique({ where: { id: booking_id } });
    if (!booking) {
      console.error("Booking not found for ID:", booking_id);
      throw new Error("Booking not found");
    }

    const studio = await prisma.studios.findUnique({ where: { id: booking.studio_id } });
    if (!studio) {
      console.error("Studio not found for ID:", booking.studio_id);
      throw new Error("Studio not found");
    }

    console.log("Initiating STK Push with data:", {
      amount: Number(amount),
      phoneNumber: phone_number,
      accountReference: booking.id,
      transactionDesc: `Booking at ${studio.name}`,
      businessShortCode: studio.tizii_paybill || process.env.MPESA_BUSINESS_SHORTCODE || "",
    });

    const stkResponse: STKPushResponse = await initiateSTKPush({
      amount: Number(amount),
      phoneNumber: phone_number,
      accountReference: booking.id,
      transactionDesc: `Booking at ${studio.name}`,
      businessShortCode: studio.tizii_paybill || process.env.MPESA_BUSINESS_SHORTCODE || "",
    });

    console.log("STK Push response:", stkResponse);

    // Update payment record with CheckoutRequestID
    await prisma.payments.update({
      where: { id: payment.id },
      data: { provider_reference: stkResponse.CheckoutRequestID },
    });
  }

  return payment;
};

/**
 * Update payment status from Mpesa callback or offline
 */
export const updatePaymentStatus = async (
  payment_id: string,
  status: "pending" | "success" | "failed",
  response?: object
) => {
  const payment = await prisma.payments.update({
    where: { id: payment_id },
    data: { status, raw_response: response ?? undefined },
  });

  // Handle booking status based on payment outcome
  if (status === "success" && payment.booking_id) {
    await prisma.bookings.update({
      where: { id: payment.booking_id },
      data: { status: "confirmed" },
    });
  } else if (status === "failed" && payment.booking_id) {
    await prisma.bookings.update({
      where: { id: payment.booking_id },
      data: { status: "cancelled" },
    });

    // Optionally, release slots if payment fails
    await prisma.booking_slots.deleteMany({
      where: { booking_id: payment.booking_id },
    });
  }

  return payment;
};
