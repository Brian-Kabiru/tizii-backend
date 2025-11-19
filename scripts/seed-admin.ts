// scripts/seed-admin.ts
import dotenv from "dotenv";
import { pool } from "../src/db/index";
import bcrypt from "bcrypt";

dotenv.config();

async function seedAdmin() {
  try {
    const hashedPassword = await bcrypt.hash("admin123", 10);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, platform_role, verified)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      ["Test Admin", "admin@example.com", hashedPassword, "admin", true]
    );

    console.log("✅ Admin seeded:", result.rows[0]);
  } catch (error) {
    console.error("❌ Error seeding admin:", error);
  } finally {
    await pool.end();
  }
}

seedAdmin();
