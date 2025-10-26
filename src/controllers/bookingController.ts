import { Request, Response } from "express";
import prisma from "../prisma/client";
import { initiateSTKPush } from "../services/mpesa";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

// Helper to parse/validate dates
const parseDate = (d: any) => {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
};

// GET / - role-based list
export const getBookings = async (req: Request, res: Response) => {
  try {
    const r = req as AuthenticatedRequest;

    // Admin -> all bookings
    if (r.user?.role === "admin") {
      const bookings = await prisma.bookings.findMany({
        include: {
          users: { select: { id: true, full_name: true, email: true } },
          studios: { select: { id: true, name: true, location: true, owner_id: true } },
          payments: true,
        },
        orderBy: { start_time: "desc" },
      });
      return res.json(bookings);
    }

    // Studio manager -> bookings for studios they own
    if (r.user?.role === "studio_manager") {
      // find studio ids owned by this manager
      const ownedStudios = await prisma.studios.findMany({
        where: { owner_id: r.user.id },
        select: { id: true },
      });
      const studioIds = ownedStudios.map((s) => s.id);
      const bookings = await prisma.bookings.findMany({
        where: { studio_id: { in: studioIds } },
        include: { users: true, studios: true, payments: true },
        orderBy: { start_time: "desc" },
      });
      return res.json(bookings);
    }

    // Artist -> only their bookings
    if (r.user?.role === "artist") {
      const bookings = await prisma.bookings.findMany({
        where: { artist_id: r.user.id },
        include: { users: true, studios: true, payments: true },
        orderBy: { start_time: "desc" },
      });
      return res.json(bookings);
    }

    return res.status(403).json({ error: "Forbidden" });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
};

// GET /:id - role-aware access
export const getBookingById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const r = req as AuthenticatedRequest;

    const booking = await prisma.bookings.findUnique({
      where: { id },
      include: { users: true, studios: true, payments: true },
    });

    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // Admin can access all
    if (r.user?.role === "admin") return res.json(booking);

    // Artist: must be artist on booking
    if (r.user?.role === "artist" && booking.artist_id === r.user.id) return res.json(booking);

    // Studio manager: must own the studio
    if (r.user?.role === "studio_manager") {
      const studio = await prisma.studios.findUnique({ where: { id: booking.studio_id || undefined } });
      if (studio?.owner_id === r.user.id) return res.json(booking);
    }

    return res.status(403).json({ error: "Forbidden: You don't have access to this booking" });
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({ error: "Failed to fetch booking" });
  }
};

// POST / - create booking (artist only)
export const createBooking = async (req: Request, res: Response) => {
  try {
    const r = req as AuthenticatedRequest;
    // Use authenticated artist id; ignore artist_id in body to avoid spoofing
    const artist_id = r.user?.id;
    if (!artist_id) return res.status(401).json({ error: "Unauthorized" });

    const { studio_id, start_time, end_time, duration_minutes, amount, currency } = req.body;

    if (!studio_id || !start_time || !end_time || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const start = parseDate(start_time);
    const end = parseDate(end_time);
    if (!start || !end) return res.status(400).json({ error: "Invalid start_time or end_time" });
    if (start >= end) return res.status(400).json({ error: "End time must be after start time" });

    // confirm studio exists
    const studio = await prisma.studios.findUnique({ where: { id: studio_id } });
    if (!studio) return res.status(404).json({ error: "Studio not found" });

    // Check overlapping bookings for that studio
    const overlapping = await prisma.bookings.findFirst({
      where: {
        studio_id,
        AND: [{ start_time: { lt: end } }, { end_time: { gt: start } }],
      },
    });

    if (overlapping) {
      return res.status(409).json({
        error: "This studio is already booked for the selected time range",
        existingBooking: { id: overlapping.id, start_time: overlapping.start_time, end_time: overlapping.end_time },
      });
    }

    // Create booking and payment in a transaction
    const [booking] = await prisma.$transaction([
      prisma.bookings.create({
        data: {
          artist_id,
          studio_id,
          start_time: start,
          end_time: end,
          duration_minutes: duration_minutes || Math.round((+end - +start) / 60000),
          amount,
          currency: currency || "KES",
          status: "pending",
        },
      }),
      // create payments row using the returned booking id will be done in a second transaction step below,
      // but we can create the payment afterwards, updating booking.payment_id if you prefer.
    ]);

    // Create associated payment (separate step so we have booking.id)
    const createdPayment = await prisma.payments.create({
      data: {
        booking_id: booking.id,
        provider: "MPESA",
        amount,
        currency: currency || "KES",
        status: "pending",
      },
    });

    // link payment to booking (optional if you keep payment_id on bookings)
    await prisma.bookings.update({
      where: { id: booking.id },
      data: { payment_id: createdPayment.id },
    });

    const bookingWithRelations = await prisma.bookings.findUnique({
      where: { id: booking.id },
      include: { payments: true, users: true, studios: true },
    });

    res.status(201).json(bookingWithRelations);
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ error: "Failed to create booking" });
  }
};

// POST /pay - initiate MPESA STK push for a booking (artist)
export const payBookingMpesa = async (req: Request, res: Response) => {
  try {
    const r = req as AuthenticatedRequest;
    const { booking_id, phone_number } = req.body;

    if (!booking_id || !phone_number) return res.status(400).json({ error: "Missing booking_id or phone_number" });

    const booking = await prisma.bookings.findUnique({
      where: { id: booking_id },
      include: { payments: true },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // Artist must own this booking unless admin triggers it
    if (r.user?.role === "artist" && booking.artist_id !== r.user.id) {
      return res.status(403).json({ error: "Forbidden: You can only pay for your own bookings" });
    }

    const payment = booking.payments && booking.payments[0];
    if (!payment) return res.status(404).json({ error: "Payment record not found" });

    // Call MPESA STK Push service
    const result = await initiateSTKPush({
      amount: Number(payment.amount),
      phoneNumber: phone_number,
      accountReference: booking.id,
      transactionDesc: "Tizii Studio Booking",
    });

    // Update payment with provider response
    await prisma.payments.update({
      where: { id: payment.id },
      data: {
        raw_response: result as any,
        provider_reference: result.CheckoutRequestID ?? null,
        phone_number,
        status: "processing",
      },
    });

    res.json({
      message: "STK push initiated successfully",
      checkoutRequestId: result.CheckoutRequestID ?? null,
    });
  } catch (error) {
    console.error("Error initiating MPESA payment:", error);
    res.status(500).json({ error: "Failed to initiate payment" });
  }
};

// PATCH /:id/status - update booking status (studio_manager only for their studios, admin all)
export const updateBookingStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const r = req as AuthenticatedRequest;

    if (!["pending", "confirmed", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid booking status" });
    }

    const booking = await prisma.bookings.findUnique({ where: { id }, include: { studios: true } });
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // Studio manager can only update bookings for studios they own
    if (r.user?.role === "studio_manager") {
      const studio = await prisma.studios.findUnique({ where: { id: booking.studio_id || undefined } });
      if (!studio || studio.owner_id !== r.user.id) {
        return res.status(403).json({ error: "Forbidden: You can only update bookings for your studios" });
      }
    }

    const updated = await prisma.bookings.update({ where: { id }, data: { status }, include: { payments: true } });
    res.json(updated);
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({ error: "Failed to update booking" });
  }
};

// DELETE /:id - admin only
export const deleteBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // cascade will remove payments via prisma schema onDelete: Cascade
    await prisma.bookings.delete({ where: { id } });
    res.json({ message: "Booking deleted successfully" });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({ error: "Failed to delete booking" });
  }
};
