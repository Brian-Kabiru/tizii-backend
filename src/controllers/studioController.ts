import { Request, Response } from "express";
import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import { AuthenticatedRequest } from "../types/auth";
import {
  CreateStudioInput,
  UpdateStudioInput,
  CreateRoomInput,
  UpdateRoomInput,
  AvailabilityInput,
} from "../types/studio";
import { uploadToCloudinary } from "../utils/cloudinary";

/* ------------------ Studios ------------------ */

/**
 * Create a studio with optional multiple photo uploads
 */
export const createStudio = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user)
    return res.status(401).json({ message: "Unauthorized" });

  const input = req.body as CreateStudioInput;
  const files = req.files as Express.Multer.File[] | undefined;

  try {
    // Determine owner_id
    const ownerId =
      authReq.user.role === "admin" && input.owner_id
        ? input.owner_id
        : authReq.user.id;

    // Create studio
    const studio = await prisma.studios.create({
      data: {
        owner_id: ownerId,
        name: input.name,
        description: input.description ?? null,
        location: input.location ?? null,
        timezone: input.timezone ?? "Africa/Nairobi",
        amenities: input.amenities ?? [],
        tizii_paybill: input.tizii_paybill ?? null,
        studio_paybill: input.studio_paybill ?? null,
        till_number: input.till_number ?? null,
        payment_type: input.payment_type ?? "tizii_paybill",
        payout_schedule: input.payout_schedule ?? "monthly",
        payout_account: input.payout_account ?? Prisma.JsonNull,
      },
    });

    // Upload photos if provided
    if (files?.length) {
      const uploadPromises = files.map(async (file) => {
        const uploadedUrl = await uploadToCloudinary(file.buffer); // single arg
        return prisma.studio_photos.create({
          data: {
            studio_id: studio.id,
            url: uploadedUrl, // direct string
            alt_text: file.originalname,
          },
        });
      });
      await Promise.all(uploadPromises);
    }

    // Return studio with gallery
    const studioWithPhotos = await prisma.studios.findUnique({
      where: { id: studio.id },
      include: { gallery: true },
    });

    res.status(201).json({ studio: studioWithPhotos });
  } catch (err) {
    console.error("createStudio error", err);
    res.status(500).json({ message: "Failed to create studio" });
  }
};

/**
 * List all studios
 */
