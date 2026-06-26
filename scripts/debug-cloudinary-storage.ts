import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

console.log("Mongo URI loaded:", !!process.env.MONGODB_URI);

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("Cloudinary Config:", cloudinary.config());

console.log({
  cloud: process.env.CLOUDINARY_CLOUD_NAME,
  key: !!process.env.CLOUDINARY_API_KEY,
  secret: !!process.env.CLOUDINARY_API_SECRET,
});

import connectDB from "../src/lib/mongodb";
import Achievement from "../src/models/Achievement";

async function main() {
  await connectDB();

  const docs = await Achievement.find({})
    .select("achievementName image imagePublicId attachments")
    .limit(20)
    .lean();

  for (const [index, doc] of docs.entries()) {
    console.log("\n========================");
    console.log("Document", index + 1);
    console.log("_id:", doc._id);
    console.log("achievement:", doc.achievementName);
    console.log("image:", doc.image);
    console.log("imagePublicId:", doc.imagePublicId);
    console.dir(doc.attachments, { depth: null });

    if (!doc.imagePublicId) {
      continue;
    }

    try {
      const result = await cloudinary.api.resource(doc.imagePublicId);

      console.log("✓ EXISTS");
      console.log("Resource Type:", result.resource_type);
      console.log("Format:", result.format);
      console.log("Version:", result.version);
      console.log("Secure URL:", result.secure_url);
    } catch (e: any) {
      console.log("✗ NOT FOUND");
      console.log("Public ID:", doc.imagePublicId);
      console.log("HTTP Code:", e?.http_code);
      console.log("Message:", e?.message);
      console.log("API Error:", e?.error);
      console.dir(e, { depth: null });
    }
  }

  process.exit(0);
}

main().catch(console.error);