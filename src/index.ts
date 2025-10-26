import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import { authMiddleware } from "./middleware/authMiddleware";
import studioRoutes from "./routes/studioRoutes";
import bookingRoutes from "./routes/bookingRoutes";
import paymentRoutes from "./routes/paymentRoutes";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Auth routes
app.use("/auth", authRoutes);

// Studio routes
app.use("/studios", studioRoutes);
// booking routes...
app.use("/bookings", bookingRoutes);
// payment routes...
app.use("/api/payments", paymentRoutes);
// Example protected route
app.get("/me", authMiddleware, (req: any, res) => {
  res.json({ message: "Authenticated", user: req.user });
});

app.get("/", (req, res) => {
  res.send("Tizii API is running 🚀");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
