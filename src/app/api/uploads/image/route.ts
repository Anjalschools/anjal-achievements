import { NextRequest, NextResponse } from "next/server";
import { getCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";
import { getCurrentDbUser } from "@/lib/auth";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const FOLDER = "achievements/images";

type UploadOkBody = {
  ok: true;
  url: string;
  publicId: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
  originalFilename: string;
};

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized - Please login" }, { status: 401 });
    }

    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        { error: "Image upload is not configured on the server" },
        { status: 503 }
      );
    }

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

    const mime = (file.type || "").trim().toLowerCase();
    if (!mime.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image (mime must start with image/)" },
        { status: 400 }
      );
    }

    const size = file.size;
    if (size <= 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    if (size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image must be 5MB or smaller" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const cloudinary = getCloudinary();

    const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: FOLDER,
      resource_type: "image",
      use_filename: true,
      unique_filename: true,
    });

    const originalFilename =
      (typeof result.original_filename === "string" && result.original_filename.trim()
        ? result.original_filename
        : file.name) || "image";

    const body: UploadOkBody = {
      ok: true,
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width ?? 0,
      height: result.height ?? 0,
      bytes: result.bytes ?? size,
      format: result.format ?? "",
      originalFilename,
    };

    return NextResponse.json(body);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("[Cloudinary]")) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("uploads/image:", error);
    return jsonInternalServerError(error);
  }
}
