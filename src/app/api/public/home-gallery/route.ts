import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import GalleryImage, { HOME_CEREMONY_ALBUM_KEY } from "@/models/GalleryImage";
import { serializeGalleryImage } from "@/lib/home-gallery";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const JSON_HEADERS = {
  headers: {
    "Cache-Control": "no-store, max-age=0",
  },
};

/** Public (no auth): active ceremony gallery images, ordered for display. */
export async function GET() {
  try {
    await connectDB();
    const rows = await GalleryImage.find({ albumKey: HOME_CEREMONY_ALBUM_KEY, isActive: true })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    return NextResponse.json({ ok: true, items: rows.map(serializeGalleryImage) }, JSON_HEADERS);
  } catch (error) {
    console.error("[GET /api/public/home-gallery]", error);
    return NextResponse.json({ ok: true, items: [] }, JSON_HEADERS);
  }
}
