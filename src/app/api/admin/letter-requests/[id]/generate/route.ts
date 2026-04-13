import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LetterRequest from "@/models/LetterRequest";
import { requireLetterRequestStaff } from "@/lib/letter-request-auth";
import { letterRequestVisibleToStaff } from "@/lib/letter-request-scope";
import { generateLetterAiDraft, type LetterAiAction } from "@/lib/letter-request-ai";
import {
  fetchApprovedAchievementsSummary,
  studentMetaLine,
  appendLetterStatusHistory,
} from "@/lib/letter-request-service";
import { serializeLetterRequest } from "@/lib/letter-request-api-serialize";
import { getInferredFieldUiLabel } from "@/lib/achievement-inferred-field-allowlist";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { isAiAssistEnabled, logOpenAiRuntimeDiagnostics } from "@/lib/openai-env";
import {
  letterAiPublicCodeToHttpStatus,
  mapLetterAiInternalCodeToPublicCode,
  mapLetterOpenAiFailureToUserMessages,
} from "@/lib/letter-request-openai-messages";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";
export const revalidate = 0;
/** Same runtime as other OpenAI API routes — ensures full `process.env` (e.g. OPENAI_API_KEY). */
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const gate = await requireLetterRequestStaff();
  if (!gate.ok) return gate.response;
  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const allowed = await letterRequestVisibleToStaff(id, gate.user as import("@/models/User").IUser);
  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { action?: string } = {};
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    body = {};
  }
  const action = (body.action === "refine" ? "refine" : body.action === "regenerate" ? "regenerate" : "generate") as LetterAiAction;

  logOpenAiRuntimeDiagnostics("POST /api/admin/letter-requests/[id]/generate");

  if (!isAiAssistEnabled()) {
    const msg = mapLetterOpenAiFailureToUserMessages("ai_disabled", "");
    const code = mapLetterAiInternalCodeToPublicCode("ai_disabled");
    return NextResponse.json(
      {
        ok: false,
        error: msg.ar,
        errorEn: msg.en,
        code,
        detail: process.env.NODE_ENV === "development" ? "isAiAssistEnabled() returned false" : undefined,
      },
      { status: letterAiPublicCodeToHttpStatus(code) }
    );
  }

  try {
    await connectDB();
    const doc = await LetterRequest.findById(id).exec();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (doc.status === "approved") {
      return NextResponse.json({ error: "Cannot regenerate approved letter" }, { status: 409 });
    }

    const lang = doc.language;
    const snap = doc.studentSnapshot;
    const studentName =
      lang === "ar"
        ? snap.fullNameAr || snap.fullName || snap.fullNameEn || "—"
        : snap.fullNameEn || snap.fullName || snap.fullNameAr || "—";

    const specLabel =
      doc.requestedSpecialization && (lang === "ar" || lang === "en")
        ? getInferredFieldUiLabel(doc.requestedSpecialization, lang)
        : null;

    const achievementsSummary = await fetchApprovedAchievementsSummary(doc.userId, lang);
    const meta = studentMetaLine(snap, lang);
    const specLine =
      specLabel && (doc.requestedAuthorRole === "teacher" || doc.requestedAuthorRole === "supervisor")
        ? lang === "ar"
          ? `التخصص/المجال: ${specLabel}`
          : `Specialization: ${specLabel}`
        : "";

    const ai = await generateLetterAiDraft({
      action,
      requestType: doc.requestType,
      language: doc.language,
      targetOrganization: doc.targetOrganization,
      requestBody: doc.requestBody,
      requestedAuthorRole: doc.requestedAuthorRole,
      requestedSpecialization: specLine || undefined,
      studentName,
      studentMeta: [meta, specLine].filter(Boolean).join("\n"),
      achievementsSummary,
      currentDraft: doc.aiDraftText || doc.finalApprovedText,
    });

    if (!ai.ok) {
      const msg = mapLetterOpenAiFailureToUserMessages(ai.code, ai.message);
      const code = mapLetterAiInternalCodeToPublicCode(ai.code);
      return NextResponse.json(
        {
          ok: false,
          error: msg.ar,
          errorEn: msg.en,
          code,
          detail: process.env.NODE_ENV === "development" ? ai.message : undefined,
        },
        { status: letterAiPublicCodeToHttpStatus(code) }
      );
    }

    doc.aiDraftText = ai.text;
    const prev = doc.status;
    if (prev === "pending") {
      doc.status = "in_review";
      doc.reviewedAt = new Date();
      doc.reviewedBy = gate.user._id as mongoose.Types.ObjectId;
      await appendLetterStatusHistory(
        doc,
        gate.user as import("@/models/User").IUser,
        "open_review",
        prev,
        "in_review"
      );
    }
    await appendLetterStatusHistory(
      doc,
      gate.user as import("@/models/User").IUser,
      `ai_${action}`,
      doc.status,
      doc.status
    );
    await doc.save();

    return NextResponse.json({ ok: true, item: serializeLetterRequest(doc.toObject(), "admin") });
  } catch (e) {
    console.error("[POST /api/admin/letter-requests/[id]/generate]", e);
    return jsonInternalServerError(e);
  }
}
