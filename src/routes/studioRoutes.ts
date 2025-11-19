import { Router } from "express";
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
import { PlatformRole } from "../types/auth";
import multer from "multer";
const upload = multer();

const router = Router();

// public
router.get("/", listStudios);
router.get("/:id", getStudio);

// create studio
router.post(
  "/",
  authMiddleware,
  authorize(["admin", "studio_owner"]),
  upload.array("photos"), // for multiple photo uploads
  createStudio
);

// update/delete (owner or admin) - protect with requireStudioRole or authorize+custom check
router.patch("/:id", authMiddleware, requireStudioRole("id", ["studio_owner"]), updateStudio);
router.delete("/:id", authMiddleware, requireStudioRole("id", ["studio_owner"]), deleteStudio);

// Rooms (studio scoped)
router.get("/:studioId/rooms", listRooms);
router.post(
  "/:studioId/rooms",
  authMiddleware,
  // require the user to be owner/manager/staff on the studio
  requireStudioRole("studioId", ["studio_manager", "studio_staff"]),
  createRoom
);

// Room operations
router.get("/rooms/:roomId", getRoom);
router.patch("/rooms/:roomId", authMiddleware, requireStudioRole("studioId", ["studio_manager", "studio_staff"]), updateRoom);
router.delete("/rooms/:roomId", authMiddleware, requireStudioRole("studioId", ["studio_manager", "studio_staff"]), deleteRoom);

// Availability
router.post("/:studioId/availability", authMiddleware, requireStudioRole("studioId", ["studio_manager", "studio_staff"]), addStudioAvailability);
router.post("/rooms/:roomId/availability", authMiddleware, requireStudioRole("studioId", ["studio_manager", "studio_staff"]), addRoomAvailability);

export default router;
