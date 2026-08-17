import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import GalleryImage, { HOME_CEREMONY_ALBUM_KEY } from "@/models/GalleryImage";
import { normalizeUpdateGalleryImage, serializeGalleryImage } from "@/lib/home-gallery";
import { deleteGalleryImageFromR2 } from "@/lib/home-gallery-r2-upload";
import { requireHomeGalleryAdmin } from "@/lib/home-gallery-auth";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const gate = await requireHomeGalleryAdmin();
  if (!gate.ok) return gate.response;

  const id = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const patch = normalizeUpdateGalleryImage(body);

    await connectDB();
    const doc = await GalleryImage.findById(id);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Only one image is the featured/cover image at a time (same single-active-flag
    // pattern already used for AcademicYear.isCurrent).
    if (patch.isCover === true) {
      await GalleryImage.updateMany(
        { albumKey: HOME_CEREMONY_ALBUM_KEY, _id: { $ne: doc._id } },
        { $set: { isCover: false } }
      );
    }

    Object.assign(doc, patch);
    await doc.save();

    return NextResponse.json({ ok: true, item: serializeGalleryImage(doc.toObject()) });
  } catch (error) {
    console.error("[PATCH /api/admin/home-gallery/[id]]", error);
    return jsonInternalServerError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const gate = await requireHomeGalleryAdmin();
  if (!gate.ok) return gate.response;

  const id = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await connectDB();
    const doc = await GalleryImage.findById(id).select("objectKey").lean();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Delete the R2 object first: if this fails, nothing is removed (fail closed — the
    // image keeps working, admin can retry) instead of orphaning the Mongo record.
    try {
      await deleteGalleryImageFromR2(doc.objectKey);
    } catch (r2Error) {
      console.error("[DELETE /api/admin/home-gallery/[id]] R2 delete failed", r2Error);
      return NextResponse.json(
        { error: "Failed to delete the stored image; nothing was removed" },
        { status: 502 }
      );
    }

    try {
      const deleted = await GalleryImage.findByIdAndDelete(id);
      if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    } catch (dbError) {
      // The R2 object is already gone at this point — do not silently report success.
      console.error(
        "[DELETE /api/admin/home-gallery/[id]] R2 object removed but metadata delete failed",
        dbError
      );
      return NextResponse.json(
        {
          error:
            "Image was removed from storage but its record could not be deleted — retry to clear it",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/admin/home-gallery/[id]]", error);
    return jsonInternalServerError(error);
  }
}
