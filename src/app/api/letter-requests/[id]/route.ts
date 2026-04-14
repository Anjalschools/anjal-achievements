import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LetterRequest from "@/models/LetterRequest";
import { requireStudentSession } from "@/lib/letter-request-auth";
import { parseLetterStudentPatchBody } from "@/lib/letter-request-validation";
import { ALLOWED_INFERRED_FIELD_VALUES } from "@/lib/achievement-inferred-field-allowlist";
import { appendLetterStatusHistory } from "@/lib/letter-request-service";
import { serializeLetterRequest } from "@/lib/letter-request-api-serialize";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Ctx) {
  const gate = await requireStudentSession();
  if (!gate.ok) return gate.response;
  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const uid = gate.user._id;

  try {
    await connectDB();
    const doc = await LetterRequest.findOne({ _id: id, userId: uid }).exec();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item: serializeLetterRequest(doc.toObject(), "student") });
  } catch (e) {
    console.error("[GET /api/letter-requests/[id]]", e);
    return jsonInternalServerError(e);
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const gate = await requireStudentSession();
  if (!gate.ok) return gate.response;
  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const uid = gate.user._id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseLetterStudentPatchBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await connectDB();
    const doc = await LetterRequest.findOne({ _id: id, userId: uid }).exec();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (doc.status !== "pending" && doc.status !== "needs_revision") {
      return NextResponse.json({ error: "Cannot edit request in current status" }, { status: 409 });
    }

    const p = parsed.data;
    if (p.targetOrganization !== undefined) {
      if (!p.targetOrganization || p.targetOrganization.length > 200) {
        return NextResponse.json({ error: "Invalid targetOrganization" }, { status: 400 });
      }
      doc.targetOrganization = p.targetOrganization;
    }
    if (p.requestBody !== undefined) {
      if (!p.requestBody || p.requestBody.length < 10 || p.requestBody.length > 20000) {
        return NextResponse.json({ error: "Invalid requestBody" }, { status: 400 });
      }
      doc.requestBody = p.requestBody;
    }
    if (p.requestType !== undefined) doc.requestType = p.requestType;
    if (p.language !== undefined) doc.language = p.language;
    if (p.requestedAuthorRole !== undefined) doc.requestedAuthorRole = p.requestedAuthorRole;
    if (p.requestedSpecialization !== undefined) {
      doc.requestedSpecialization = p.requestedSpecialization || undefined;
    }
    if (p.requestedWriterName !== undefined) {
      const w = p.requestedWriterName.trim();
      if (w.length === 0) doc.requestedWriterName = "";
      else if (w.length >= 2 && w.length <= 200) doc.requestedWriterName = w;
      else {
        return NextResponse.json({ error: "Invalid requestedWriterName" }, { status: 400 });
      }
    }

    const role = doc.requestedAuthorRole;
    if (role === "school_administration") {
      doc.requestedSpecialization = undefined;
    } else if (role === "teacher" || role === "supervisor") {
      const spec = doc.requestedSpecialization;
      if (!spec || !ALLOWED_INFERRED_FIELD_VALUES.has(spec)) {
        return NextResponse.json({ error: "requestedSpecialization required for teacher/supervisor" }, { status: 400 });
      }
    }

    const prev = doc.status;
    if (prev === "needs_revision") {
      doc.status = "pending";
      await appendLetterStatusHistory(
        doc,
        gate.user as import("@/models/User").IUser,
        "student_resubmit",
        prev,
        "pending",
        "Student updated the request after revision request"
      );
    } else {
      await appendLetterStatusHistory(
        doc,
        gate.user as import("@/models/User").IUser,
        "student_update",
        prev,
        prev
      );
    }

    await doc.save();
    return NextResponse.json({ ok: true, item: serializeLetterRequest(doc.toObject(), "student") });
  } catch (e) {
    console.error("[PATCH /api/letter-requests/[id]]", e);
    return jsonInternalServerError(e);
  }
}
