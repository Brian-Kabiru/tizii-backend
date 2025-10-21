// src/routes/index.ts
import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.send("Welcome to Tizii API 🌍");
});

// Example placeholder route
router.get("/users", (req, res) => {
  res.json({ message: "List of users will appear here soon" });
});

export default router;
