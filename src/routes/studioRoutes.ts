// src/routes/studioRoutes.ts
import { Router } from "express";
import multer from "multer";

import {
  createStudio,
  listStudios,
  getStudio,
  updateStudio,
  deleteStudio,
  createRoom,
  listRooms,
  getRoom,
  updateRoom,
  deleteRoom,
  addStudioAvailability,
  addRoomAvailability,
} from "../controllers/studioController";

import { authMiddleware } from "../middleware/authMiddleware";
import { authorize } from "../middleware/authorize";
import { requireStudioRole } from "../middleware/requireStudioRole";

const upload = multer();
const router = Router();

/* -----------------------------------------------------
 *                   PUBLIC ROUTES FOR STUDIOS
 * --------------------------------------------------- */

router.get("/", listStudios);
router.get("/:id", getStudio);

/* -----------------------------------------------------
 *                  STUDIO CRUD
 * --------------------------------------------------- */

// Create studio (Admin or Studio Owner)
router.post(
  "/",
  authMiddleware,
  authorize(["admin", "studio_owner"]),
  upload.array("photos"),
  createStudio
);

// Update studio (Only the studio owner)
router.patch(
  "/:id",
  authMiddleware,
  requireStudioRole("id", ["studio_owner"]),
  upload.array("photos"),
  updateStudio
);

// Delete studio (Only the studio owner)
router.delete(
  "/:id",
  authMiddleware,
  requireStudioRole("id", ["studio_owner"]),
  deleteStudio
);

/* -----------------------------------------------------
 *                   ROOMS (SCOPED TO STUDIO)
 * --------------------------------------------------- */

// List rooms for a studio
router.get("/:studioId/rooms", listRooms);

// Create a room (studio manager, staff, or owner)
router.post(
  "/:studioId/rooms",
  authMiddleware,
  requireStudioRole("studioId", ["studio_owner", "studio_manager", "studio_staff"]),
  createRoom
);

/* -----------------------------------------------------
 *                     ROOM CRUD
 * --------------------------------------------------- */

// Get a room
router.get("/rooms/:roomId", getRoom);

// Update a room
router.patch(
  "/rooms/:roomId",
  authMiddleware,
  requireStudioRole("roomId", ["studio_owner", "studio_manager", "studio_staff"]),
  updateRoom
);

// Delete a room
router.delete(
  "/rooms/:roomId",
  authMiddleware,
  requireStudioRole("roomId", ["studio_owner", "studio_manager", "studio_staff"]),
  deleteRoom
);

/* -----------------------------------------------------
 *                  AVAILABILITY
 * --------------------------------------------------- */

// Set studio availability
router.post(
  "/:studioId/availability",
  authMiddleware,
  requireStudioRole("studioId", ["studio_owner", "studio_manager", "studio_staff"]),
  addStudioAvailability
);

// Set room availability
router.post(
  "/rooms/:roomId/availability",
  authMiddleware,
  requireStudioRole("roomId", ["studio_owner", "studio_manager", "studio_staff"]),
  addRoomAvailability
);

export default router;
