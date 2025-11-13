// src/controllers/bookingController.ts
import { Response } from "express";
import prisma from "../prisma/client";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

// ---------------------- Helpers ----------------------
const parseDate = (d: string | Date): Date | null => {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
};

// ---------------------- GET /bookings ----------------------
export const getBookings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    type WhereFilter = {
      artist_id?: string;
      studio_id?: { in: string[] };
    };

    const where: WhereFilter = {};

    if (req.user?.role === "artist") where.artist_id = req.user.id;
    if (req.user?.role === "studio_manager") {
      const studios = await prisma.studios.findMany({
        where: { owner_id: req.user.id },
        select: { id: true },
      });
      where.studio_id = { in: studios.map((s) => s.id) };
    }

    const bookings = await prisma.bookings.findMany({
      where,
      include: {
        users: { select: { id: true, full_name: true, email: true } },
        studios: {
          select: {
            id: true,
            name: true,
            location: true,
            owner_id: true,
            payment_type: true,
            paybill_number: true,
            till_number: true,
          },
        },
        payments: true,
        booking_slots: true,
      },
      orderBy: { start_time: "desc" },
    });

    res.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
};

// ---------------------- GET /bookings/:id ----------------------
export const getBookingById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const booking = await prisma.bookings.findUnique({
      where: { id },
      include: {
        users: true,
        studios: {
          select: {
            id: true,
            owner_id: true,
            payment_type: true,
            paybill_number: true,
            till_number: true,
          },
        },
        payments: true,
        booking_slots: true,
      },
    });

    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const hasAccess =
      req.user?.role === "admin" ||
      (req.user?.role === "artist" && booking.artist_id === req.user.id) ||
      (req.user?.role === "studio_manager" && booking.studios?.owner_id === req.user.id);

    if (!hasAccess) return res.status(403).json({ error: "Forbidden: You don't have access" });

    res.json(booking);
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({ error: "Failed to fetch booking" });
  }
};

// ---------------------- POST /bookings ----------------------
interface SlotInput {
  start_time: string | Date;
  end_time: string | Date;
}

interface CreateBookingBody {
  studio_id: string;
  slots: SlotInput[];
  currency?: string;
}

interface ValidatedSlot {
  start: Date;
  end: Date;
  duration: number;
}

export const createBooking = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const artist_id = req.user.id;

    const { studio_id, slots, currency } = req.body as CreateBookingBody;

    if (!studio_id || !Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ error: "studio_id and slots[] are required" });
    }

    const studio = await prisma.studios.findUnique({ where: { id: studio_id } });
    if (!studio) return res.status(404).json({ error: "Studio not found" });

    const validatedSlots: ValidatedSlot[] = [];
    let totalAmount = 0;

    for (const slot of slots) {
      const start = parseDate(slot.start_time);
      const end = parseDate(slot.end_time);

      if (!start || !end) return res.status(400).json({ error: "Invalid slot date" });
      if (start >= end) return res.status(400).json({ error: "Slot end must be after start" });

      const overlapping = await prisma.booking_slots.findFirst({
        where: {
          booking: { studio_id },
          AND: [{ start_time: { lt: end } }, { end_time: { gt: start } }],
        },
      });

      if (overlapping) {
        return res.status(409).json({
          error: "Studio already booked for one or more selected slots",
          conflict: { start_time: overlapping.start_time, end_time: overlapping.end_time },
        });
      }

      const duration = Math.round((+end - +start) / 60000);
      totalAmount += Number(studio.price_per_hour) * (duration / 60);
      validatedSlots.push({ start, end, duration });
    }

    const payment = await prisma.payments.create({
      data: {
        provider: "MPESA",
        amount: totalAmount,
        currency: currency || "KES",
        status: "pending",
      },
    });

    const booking = await prisma.bookings.create({
      data: {
        artist_id,
        studio_id,
        start_time: validatedSlots[0].start,
        end_time: validatedSlots[validatedSlots.length - 1].end,
        duration_minutes: validatedSlots.reduce((acc, s) => acc + s.duration, 0),
        amount: totalAmount,
        currency: currency || "KES",
        status: "pending",
        payment_id: payment.id,
        booking_slots: { create: validatedSlots.map((s) => ({ start_time: s.start, end_time: s.end })) },
      },
      include: { booking_slots: true },
    });

    await prisma.payments.update({
      where: { id: payment.id },
      data: { booking_id: booking.id },
    });

    res.status(201).json({ message: "Booking created successfully", booking, payment });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ error: "Failed to create booking" });
  }
};

// ---------------------- PATCH /bookings/:id/status ----------------------
export const updateBookingStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: "pending" | "confirmed" | "completed" | "cancelled" };

    if (!["pending", "confirmed", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const booking = await prisma.bookings.findUnique({
      where: { id },
      include: { studios: true },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    if (req.user?.role === "studio_manager" && booking.studios?.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden: Cannot update this booking" });
    }

    const updated = await prisma.bookings.update({
      where: { id },
      data: { status },
      include: { payments: true },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error updating booking status:", error);
    res.status(500).json({ error: "Failed to update booking" });
  }
};

// ---------------------- DELETE /bookings/:id ----------------------
export const deleteBooking = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });

    const { id } = req.params;
    await prisma.bookings.delete({ where: { id } });

    res.json({ message: "Booking deleted successfully" });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({ error: "Failed to delete booking" });
  }
};
