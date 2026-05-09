import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniMentorshipRequest from "@/models/AlumniMentorshipRequest";
import { requireSessionUser } from "@/lib/alumni/require-alumni";
import { requireAlumniCommunityForAuthedUser } from "@/lib/alumni/require-alumni-community-access";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const gate = await requireSessionUser();
  if (!gate.ok) return gate.response;
  const denied = requireAlumniCommunityForAuthedUser(gate.user);
  if (denied) return denied;
  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }
    await connectDB();
    const uid = String(gate.user._id);
    const row = await AlumniMentorshipRequest.findById(id).select("requesterId mentorId status").lean();
    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const isRequester = String((row as any).requesterId) === uid;
    const isMentor = String((row as any).mentorId) === uid;
    if (!isRequester && !isMentor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const status = String(body.status || "");

    const update: Record<string, unknown> = {};

    if (isMentor && ["accepted", "rejected"].includes(status)) {
      update.status = status;
      if (body.notes !== undefined) update.notes = sanitizeUserText(String(body.notes || ""));
      if (body.meetingLink !== undefined) update.meetingLink = sanitizeUserText(String(body.meetingLink || ""));
      if (body.scheduledAt !== undefined) {
        update.scheduledAt = body.scheduledAt ? new Date(String(body.scheduledAt)) : null;
      }
    }

    if (isRequester && status === "cancelled") {
      update.status = "cancelled";
    }

    if (isMentor && status === "completed") {
      update.status = "completed";
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
    }

    await AlumniMentorshipRequest.updateOne({ _id: id }, { $set: update });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/alumni/mentorship-requests/[id]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
