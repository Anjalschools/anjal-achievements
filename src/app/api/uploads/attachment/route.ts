import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getCurrentDbUser } from "@/lib/auth";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  buildAchievementAttachmentR2Key,
  buildR2PublicObjectUrl,
  getR2BucketName,
  getR2Client,
  isR2Configured,
} from "@/lib/r2";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

const OFFICE_MIMES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const isAllowedAttachmentMime = (mime: string): boolean => {
  const m = mime.trim().toLowerCase();
  if (!m) return false;
  if (m === "application/pdf" || m === "application/x-pdf") return true;
  if (m.startsWith("image/")) return true;
  if (m.startsWith("text/")) return true;
  return OFFICE_MIMES.has(m);
};

const inferMimeFromFileName = (name: string): string => {
  const lower = name.trim().toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "";
};

type OkBody = {
  ok: true;
  url: string;
  key: string;
  fileName: string;
  mimeType: string;
  size: number;
  provider: "r2";
};

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized - Please login" }, { status: 401 });
    }

    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "Attachment upload is not configured on the server" },
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

    const size = file.size;
    if (size <= 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    if (size > MAX_BYTES) {
      return NextResponse.json({ error: "Attachment must be 10MB or smaller" }, { status: 400 });
    }

    const originalName = (file.name || "attachment").trim().slice(0, 240) || "attachment";
    let mimeType = (file.type || "").trim().toLowerCase();
    if (!mimeType || mimeType === "application/octet-stream") {
      mimeType = inferMimeFromFileName(originalName);
    }
    if (!isAllowedAttachmentMime(mimeType)) {
      return NextResponse.json(
        { error: "File type not allowed for evidence attachments" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = buildAchievementAttachmentR2Key(originalName);
    const bucket = getR2BucketName();
    const s3 = getR2Client();

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const url = buildR2PublicObjectUrl(key);
    const body: OkBody = {
      ok: true,
      url,
      key,
      fileName: originalName,
      mimeType,
      size,
      provider: "r2",
    };

    return NextResponse.json(body);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("[R2]")) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("uploads/attachment:", error);
    return jsonInternalServerError(error);
  }
}
