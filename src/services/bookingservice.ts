// src/services/bookingService.ts
import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import { CreateBookingInput, UpdateBookingInput, BookingSlotInput } from "../types/booking";
import { addMinutes, isBefore, isAfter } from "date-fns";
import { createPayment } from "./paymentService";

/**
 * Generate booking slots
 */
export const generateBookingSlots = (start: Date, end: Date, intervalMinutes: number): BookingSlotInput[] => {
  const slots: BookingSlotInput[] = [];
  let current = new Date(start);

  while (isBefore(current, end)) {
    const slotEnd = addMinutes(current, intervalMinutes);
    if (isAfter(slotEnd, end)) break;
    slots.push({ booking_id: "", start_time: current, end_time: slotEnd });
    current = slotEnd;
  }

  return slots;
};

/**
 * Check room availability
 */
export const isRoomAvailable = async (room_id: string, start_time: Date, end_time: Date) => {
  const overlapping = await prisma.bookings.findFirst({
    where: {
      room_id,
      OR: [
        { start_time: { lte: end_time }, end_time: { gte: start_time } },
      ],
      status: { in: ["pending", "confirmed"] },
    },
  });

  return !overlapping;
};

/**
 * Create a booking and automatically create payment
 */
export const createBooking = async (input: CreateBookingInput & { payment_method: "online" | "offline"; phone_number?: string }) => {
  const { artist_id, studio_id, room_id, start_time, end_time, duration_minutes, amount, currency, notes, collaborators, payment_method, phone_number } = input;

  // Check room availability
  if (room_id) {
    const available = await isRoomAvailable(room_id, new Date(start_time), new Date(end_time));
    if (!available) throw new Error("Room not available for selected time slot");
  }

  // Create booking
  const booking = await prisma.bookings.create({
    data: {
      artist_id,
      studio_id,
      room_id: room_id ?? undefined,
      start_time: new Date(start_time),
      end_time: new Date(end_time),
      duration_minutes,
      amount: typeof amount === "number" || typeof amount === "string" ? new Prisma.Decimal(amount) : amount,
      currency: currency ?? "KES",
      notes: notes ?? null,
      collaborators: collaborators ?? Prisma.JsonNull,
      status: payment_method === "offline" ? "confirmed" : "pending",
    },
  });

  // Generate slots
  const slots = generateBookingSlots(new Date(start_time), new Date(end_time), 60); // 1-hour intervals
  for (const slot of slots) slot.booking_id = booking.id;
  await prisma.booking_slots.createMany({ data: slots });

  // Trigger payment if online
  if (payment_method === "online") {
    if (!phone_number) throw new Error("Phone number required for online payment");
    await createPayment({
      booking_id: booking.id,
      provider: "tizii_paybill",
      amount: typeof amount === "number" ? amount : Number(amount),
      phone_number,
    });
  }

  return booking;
};

/**
 * Update a booking
 */
export const updateBooking = async (bookingId: string, input: UpdateBookingInput) => {
  const booking = await prisma.bookings.update({
    where: { id: bookingId },
    data: {
      start_time: input.start_time ? new Date(input.start_time) : undefined,
      end_time: input.end_time ? new Date(input.end_time) : undefined,
      duration_minutes: input.duration_minutes ?? undefined,
      amount: input.amount !== undefined ? new Prisma.Decimal(input.amount) : undefined,
      currency: input.currency ?? undefined,
      status: input.status ?? undefined,
      notes: input.notes ?? undefined,
      collaborators: input.collaborators ?? undefined,
    },
  });

  return booking;
};
