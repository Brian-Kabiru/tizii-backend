import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

dotenv.config();

const prisma = new PrismaClient();

async function seedAdmin() {
  try {
    const existing = await prisma.users.findUnique({
      where: { email: "admin@example.com" },
    });

    if (existing) {
      console.log("⚠️ Admin already exists:", existing.email);
      return;
    }

    const hashedPassword = await bcrypt.hash("admin123", 10);

    const admin = await prisma.users.create({
      data: {
        full_name: "Test Admin",
        email: "admin@example.com",
        password_hash: hashedPassword,
        platform_role: "admin",
        verified: true,
      },
    });

    console.log("✅ Admin seeded:", admin);
  } catch (error) {
    console.error("❌ Error seeding admin:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();
