/**
 * Bootstrap platform admin user (idempotent).
 * Password hashing matches src/app/api/auth/register (bcrypt, 10 rounds).
 * DB name matches src/lib/mongodb.ts (anjal_achievements).
 *
 * Run: npm run create-admin
 * Requires: MONGODB_URI in .env.local or .env
 */

import path from "path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../src/models/User";

const USERNAME = "Admin";
const PASSWORD = "Anjal@12345";
const EMAIL = "admin@anjal.local";
/** Reserved 10-digit student ID for the bootstrap admin */
const STUDENT_ID = "9000000001";
const FULL_NAME = "System Admin";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const BCRYPT_ROUNDS = 10;

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri || typeof uri !== "string") {
    console.error("Error: MONGODB_URI is not set. Add it to .env.local or .env");
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: "anjal_achievements" });

  const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);
  const emailLower = EMAIL.toLowerCase();

  const emailTaken = await User.findOne({ email: emailLower });
  if (emailTaken && emailTaken.username !== USERNAME) {
    console.error(
      "Error: admin@anjal.local is already registered to another username. Resolve in DB manually."
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const sidTaken = await User.findOne({ studentId: STUDENT_ID });
  if (sidTaken && sidTaken.username !== USERNAME) {
    console.error(
      `Error: Student ID ${STUDENT_ID} is already in use. Resolve in DB manually.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  let doc = await User.findOne({ username: USERNAME });

  if (doc) {
    doc.set("passwordHash", passwordHash);
    doc.set("role", "admin");
    doc.set("status", "active");
    doc.set("fullName", FULL_NAME);
    doc.set("email", emailLower);
    if (!doc.studentId || doc.studentId !== STUDENT_ID) {
      const owner = await User.findOne({ studentId: STUDENT_ID });
      if (!owner || String(owner._id) === String(doc._id)) {
        doc.set("studentId", STUDENT_ID);
      }
    }
    await doc.save();
    console.log("Admin already exists — password and admin role updated successfully.");
  } else {
    await User.create({
      fullName: FULL_NAME,
      email: emailLower,
      username: USERNAME,
      studentId: STUDENT_ID,
      passwordHash,
      gender: "male",
      section: "arabic",
      grade: "g12",
      role: "admin",
      status: "active",
      preferredLanguage: "ar",
    });
    console.log("Admin created successfully.");
  }

  console.log("Login identifier: username \"Admin\" OR email \"admin@anjal.local\" (same password).");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("create-admin failed:", e instanceof Error ? e.message : e);
  void mongoose.disconnect();
  process.exit(1);
});
