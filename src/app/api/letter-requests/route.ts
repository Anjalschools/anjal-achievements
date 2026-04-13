import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LetterRequest from "@/models/LetterRequest";
import { requireStudentSession } from "@/lib/letter-request-auth";
import { parseLetterCreateBody } from "@/lib/letter-request-validation";
import { buildStudentSnapshotFromUser, appendLetterStatusHistory } from "@/lib/letter-request-service";
import { serializeLetterRequest } from "@/lib/letter-request-api-serialize";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const gate = await requireStudentSession();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseLetterCreateBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const uid = gate.user._id;
  if (!uid || !mongoose.Types.ObjectId.isValid(String(uid))) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  try {
    await connectDB();
    const snap = buildStudentSnapshotFromUser(gate.user as import("@/models/User").IUser);
    const doc = new LetterRequest({
      userId: uid,
      studentSnapshot: snap,
      requestType: parsed.data.requestType,
      language: parsed.data.language,
      targetOrganization: parsed.data.targetOrganization,
      requestBody: parsed.data.requestBody,
      requestedAuthorRole: parsed.data.requestedAuthorRole,
      requestedSpecialization:
        parsed.data.requestedAuthorRole === "school_administration" ? undefined : parsed.data.requestedSpecialization,
      status: "pending",
    });
    await appendLetterStatusHistory(doc, gate.user as import("@/models/User").IUser, "created", undefined, "pending");
    await doc.save();
    return NextResponse.json({ ok: true, item: serializeLetterRequest(doc.toObject(), "student") });
  } catch (e) {
    console.error("[POST /api/letter-requests]", e);
    return jsonInternalServerError(e);
  }
}
