import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniEventRsvp from "@/models/AlumniEventRsvp";
import AlumniReunionEvent from "@/models/AlumniReunionEvent";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { sanitizeMongoShape } from "@/lib/sanitize-input";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;
  try {
    const { eventId } = await params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const status = String(body.status || "going");
    if (!["going", "maybe", "declined"].includes(status)) {
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
    }

    await connectDB();
    const eid = new mongoose.Types.ObjectId(eventId);
    const uid = new mongoose.Types.ObjectId(gate.userId);

    const ev = await AlumniReunionEvent.findById(eid).select("published expiresAt").lean();
    if (!ev || !(ev as any).published) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    await AlumniEventRsvp.findOneAndUpdate(
      { eventId: eid, userId: uid },
      { $set: { status } },
      { upsert: true, new: true }
    );

    const count = await AlumniEventRsvp.countDocuments({ eventId: eid, status: "going" });
    await AlumniReunionEvent.updateOne({ _id: eid }, { $set: { rsvpCount: count } });

    return NextResponse.json({ ok: true, rsvpCount: count });
  } catch (error) {
    console.error("[POST /api/alumni/events/[eventId]/rsvp]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
