/**
 * One-off migration: set `status` / `isFeatured` from legacy `approved` / `featured`.
 * Run: node scripts/backfill-achievement-status.mjs
 * Requires MONGODB_URI (see .env.local).
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;
if (!uri) {
  console.error("Set MONGODB_URI or DATABASE_URL");
  process.exit(1);
}

await mongoose.connect(uri);
const col = mongoose.connection.collection("achievements");

let n = 0;
const cursor = col.find({});
for await (const doc of cursor) {
  const status = doc.approved === true ? "approved" : "pending";
  const isFeatured = doc.approved === true && doc.featured === true;
  if (doc.status === status && doc.isFeatured === isFeatured) continue;
  await col.updateOne({ _id: doc._id }, { $set: { status, isFeatured } });
  n += 1;
}

console.log("Updated documents:", n);
await mongoose.disconnect();
