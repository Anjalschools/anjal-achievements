import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import AlumniVerificationRequest, {
  type AlumniVerificationDocType,
  type AlumniVerificationLevel,
} from "@/models/AlumniVerificationRequest";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { runVerificationAiAssist } from "@/lib/alumni/verification/ai-assist";

export const dynamic = "force-dynamic";

const LEVELS: AlumniVerificationLevel[] = ["basic", "academic", "career", "institution", "global"];
const DOC_TYPES: AlumniVerificationDocType[] = [
  "certificate",
  "student_id",
  "university_email",
  "linkedin",
  "employment_letter",
  "other",
];

const isHttpsUrl = (u: string) => /^https:\/\//i.test(u.trim());

export async function POST(request: NextRequest) {
  const gate = await requireAlumniUser(request);
  if (!gate.ok) return gate.response;

  if (!(await checkRouteRateLimit(request, "/api/alumni/verification/request"))) {
    return rateLimitExceededResponse();
  }

  try {
    await connectDB();
    const body = (await request.json()) as {
      requestedLevel?: string;
      attachments?: Array<{ type?: string; url?: string; publicId?: string; label?: string }>;
    };

    const requestedLevel = body.requestedLevel as AlumniVerificationLevel;
    if (!LEVELS.includes(requestedLevel)) {
      return NextResponse.json({ error: "invalid_level" }, { status: 400 });
    }

    const raw = Array.isArray(body.attachments) ? body.attachments : [];
    if (raw.length < 1 || raw.length > 12) {
      return NextResponse.json({ error: "attachments_count" }, { status: 400 });
    }

    const attachments = raw.map((a) => ({
      type: a.type as AlumniVerificationDocType,
      url: String(a.url || "").trim(),
      publicId: a.publicId ? String(a.publicId).trim().slice(0, 500) : undefined,
      label: a.label ? String(a.label).trim().slice(0, 200) : undefined,
    }));

    for (const att of attachments) {
      if (!DOC_TYPES.includes(att.type)) {
        return NextResponse.json({ error: "invalid_attachment_type" }, { status: 400 });
      }
      if (!att.url || att.url.length > 2000 || !isHttpsUrl(att.url)) {
        return NextResponse.json({ error: "invalid_attachment_url" }, { status: 400 });
      }
    }

    const pending = await AlumniVerificationRequest.findOne({
      userId: new mongoose.Types.ObjectId(gate.userId),
      status: "pending",
    })
      .select("_id")
      .lean();
    if (pending) {
      return NextResponse.json({ error: "pending_exists" }, { status: 409 });
    }

    const user = await User.findById(gate.userId).select("fullName").lean();
    const fullName = String(user?.fullName || "");

    const ai = await runVerificationAiAssist({ fullName, attachments });

    const doc = await AlumniVerificationRequest.create({
      userId: new mongoose.Types.ObjectId(gate.userId),
      requestedLevel,
      status: "pending",
      attachments,
      aiValidationScore: ai.score,
      aiNotes: ai.notes,
    });

    return NextResponse.json({
      ok: true,
      id: doc._id.toString(),
      aiValidationScore: ai.score,
    });
  } catch (e) {
    console.error("[POST /api/alumni/verification/request]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
