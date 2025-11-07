import { Request, Response } from "express";
import prisma from "../prisma/client";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * 🟢 Get all studios (Public)
 */
export const getStudios = async (req: Request, res: Response) => {
  try {
    const studios = await prisma.studios.findMany({
      include: {
        users: {
          select: { id: true, full_name: true, email: true },
        },
      },
    });
    res.json(studios);
  } catch (error) {
    console.error("Error fetching studios:", error);
    res.status(500).json({ error: "Failed to fetch studios" });
  }
};

/**
 * 🧾 Get a single studio by ID (Public)
 */
export const getStudioById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const studio = await prisma.studios.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, full_name: true, email: true } },
      },
    });

    if (!studio) {
      return res.status(404).json({ error: "Studio not found" });
    }

    res.json(studio);
  } catch (error) {
    console.error("Error fetching studio:", error);
    res.status(500).json({ error: "Failed to fetch studio" });
  }
};

/**
 * 🏗️ Create a new studio (Studio Manager or Admin)
 */
export const createStudio = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, location, capacity, price_per_hour, amenities } = req.body;

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Only Admin or Studio Manager can create
    if (!["studio_manager", "admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: Access denied" });
    }

    // Assign ownership
    const ownerId = req.user.role === "admin" && req.body.owner_id
      ? req.body.owner_id
      : req.user.id;

    const studio = await prisma.studios.create({
      data: {
        name,
        description,
        location,
        capacity,
        price_per_hour,
        amenities,
        owner_id: ownerId,
      },
    });

    res.status(201).json(studio);
  } catch (error) {
    console.error("Error creating studio:", error);
    res.status(500).json({ error: "Failed to create studio" });
  }
};

/**
 * ✏️ Update a studio (Owner or Admin)
 */
export const updateStudio = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const studio = await prisma.studios.findUnique({ where: { id } });
    if (!studio) return res.status(404).json({ error: "Studio not found" });

    // Allow only the owner or admin to edit
    if (req.user.role !== "admin" && studio.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden: Not your studio" });
    }

    const updatedStudio = await prisma.studios.update({
      where: { id },
      data: req.body,
    });

    res.json(updatedStudio);
  } catch (error) {
    console.error("Error updating studio:", error);
    res.status(500).json({ error: "Failed to update studio" });
  }
};

/**
 * ❌ Delete a studio (Owner or Admin)
 */
export const deleteStudio = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const studio = await prisma.studios.findUnique({ where: { id } });
    if (!studio) return res.status(404).json({ error: "Studio not found" });

    // Allow only owner or admin
    if (req.user.role !== "admin" && studio.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden: Not your studio" });
    }

    await prisma.studios.delete({ where: { id } });
    res.json({ message: "Studio deleted successfully" });
  } catch (error) {
    console.error("Error deleting studio:", error);
    res.status(500).json({ error: "Failed to delete studio" });
  }
};
/**
 * 🧑‍💼 Create a Studio Manager (Admin only)
 */
export const createStudioManager = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Only Admin can create Studio Managers
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Only admins can create studio managers" });
    }

    const { full_name, email, phone, password, studio_id } = req.body;

    // Validate required fields
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: "Full name, email, and password are required" });
    }

    // Check if user exists
    const existingUser = await prisma.users.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: "A user with this email already exists" });
    }

    // Optional: validate studio ID
    if (studio_id) {
      const studio = await prisma.studios.findUnique({ where: { id: studio_id } });
      if (!studio) {
        return res.status(404).json({ error: "Studio not found" });
      }
    }

    // Hash password
    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with role studio_manager
    const newManager = await prisma.users.create({
      data: {
        full_name,
        email,
        phone,
        password_hash: hashedPassword,
        role: "studio_manager",
      },
      select: {
        id: true,
        full_name: true,
        email: true,
        phone: true,
        role: true,
        created_at: true,
      },
    });

    // Optionally assign the manager as the studio owner (optional)
    if (studio_id) {
      await prisma.studios.update({
        where: { id: studio_id },
        data: { owner_id: newManager.id },
      });
    }

    res.status(201).json({
      message: "Studio manager created successfully",
      user: newManager,
    });
  } catch (error) {
    console.error("Error creating studio manager:", error);
    res.status(500).json({ error: "Failed to create studio manager" });
  }
};
