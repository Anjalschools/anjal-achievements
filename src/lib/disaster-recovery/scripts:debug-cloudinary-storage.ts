import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";

async function main() {
  await connectDB();

  const docs = await Achievement.find({
    $or: [
      { mediaStorageProvider: "cloudinary" },
      { "attachments.storageProvider": "cloudinary" },
    ],
  })
    .limit(5)
    .lean();

  console.dir(docs, {
    depth: null,
    colors: true,
  });

  process.exit(0);
}

main().catch(console.error);