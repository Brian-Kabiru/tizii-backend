// scripts/seed-user.ts
import dotenv from "dotenv";
import { pool } from "../src/db/index";
import bcrypt from "bcrypt";

dotenv.config();

async function seedUser() {
  try {
    const hashedPassword = await bcrypt.hash("password123", 10);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password, role, verified)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      ["Test Artist", "artist@example.com", hashedPassword, "artist", true]
    );

    console.log("✅ User seeded:", result.rows[0]);
  } catch (error) {
    console.error("❌ Error seeding user:", error);
  } finally {
    await pool.end();
  }
}

seedUser();
