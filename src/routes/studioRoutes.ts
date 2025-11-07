import express from "express";
import {
  getStudios,
  createStudio,
  getStudioById,
  deleteStudio,
  updateStudio,
  createStudioManager, // <-- added
} from "../controllers/studioController";
import { authMiddleware } from "../middleware/authMiddleware";
import { authorize } from "../middleware/authorize";
import type { RequestHandler } from "express";

const router = express.Router();

// Public routes
router.get("/", getStudios as unknown as RequestHandler);
router.get("/:id", getStudioById as unknown as RequestHandler);

// Admin-only route: create a new studio manager
// POST /api/studios/managers
router.post(
  "/managers",
  authMiddleware,
  authorize("admin"),
  createStudioManager as unknown as RequestHandler
);

// Protected routes (RBAC) for studios
router.post(
  "/",
  authMiddleware,
  authorize("studio_manager", "admin"),
  createStudio as unknown as RequestHandler
);

router.put(
  "/:id",
  authMiddleware,
  authorize("studio_manager", "admin"),
  updateStudio as unknown as RequestHandler
);

router.delete(
  "/:id",
  authMiddleware,
  authorize("studio_manager", "admin"),
  deleteStudio as unknown as RequestHandler
);

export default router;
