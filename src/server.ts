// server.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import router from "./routes"; // your main router

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// Root route - for health check
app.get("/", (req, res) => {
  res.send("🚀 Tizii backend is running!");
});

// Mount all API routes under /api
app.use("/api", router);

// Catch-all route for undefined endpoints
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Tizii backend running on port ${PORT}`);
});
