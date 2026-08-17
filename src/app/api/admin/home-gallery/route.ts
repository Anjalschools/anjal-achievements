import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import GalleryImage, { HOME_CEREMONY_ALBUM_KEY } from "@/models/GalleryImage";
import { isAllowedGalleryImageMime, normalizeGalleryImageMetadata, serializeGalleryImage } from "@/lib/home-gallery";
import { uploadGalleryImageBufferToR2 } from "@/lib/home-gallery-r2-upload";
import { requireHomeGalleryAdmin } from "@/lib/home-gallery-auth";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { isR2Configured } from "@/lib/r2";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function GET() {
  const gate = await requireHomeGalleryAdmin();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const rows = await GalleryImage.find({ albumKey: HOME_CEREMONY_ALBUM_KEY })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    return NextResponse.json({ ok: true, items: rows.map(serializeGalleryImage) });
  } catch (error) {
    console.error("[GET /api/admin/home-gallery]", error);
    return jsonInternalServerError(error);
  }
}

/** Accepts multipart/form-data: a `file` field plus optional titleAr/titleEn/altAr/altEn/displayOrder/isCover. */
export async function POST(request: NextRequest) {
  const gate = await requireHomeGalleryAdmin();
  if (!gate.ok) return gate.response;

  if (!isR2Configured()) {
    return NextResponse.json({ error: "Gallery image storage is not configured" }, { status: 503 });
  }

  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Image must be 10MB or smaller" }, { status: 400 });
    }
    const mimeType = (file.type || "").trim().toLowerCase();
    if (!isAllowedGalleryImageMime(mimeType)) {
      return NextResponse.json({ error: "File type not allowed — use JPEG, PNG, or WebP" }, { status: 400 });
    }

    const metadata = normalizeGalleryImageMetadata({
      titleAr: formData.get("titleAr"),
      titleEn: formData.get("titleEn"),
      altAr: formData.get("altAr"),
      altEn: formData.get("altEn"),
      displayOrder: formData.get("displayOrder"),
      isCover: formData.get("isCover"),
    });

    await connectDB();

    let displayOrder = metadata.displayOrder;
    if (!displayOrder) {
      const last = await GalleryImage.findOne({ albumKey: HOME_CEREMONY_ALBUM_KEY })
        .sort({ displayOrder: -1 })
        .select("displayOrder")
        .lean();
      displayOrder = (last?.displayOrder || 0) + 1;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { key, url } = await uploadGalleryImageBufferToR2({
      albumKey: HOME_CEREMONY_ALBUM_KEY,
      buffer,
      fileName: file.name || "gallery.jpg",
      mimeType,
    });

    if (metadata.isCover) {
      await GalleryImage.updateMany(
        { albumKey: HOME_CEREMONY_ALBUM_KEY },
        { $set: { isCover: false } }
      );
    }

    const created = await GalleryImage.create({
      albumKey: HOME_CEREMONY_ALBUM_KEY,
      imageUrl: url,
      objectKey: key,
      titleAr: metadata.titleAr,
      titleEn: metadata.titleEn,
      altAr: metadata.altAr,
      altEn: metadata.altEn,
      displayOrder,
      isCover: metadata.isCover,
      isActive: true,
    });

    return NextResponse.json({ ok: true, item: serializeGalleryImage(created.toObject()) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("[R2]")) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("[POST /api/admin/home-gallery]", error);
    return jsonInternalServerError(error);
  }
}
