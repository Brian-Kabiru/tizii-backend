// src/app.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import dotenv from "dotenv";
import routes from "./routes/index";

dotenv.config();

const app = express();

// 🔧 Middleware
app.use(helmet());
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(cookieParser());

// 🔗 Routes
app.use("/api", routes);

// Health check route
app.get("/api/health", (_, res) => {
  res.status(200).json({ status: "ok" });
});

export default app;