export const listStudios = async (req: Request, res: Response) => {
  try {
    const studios = await prisma.studios.findMany({
      include: {
        rooms: true,
        owner: { select: { id: true, full_name: true, email: true } },
        gallery: true,
      },
    });
    res.json({ studios });
  } catch (err) {
    console.error("listStudios error", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get a single studio by id
 */
export const getStudio = async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    const studio = await prisma.studios.findUnique({
      where: { id },
      include: {
        rooms: true,
        availability: true,
        availability_exceptions: true,
        staff: {
          include: { user: { select: { id: true, full_name: true, email: true } } },
        },
        gallery: true,
      },
    });

    if (!studio) return res.status(404).json({ message: "Studio not found" });

    res.json({ studio });
  } catch (err) {
    console.error("getStudio error", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Update studio info + optionally upload new photos
 */
export const updateStudio = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const id = req.params.id;
  const input = req.body as UpdateStudioInput;
  const files = req.files as Express.Multer.File[] | undefined;

  if (!authReq.user)
    return res.status(401).json({ message: "Unauthorized" });

  try {
    const updated = await prisma.studios.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        description: input.description ?? undefined,
        location: input.location ?? undefined,
        timezone: input.timezone ?? undefined,
        amenities: input.amenities ?? undefined,
        tizii_paybill: input.tizii_paybill ?? undefined,
        studio_paybill: input.studio_paybill ?? undefined,
        till_number: input.till_number ?? undefined,
        payment_type: input.payment_type ?? undefined,
        payout_schedule: input.payout_schedule ?? undefined,
        payout_account: input.payout_account ?? undefined,
      },
    });

    // Upload new photos if provided
    if (files?.length) {
      const uploadPromises = files.map(async (file) => {
        const uploadedUrl = await uploadToCloudinary(file.buffer);
        return prisma.studio_photos.create({
          data: {
            studio_id: updated.id,
            url: uploadedUrl,
            alt_text: file.originalname,
          },
        });
      });
      await Promise.all(uploadPromises);
    }

    const studioWithPhotos = await prisma.studios.findUnique({
      where: { id },
      include: { gallery: true },
    });

    res.json({ studio: studioWithPhotos });
  } catch (err) {
    console.error("updateStudio error", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Delete a studio
 */
export const deleteStudio = async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    await prisma.studios.delete({ where: { id } });
    res.json({ message: "Studio deleted" });
  } catch (err) {
    console.error("deleteStudio error", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ------------------ Rooms ------------------ */

export const createRoom = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) return res.status(401).json({ message: "Unauthorized" });

  const studioId = req.params.studioId;
  const input = req.body as CreateRoomInput;

  try {
    const room = await prisma.rooms.create({
      data: {
        studio_id: studioId,
        name: input.name,
        description: input.description ?? null,
        type: input.type ?? null,
        hourly_rate:
          typeof input.hourly_rate === "string"
            ? input.hourly_rate
            : String(input.hourly_rate),
        overnight_rate: input.overnight_rate
          ? String(input.overnight_rate)
          : null,
        visible: input.visible ?? true,
        equipment: input.equipment ?? [],
      },
    });
    res.status(201).json({ room });
  } catch (err) {
    console.error("createRoom error", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const listRooms = async (req: Request, res: Response) => {
  const studioId = req.params.studioId;
  try {
    const rooms = await prisma.rooms.findMany({ where: { studio_id: studioId } });
    res.json({ rooms });
  } catch (err) {
    console.error("listRooms error", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getRoom = async (req: Request, res: Response) => {
  const id = req.params.roomId;
  try {
    const room = await prisma.rooms.findUnique({ where: { id } });
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json({ room });
  } catch (err) {
    console.error("getRoom error", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateRoom = async (req: Request, res: Response) => {
  const id = req.params.roomId;
  const input = req.body as UpdateRoomInput;

  try {
    const updated = await prisma.rooms.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        description: input.description ?? undefined,
        type: input.type ?? undefined,
        hourly_rate: input.hourly_rate ? String(input.hourly_rate) : undefined,
        overnight_rate:
          input.overnight_rate !== undefined
            ? input.overnight_rate === null
              ? null
              : String(input.overnight_rate)
            : undefined,
        visible: input.visible ?? undefined,
        equipment: input.equipment ?? undefined,
      },
    });
    res.json({ room: updated });
  } catch (err) {
    console.error("updateRoom error", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteRoom = async (req: Request, res: Response) => {
  const id = req.params.roomId;
  try {
    await prisma.rooms.delete({ where: { id } });
    res.json({ message: "Room deleted" });
  } catch (err) {
    console.error("deleteRoom error", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ------------------ Availability ------------------ */

export const addStudioAvailability = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) return res.status(401).json({ message: "Unauthorized" });

  const studioId = req.params.studioId;
  const input = req.body as AvailabilityInput;

  try {
    const avail = await prisma.studio_availability.create({
      data: {
        studio_id: studioId,
        day_of_week: input.day_of_week,
        open_time: input.open_time,
        close_time: input.close_time,
      },
    });
    res.status(201).json({ availability: avail });
  } catch (err) {
    console.error("addStudioAvailability error", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const addRoomAvailability = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) return res.status(401).json({ message: "Unauthorized" });

  const roomId = req.params.roomId;
  const input = req.body as AvailabilityInput;

  try {
    const avail = await prisma.room_availability.create({
      data: {
        room_id: roomId,
        day_of_week: input.day_of_week,
        open_time: input.open_time,
        close_time: input.close_time,
      },
    });
    res.status(201).json({ availability: avail });
  } catch (err) {
    console.error("addRoomAvailability error", err);
    res.status(500).json({ message: "Server error" });
  }
};
