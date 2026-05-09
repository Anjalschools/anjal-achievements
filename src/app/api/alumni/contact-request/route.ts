import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniContactRequest from "@/models/AlumniContactRequest";
import { getCurrentDbUser } from "@/lib/auth";
import type { AuthedUser } from "@/lib/auth-guard";
import { requireAlumniCommunityForAuthedUser } from "@/lib/alumni/require-alumni-community-access";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    if (!(await checkRouteRateLimit(request, "/api/alumni/contact-request"))) {
      return rateLimitExceededResponse();
    }
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const requesterName = sanitizeUserText(String(body.requesterName || ""));
    const requesterEmail = String(body.requesterEmail || "").trim().toLowerCase();
    const message = sanitizeUserText(String(body.message || ""));
    const targetType = String(body.targetType || "");
    const targetId = sanitizeUserText(String(body.targetId || ""));

    if (!requesterName || !requesterEmail || !targetId || (targetType !== "mentor" && targetType !== "opportunity")) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }
    if (!EMAIL_RE.test(requesterEmail)) {
      return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
    }

    const currentUser = await getCurrentDbUser();
    if (currentUser?._id) {
      const denied = requireAlumniCommunityForAuthedUser(currentUser as AuthedUser);
      if (denied) return denied;
    }

    await connectDB();
    await AlumniContactRequest.create({
      requesterUserId:
        currentUser?._id && mongoose.Types.ObjectId.isValid(String(currentUser._id))
          ? new mongoose.Types.ObjectId(String(currentUser._id))
          : undefined,
      requesterName,
      requesterEmail,
      message: message || undefined,
      targetType,
      targetId,
      status: "new",
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/alumni/contact-request]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
