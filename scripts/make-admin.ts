/**
 * Promote an existing user to admin or create the bootstrap admin account.
 * Uses the same DB name as src/lib/mongodb.ts (anjal_achievements).
 *
 * Lookup: username "Admin" (case-insensitive) OR email admin@anjal.local
 * Update (if found): role = admin, status = active (password unchanged)
 * Create (if not found): full admin user with hashed password
 *
 * Run: npm run make-admin
 * Requires: MONGODB_URI in .env.local or .env
 */

import path from "path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../src/models/User";

const USERNAME = "Admin";
const PASSWORD = "Hhh159951";
/** Used for lookup when creating; must satisfy User schema email validation */
const EMAIL = "admin@anjal.local";
const STUDENT_ID = "9000000001";
const FULL_NAME = "System Admin";
const BCRYPT_ROUNDS = 10;

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri || typeof uri !== "string") {
    console.error("Error: MONGODB_URI is not set. Add it to .env.local or .env");
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: "anjal_achievements" });

  const emailLower = EMAIL.toLowerCase();
  const usernameRx = new RegExp(`^${escapeRegex(USERNAME)}$`, "i");

  let doc = await User.findOne({
    $or: [{ username: usernameRx }, { email: emailLower }],
  });

  if (doc) {
    doc.set("role", "admin");
    doc.set("status", "active");
    doc.set("username", USERNAME);
    await doc.save();
    console.log(`Updated user "${doc.email}" (${String(doc._id)}) → role=admin, status=active.`);
  } else {
    const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);

    const emailTaken = await User.findOne({ email: emailLower });
    if (emailTaken) {
      console.error(
        "Error: Email admin@anjal.local is already used by another account. Resolve manually or adjust EMAIL in this script."
      );
      await mongoose.disconnect();
      process.exit(1);
    }

    const sidTaken = await User.findOne({ studentId: STUDENT_ID });
    if (sidTaken) {
      console.error(
        `Error: Student ID ${STUDENT_ID} is already in use. Free it or change STUDENT_ID in this script.`
      );
      await mongoose.disconnect();
      process.exit(1);
    }

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
    console.log(`Created admin user username="${USERNAME}" email="${emailLower}".`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("make-admin failed:", e instanceof Error ? e.message : e);
  void mongoose.disconnect();
  process.exit(1);
});
