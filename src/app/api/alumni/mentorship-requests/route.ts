import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import AlumniMentorshipRequest from "@/models/AlumniMentorshipRequest";
import { requireSessionUser } from "@/lib/alumni/require-alumni";
import { requireAlumniCommunityForAuthedUser } from "@/lib/alumni/require-alumni-community-access";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";

export const dynamic = "force-dynamic";

const mentorOffersMentoring = async (mentorId: mongoose.Types.ObjectId): Promise<boolean> => {
  const u = await User.findById(mentorId).select("accountType alumniProfile.alumniServices.mentoring").lean();
  if (!u) return false;
  const at = String((u as any).accountType || "");
  const mentoring = (u as any)?.alumniProfile?.alumniServices?.mentoring === true;
  return at === "alumni" && mentoring;
};

export async function GET() {
  const gate = await requireSessionUser();
  if (!gate.ok) return gate.response;
  const denied = requireAlumniCommunityForAuthedUser(gate.user);
  if (denied) return denied;
  try {
    await connectDB();
    const uid = new mongoose.Types.ObjectId(String(gate.user._id));
    const rows = await AlumniMentorshipRequest.find({
      $or: [{ requesterId: uid }, { mentorId: uid }],
    })
      .sort({ updatedAt: -1 })
      .limit(60)
      .select("requesterId mentorId category message status scheduledAt meetingLink updatedAt createdAt")
      .lean();

    return NextResponse.json({
      ok: true,
      items: rows.map((row: any) => ({
        id: row._id.toString(),
        requesterId: row.requesterId?.toString?.() || "",
        mentorId: row.mentorId?.toString?.() || "",
        category: row.category || "",
        message: row.message || "",
        status: row.status || "pending",
        scheduledAt: row.scheduledAt ? new Date(row.scheduledAt).toISOString() : null,
        meetingLink: row.meetingLink || "",
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      })),
    });
  } catch (error) {
    console.error("[GET /api/alumni/mentorship-requests]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireSessionUser();
  if (!gate.ok) return gate.response;
  const denied = requireAlumniCommunityForAuthedUser(gate.user);
  if (denied) return denied;
  try {
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const mentorIdRaw = String(body.mentorId || "");
    const category = sanitizeUserText(String(body.category || "general"));
    const message = sanitizeUserText(String(body.message || ""));
    if (!mongoose.Types.ObjectId.isValid(mentorIdRaw) || !message) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }
    const mentorId = new mongoose.Types.ObjectId(mentorIdRaw);
    const requesterId = new mongoose.Types.ObjectId(String(gate.user._id));
    if (requesterId.equals(mentorId)) {
      return NextResponse.json({ error: "SELF_MENTOR" }, { status: 400 });
    }

    await connectDB();
    const okMentor = await mentorOffersMentoring(mentorId);
    if (!okMentor) return NextResponse.json({ error: "MENTOR_UNAVAILABLE" }, { status: 400 });

    const row = await AlumniMentorshipRequest.create({
      requesterId,
      mentorId,
      category,
      message,
      status: "pending",
    });

    return NextResponse.json({ ok: true, id: row._id.toString() }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/alumni/mentorship-requests]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
