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

// FIX: No Multer typings from Express, no global Express namespace references
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

router.post(
  "/",
  authMiddleware,
  authorize(["admin", "studio_owner"]),
  upload.array("photos"), // FIX: No type annotation
  createStudio
);

router.patch(
  "/:id",
  authMiddleware,
  requireStudioRole("id", ["admin", "studio_owner"]),
  upload.array("photos"), // FIX: No type annotation
  updateStudio
);

router.delete(
  "/:id",
  authMiddleware,
  requireStudioRole("id", ["admin", "studio_owner"]),
  deleteStudio
);

/* -----------------------------------------------------
 *                   ROOMS
 * --------------------------------------------------- */

router.get("/:studioId/rooms", listRooms);

router.post(
  "/:studioId/rooms",
  authMiddleware,
  requireStudioRole("studioId", ["admin", "studio_owner", "studio_manager", "studio_staff"]),
  upload.array("photos"),
  createRoom
);

/* -----------------------------------------------------
 *                   ROOM CRUD
 * --------------------------------------------------- */

router.get("/rooms/:roomId", getRoom);

router.patch(
  "/rooms/:roomId",
  authMiddleware,
  requireStudioRole("roomId", ["admin", "studio_owner", "studio_manager", "studio_staff"]),
  upload.array("photos"),
  updateRoom
);

router.delete(
  "/rooms/:roomId",
  authMiddleware,
  requireStudioRole("roomId", ["admin", "studio_owner", "studio_manager", "studio_staff"]),
  deleteRoom
);

/* -----------------------------------------------------
 *                 AVAILABILITY
 * --------------------------------------------------- */

router.post(
  "/:studioId/availability",
  authMiddleware,
  requireStudioRole("studioId", ["studio_owner", "studio_manager", "studio_staff"]),
  addStudioAvailability
);

router.post(
  "/rooms/:roomId/availability",
  authMiddleware,
  requireStudioRole("roomId", ["studio_owner", "studio_manager", "studio_staff"]),
  addRoomAvailability
);

export default router;
