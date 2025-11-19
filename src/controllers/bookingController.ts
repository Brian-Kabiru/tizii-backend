// src/controllers/bookingController.ts
import { Response } from "express";
import prisma from "../prisma/client";
//import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { createBooking as bookingServiceCreateBooking, updateBooking as bookingServiceUpdateBooking } from "../services/bookingservice";
import { AuthenticatedRequest } from "../types/auth";


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
        artist: { select: { id: true, full_name: true, email: true } },
        studio: { include: { rooms: true } },
        payments: true,
        slots: true,
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
        artist: true,
        studio: { include: { rooms: true } },
        payments: true,
        slots: true,
      },
    });

    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const hasAccess =
      req.user?.role === "admin" ||
      (req.user?.role === "artist" && booking.artist_id === req.user.id) ||
      (req.user?.role === "studio_manager" && booking.studio?.owner_id === req.user.id);

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
  room_id?: string;
  slots: SlotInput[];
  payment_method: "online" | "offline";
  phone_number?: string;
  currency?: string;
  notes?: string;
}

export const createBooking = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const artist_id = req.user.id;
    const { studio_id, room_id, slots, payment_method, phone_number, currency, notes } = req.body as CreateBookingBody;

    if (!studio_id || !Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ error: "studio_id and slots[] are required" });
    }

    const studio = await prisma.studios.findUnique({ where: { id: studio_id }, include: { rooms: true } });
    if (!studio) return res.status(404).json({ error: "Studio not found" });

    // Convert slots into start/end and calculate duration
    const validatedSlots = slots.map((slot) => {
      const start = parseDate(slot.start_time);
      const end = parseDate(slot.end_time);
      if (!start || !end) throw new Error("Invalid slot date");
      if (start >= end) throw new Error("Slot end must be after start");
      return { start, end, duration: Math.round((+end - +start) / 60000) };
    });

    const start_time = validatedSlots[0].start;
    const end_time = validatedSlots[validatedSlots.length - 1].end;
    const duration_minutes = validatedSlots.reduce((acc, s) => acc + s.duration, 0);

    // Check for overlapping slots
    if (room_id) {
      for (const s of validatedSlots) {
        const overlapping = await prisma.bookings.findFirst({
          where: {
            room_id,
            OR: [{ start_time: { lte: s.end } }, { end_time: { gte: s.start } }],
            status: { in: ["pending", "confirmed"] },
          },
        });
        if (overlapping) throw new Error(`Room already booked for ${s.start.toISOString()} - ${s.end.toISOString()}`);
      }
    }

    // Calculate amount (assume hourly rate from room if room_id exists)
    let totalAmount = 0;
    if (room_id) {
      const room = studio.rooms.find((r) => r.id === room_id);
      if (!room) throw new Error("Selected room not found in studio");
      totalAmount = (duration_minutes / 60) * Number(room.hourly_rate);
    } else {
      totalAmount = (duration_minutes / 60) * 1000; // fallback studio default rate
    }

    // Call booking service to create booking and trigger payment
    const booking = await bookingServiceCreateBooking({
      artist_id,
      studio_id,
      room_id,
      start_time,
      end_time,
      duration_minutes,
      amount: totalAmount,
      currency: currency || "KES",
      notes,
      collaborators: undefined,
      payment_method,
      phone_number,
    });

    res.status(201).json({ message: "Booking created successfully", booking });
  } catch (error: any) {
    console.error("Error creating booking:", error);
    res.status(400).json({ error: error.message });
  }
};

// ---------------------- PATCH /bookings/:id ----------------------
export const updateBooking = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const booking = await bookingServiceUpdateBooking(id, req.body);
    res.json({ message: "Booking updated successfully", booking });
  } catch (error: any) {
    console.error("Error updating booking:", error);
    res.status(400).json({ error: error.message });
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

    const booking = await prisma.bookings.findUnique({ where: { id }, include: { studio: true } });
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    if (req.user?.role === "studio_manager" && booking.studio?.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden: Cannot update this booking" });
    }

    const updated = await prisma.bookings.update({ where: { id }, data: { status }, include: { payments: true } });
    res.json(updated);
  } catch (error: any) {
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
